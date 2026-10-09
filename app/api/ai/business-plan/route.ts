import { generateBusinessPlan, type CostData } from "@/lib/integrations/business-plan";
import { badRequest, isProfile, readJson } from "../_shared";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!isProfile(body?.profile)) return badRequest("profile (UserProfile) is required");
  const costs = body?.costs as CostData | undefined;
  if (!Array.isArray(costs?.setup) || !Array.isArray(costs?.monthly)) return badRequest("costs (feature 10's CostData) is required");

  return Response.json(await generateBusinessPlan(body.profile, costs));
}
