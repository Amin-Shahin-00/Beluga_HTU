import { explainMatches, type RankedIncubator } from "@/lib/integrations/incubators";
import { badRequest, isProfile, readJson } from "../../_shared";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!isProfile(body?.profile)) return badRequest("profile (UserProfile) is required");
  // M4 sends its ranking; without one we use the stand-in ranker.
  const ranked = Array.isArray(body?.ranked)
    ? body.ranked.filter((r): r is RankedIncubator => typeof r?.incubatorId === "string" && typeof r?.score === "number")
    : undefined;

  return Response.json(await explainMatches(body.profile, ranked));
}
