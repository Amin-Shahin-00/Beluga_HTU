// GET /api/ai/programmes[?type=grant|loan|incubator|accelerator|competition]
// Every real support programme in M1's list (data/m1/incubators.json), for browsing and the Funding screen.
// Matching for a specific user is POST /api/ai/incubators/match (or M4's /api/platform/businesses/{id}/incubators).
import { incubators } from "@/lib/integrations/incubators";

const TYPES = new Set(["grant", "loan", "incubator", "accelerator", "competition"]);

export function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type");
  const list = type && TYPES.has(type) ? incubators.filter((i) => i.type === type) : incubators;
  return Response.json({
    programmes: list.map(({ applicationFields: _fields, ...programme }) => programme),
    note: "Real Jordanian programmes; application forms are not public, and deadlines must be checked on each website.",
  });
}
