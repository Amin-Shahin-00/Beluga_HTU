// Bedaya Copilot API. The AI only drafts; the owner approves each piece in the browser, and every draft
// and approval is saved as a version (/api/workspace/{business}/copilot). Nothing here submits anything.
//   GET  /api/copilot/context?lang=     → the business as the copilot sees it (steps, docs to write, papers to provide)
//   POST /api/copilot/brief   { lang, instruction?, current? } → { draft, source }
//   POST /api/copilot/plan    { lang }                         → { steps, recommendations, source }
//   POST /api/copilot/doc     { lang, docId, instruction?, current? } → { draft, source }
//   GET  /api/copilot/log                                      → the activity log (drafts and approvals)
import { z } from "zod";
import { copilotContext, writeBrief, writeDoc, writePlan } from "@/lib/copilot";
import { checkMutation, json, readObject } from "@/lib/http";
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
    .object({ lang: z.enum(["ar", "en"]).optional(), docId: z.string().max(60).optional(), instruction: z.string().trim().max(500).optional(), current: z.string().max(12000).optional() })
    .safeParse(await readObject(request, 40_000));
  if (!v.success) return json({ error: "Invalid request." }, 400);
  const { lang, docId, instruction, current } = v.data;
  try {
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
