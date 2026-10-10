// Bedaya Copilot API. The AI only drafts; the owner approves each piece in the browser, and every draft
// and approval is saved as a version (/api/workspace/{business}/copilot). Nothing here submits anything.
//   GET  /api/copilot/context?lang=     → the business as the copilot sees it (steps, docs to write, papers to provide)
//   POST /api/copilot/brief   { lang, instruction?, current? } → { draft, source }
//   POST /api/copilot/plan    { lang }                         → { steps, recommendations, source }
//   POST /api/copilot/doc     { lang, docId, instruction?, current? } → { draft, source }
//   GET  /api/copilot/log                                      → the activity log (drafts and approvals)
//   GET  /api/copilot/structures?lang=                         → legal structures explained + Saad's recommendation
//   POST /api/copilot/structure { legalForm }                  → the owner switches structure; the roadmap is rebuilt
import { z } from "zod";
import { copilotContext, writeBrief, writeDoc, writePlan } from "@/lib/copilot";
import { checkMutation, json, readObject } from "@/lib/http";
import { structuresFor } from "@/lib/legal-forms";
import { getProfile, setLegalForm } from "@/lib/integrations/profile";
import { withdrawUnneededForms } from "@/lib/integrations/documents";
import type { UserProfile } from "@/lib/integrations/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
const langOf = (v: unknown) => (v === "en" ? "en" : "ar") as "en" | "ar";
const notReady = () => json({ error: "Sign in and finish your business profile first; the copilot learns from it." }, 409);

export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  try {
    if (action === "context") {
      const c = await copilotContext(langOf(new URL(request.url).searchParams.get("lang")));
      if (!c) return notReady();
      return json({ businessId: c.businessId, name: c.client.name, business: c.client.business, progress: c.client.progress, steps: c.steps, writeDocs: c.writeDocs, provide: c.provide });
    }
    if (action === "structures") {
      const db = await createClient();
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return json({ error: "Sign in first." }, 401);
      const { data: biz } = await db.from("businesses").select("id").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: prof } = biz ? await db.from("bedaya_profiles").select("answers, submitted_at").eq("business_id", biz.id).maybeSingle() : { data: null };
      if (!prof?.submitted_at) return notReady();
      const { data: identity } = await db.from("bedaya_identities").select("national_id").eq("user_id", auth.user.id).maybeSingle();
      const partners = identity ? Number(getProfile(identity.national_id)?.partners.value ?? NaN) : NaN;
      const { count: done } = await db.from("bedaya_tasks").select("id", { count: "exact", head: true }).eq("business_id", biz!.id).eq("status", "done");
      return json({ ...structuresFor(prof.answers as UserProfile, langOf(new URL(request.url).searchParams.get("lang")), Number.isFinite(partners) ? partners : null), locked: (done ?? 0) > 0 });
    }
    if (action === "log") {
      const db = await createClient();
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return json({ error: "Sign in first." }, 401);
      const { data } = await db.from("bedaya_workspace").select("item, version, approved, created_at, data").eq("user_id", auth.user.id).eq("kind", "copilot").order("created_at", { ascending: false }).limit(60);
      return json({
        data: (data ?? []).map((r) => {
          const d = r.data as { actor?: string; action?: string; title?: string };
          return { item: r.item, version: r.version, approved: r.approved, at: r.created_at, actor: d?.actor ?? "human", action: d?.action ?? (r.approved ? "approve" : "save"), title: d?.title ?? r.item };
        }),
      });
    }
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
  return json({ error: "Not found." }, 404);
}

export async function POST(request: Request, context: Context) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { action } = await context.params;
  const v = z
    .object({ lang: z.enum(["ar", "en"]).optional(), legalForm: z.string().max(40).optional(), docId: z.string().max(60).optional(), instruction: z.string().trim().max(500).optional(), current: z.string().max(12000).optional() })
    .safeParse(await readObject(request, 40_000));
  if (!v.success) return json({ error: "Invalid request." }, 400);
  const { lang, docId, instruction, current } = v.data;
  try {
    if (action === "structure") {
      const form = v.data.legalForm;
      if (!form || !["home_business", "sole_proprietorship", "llc"].includes(form)) return json({ error: "Bedaya can guide this structure with an expert; choose home business, sole proprietorship or LLC to rebuild your roadmap." }, 400);
      const db = await createClient();
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return json({ error: "Sign in first." }, 401);
      const { data: biz } = await db.from("businesses").select("id").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!biz) return notReady();
      const { error } = await db.rpc("bedaya_change_legal_form", { p_business: biz.id, p_legal_form: form });
      if (error) return json({ error: /completed/i.test(error.message) ? "You've already completed a step, so the structure can't change here. Talk to an expert." : "Could not change the structure." }, 409);
      // Keep the official forms in step: the structure decides which forms are needed.
      const { data: identity } = await db.from("bedaya_identities").select("national_id").eq("user_id", auth.user.id).maybeSingle();
      let withdrawn = 0;
      if (identity) {
        setLegalForm(identity.national_id, form as "home_business" | "sole_proprietorship" | "llc");
        withdrawn = withdrawUnneededForms(identity.national_id);
      }
      return json({ legalForm: form, withdrawnForms: withdrawn });
    }
    const c = await copilotContext(langOf(lang));
    if (!c) return notReady();
    if (action === "brief") return json(await writeBrief(c, instruction || undefined, current));
    if (action === "plan") return json(await writePlan(c));
    if (action === "doc") {
      const out = docId ? await writeDoc(c, docId, instruction || undefined, current) : null;
      return out ? json(out) : json({ error: "Unknown document." }, 404);
    }
  } catch {
    return json({ error: "The copilot couldn't finish that. Please try again." }, 500);
  }
  return json({ error: "Not found." }, 404);
}
