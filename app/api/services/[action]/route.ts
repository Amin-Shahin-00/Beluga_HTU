// Startup services (Part E) AI helpers. Results are drafts the owner edits.
//   POST /api/services/presence  { businessId }                          → { presence }
//   POST /api/services/job-ad    { businessId, title, hours?, salary? }   → { ad, questions }
//   POST /api/services/rank-cvs  { keywords, cvs: [{ name, text }] }      → { ranked }
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { interviewQuestions, jobAd, presence, rankCvs, type Biz } from "@/lib/services/texts";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { action } = await context.params;
  const input = await readObject(request, 300000);
  if (!input) return json({ error: "Send a JSON object." }, 400);
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: "Sign in first." }, 401);

  if (action === "rank-cvs") {
    const v = z.object({ keywords: z.array(z.string().max(60)).min(1).max(30), cvs: z.array(z.object({ name: z.string().min(1).max(120), text: z.string().min(1).max(40000) })).min(1).max(30) }).safeParse(input);
    if (!v.success) return json({ error: "Add the skills to look for and at least one CV." }, 400);
    return json({ ranked: rankCvs(v.data.keywords, v.data.cvs), note: "A shortlisting aid only: read every CV yourself, and never rank on age, gender, nationality, religion or marital status." });
  }

  const bid = Number(input.businessId);
  const { data: business } = await db.from("businesses").select("id, name, city").eq("id", bid).eq("user_id", auth.user.id).maybeSingle();
  if (!business) return json({ error: "Business not found." }, 404);
  const [{ data: prof }, { data: brandRow }] = await Promise.all([
    db.from("bedaya_profiles").select("answers").eq("business_id", bid).maybeSingle(),
    db.from("bedaya_workspace").select("data").eq("business_id", bid).eq("kind", "brand").eq("item", "").order("approved", { ascending: false }).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const a = (prof?.answers ?? {}) as { personal?: { city?: string; phone?: string }; business?: { nameEn?: string; nameAr?: string; sector?: string; description?: string } };
  const brand = brandRow?.data as { name?: { en: string; ar: string }; tone?: { en: string } } | undefined;
  const biz: Biz = {
    nameEn: brand?.name?.en || a.business?.nameEn || business.name,
    nameAr: brand?.name?.ar || a.business?.nameAr || business.name,
    sector: a.business?.sector ?? "services",
    city: a.personal?.city ?? business.city ?? "Amman",
    description: (a.business?.description ?? "").slice(0, 500),
    phone: a.personal?.phone ?? "",
    tone: brand?.tone?.en,
  };
  if (action === "presence") return json(await presence(biz));
  if (action === "job-ad") {
    const v = z.object({ title: z.string().trim().min(2).max(80), hours: z.string().max(60).optional(), salary: z.string().max(20).optional() }).safeParse({ title: input.title, hours: input.hours, salary: input.salary });
    if (!v.success) return json({ error: "Write the job title." }, 400);
    return json({ ...(await jobAd(biz, v.data.title, v.data.hours ?? "", v.data.salary ?? "")), questions: interviewQuestions(v.data.title) });
  }
  return json({ error: "Not found." }, 404);
}
