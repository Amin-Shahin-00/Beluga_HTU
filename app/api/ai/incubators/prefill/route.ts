import { prefillApplications } from "@/lib/integrations/incubators";
import { badRequest, isProfile, readJson } from "../../_shared";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!isProfile(body?.profile)) return badRequest("profile (UserProfile) is required");
  if (!Array.isArray(body?.incubatorIds) || !body.incubatorIds.every((id) => typeof id === "string")) {
    return badRequest("incubatorIds must be an array of incubator ids");
  }

  return Response.json({ applications: prefillApplications(body.profile, body.incubatorIds as string[]) });
}
