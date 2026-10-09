import { generateBusinessPlan, type BusinessPlan, type CostData } from "@/lib/integrations/business-plan";
import { renderBusinessPlanPdf } from "@/lib/integrations/business-plan-pdf";
import { badRequest, isProfile, readJson } from "../../_shared";

// Send either a plan you already generated ({ plan }) or the inputs ({ profile, costs }), plus "lang": "ar" | "en".
export async function POST(req: Request) {
  const body = await readJson(req);
  const lang = body?.lang === "ar" ? "ar" : "en";
  let plan = body?.plan as BusinessPlan | undefined;
  if (!plan?.title) {
    const costs = body?.costs as CostData | undefined;
    if (!isProfile(body?.profile) || !Array.isArray(costs?.setup)) return badRequest("send { plan } or { profile, costs }");
    plan = await generateBusinessPlan(body.profile, costs as CostData);
  }

  const bytes = await renderBusinessPlanPdf(plan, lang);
  const fileName = `${plan.title.en.split(":")[0].replace(/[^\w-]+/g, "-")}-business-plan-${lang}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"` },
  });
}
