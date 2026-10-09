// AI Launch Studio (Part D). Every result is a draft the owner edits and approves in the browser;
// drafts and approvals are saved as versions through /api/workspace.
//   POST /api/studio/names    { businessId, seed }                    → { names }
//   POST /api/studio/palette  { businessId, seed }                    → { palette }
//   POST /api/studio/tone     { businessId, seed }                    → { fonts, tone }
//   POST /api/studio/logos    { businessId, seed, name, palette, fonts } → { logos } (sanitised SVG)
//   POST /api/studio/site     { businessId }                          → { site } first draft from profile + brand + location
//   POST /api/studio/site-edit { site, instruction }                  → { site, reply }
//   POST /api/studio/publish  { businessId, slug, site }              → { slug, url }
//   POST /api/studio/published { businessId }                         → { site, messages }
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { fontsAndTone, logos, nameIdeas, palette, ARABIC_FONTS, LATIN_FONTS, type BrandInput } from "@/lib/studio/brand";
import { draftSite, editSite, siteSchema } from "@/lib/studio/site";
import type { Sector } from "@/lib/integrations/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
type Answers = { personal?: { city?: string; phone?: string; email?: string }; business?: { sector?: Sector; description?: string; descriptionAr?: string; nameEn?: string; nameAr?: string; targetCustomers?: string } };

const RESERVED = new Set(["www", "api", "admin", "app", "mail", "bedaya", "localhost"]);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const swatches = z.array(z.object({ hex, role: z.enum(["primary", "secondary", "accent", "dark", "light"]) })).length(5);

export async function POST(request: Request, context: Context) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { action } = await context.params;
  const input = await readObject(request, 450000);
  if (!input) return json({ error: "Send a JSON object (max 450 KB)." }, 400);

  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: "Sign in first." }, 401);
  const userId = auth.user.id;

  if (action === "site-edit") {
    const v = z.object({ site: z.unknown(), instruction: z.string().min(1).max(500), tone: z.string().max(400).optional() }).safeParse(input);
    const site = v.success ? siteSchema.safeParse(v.data.site) : null;
    if (!v.success || !site?.success) return json({ error: "Send { site, instruction }." }, 400);
    return json(await editSite(site.data, v.data.instruction, v.data.tone));
  }

  const bid = Number(input.businessId);
  if (!Number.isInteger(bid) || bid <= 0) return json({ error: "businessId is required." }, 400);
  const { data: business } = await db.from("businesses").select("id").eq("id", bid).eq("user_id", userId).maybeSingle();
  if (!business) return json({ error: "Business not found." }, 404);
  const { data: prof } = await db.from("bedaya_profiles").select("answers").eq("business_id", bid).maybeSingle();
  const answers = (prof?.answers ?? {}) as Answers;
  const brandInput: BrandInput = {
    sector: answers.business?.sector ?? "services",
    city: answers.personal?.city ?? "Amman",
    description: answers.business?.description ?? "",
    nameEn: answers.business?.nameEn,
    nameAr: answers.business?.nameAr,
  };
  const seed = Math.max(0, Math.min(10000, Number(input.seed) || 0));

  switch (action) {
    case "names":
      return json(await nameIdeas(brandInput, seed));
    case "palette":
      return json(await palette(brandInput, seed));
    case "tone":
      return json(await fontsAndTone(brandInput, seed));
    case "logos": {
      const v = z
        .object({ name: z.object({ en: z.string().min(1).max(60), ar: z.string().min(1).max(60) }), palette: swatches, fonts: z.object({ arabic: z.enum(ARABIC_FONTS as [string, ...string[]]), latin: z.enum(LATIN_FONTS as [string, ...string[]]) }) })
        .safeParse(input);
      if (!v.success) return json({ error: "Pick a name, palette and fonts first." }, 400);
      return json(await logos(v.data.name, v.data.palette, v.data.fonts, brandInput.sector, seed));
    }
    case "site": {
      const [brandRow, locRow] = await Promise.all([latest(db, bid, "brand"), latest(db, bid, "location")]);
      const brand = brandRow as { name?: { en: string; ar: string }; palette?: { hex: string; role: string }[]; fonts?: { arabic: string; latin: string }; logos?: string[]; logoIndex?: number; tone?: { en: string; ar: string } } | null;
      if (!brand?.name || !brand.palette || !brand.fonts) return json({ error: "Create your brand kit first, so the website can follow it." }, 409);
      const loc = locRow as { address: string; lat: number; lng: number } | null;
      return json({
        site: draftSite({
          sector: brandInput.sector,
          description: brandInput.description,
          descriptionAr: answers.business?.descriptionAr,
          customers: answers.business?.targetCustomers ?? "",
          city: brandInput.city,
          phone: answers.personal?.phone ?? "",
          email: answers.personal?.email ?? "",
          brand: { name: brand.name, palette: brand.palette, fonts: brand.fonts, logo: brand.logos?.[brand.logoIndex ?? 0], tone: brand.tone },
          location: loc && typeof loc.lat === "number" ? loc : null,
        }),
      });
    }
    case "publish": {
      const slug = String(input.slug ?? "").toLowerCase();
      if (!/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/.test(slug) || RESERVED.has(slug)) return json({ error: "Use 3–40 lowercase letters, numbers or dashes." }, 400);
      const site = siteSchema.safeParse(input.site);
      if (!site.success) return json({ error: "The website content isn't valid. Reload and try again." }, 400);
      const { error } = await db.rpc("bedaya_publish_site", { p_business: bid, p_slug: slug, p_data: site.data });
      if (error) return json({ error: error.code === "23505" ? "That address is taken. Try another." : "Could not publish." }, error.code === "23505" ? 409 : 500);
      return json({ slug, path: `/s/${slug}` }, 201);
    }
    case "published": {
      const { data: site } = await db.from("bedaya_sites").select("slug, published_at").eq("business_id", bid).maybeSingle();
      const { data: messages } = site ? await db.from("bedaya_site_messages").select("id, name, contact, message, created_at").eq("slug", site.slug).order("created_at", { ascending: false }).limit(50) : { data: [] };
      return json({ site: site ?? null, messages: messages ?? [] });
    }
  }
  return json({ error: "Not found." }, 404);
}

async function latest(db: Awaited<ReturnType<typeof createClient>>, bid: number, kind: string) {
  const { data } = await db.from("bedaya_workspace").select("data, approved").eq("business_id", bid).eq("kind", kind).eq("item", "").order("version", { ascending: false }).limit(1).maybeSingle();
  return (data?.data as unknown) ?? null;
}
