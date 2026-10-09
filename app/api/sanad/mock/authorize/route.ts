// POST /api/sanad/mock/authorize  { nationalId, scopes, return }
// MOCK ONLY: called by the mock SANAD page when the user approves consent.
// Real SANAD does this on its own servers and redirects back with a code.
import { NextRequest, NextResponse } from "next/server";
import { getMockSanad, sanadMode } from "../../../../../lib/integrations/sanad";
import type { SanadScope } from "../../../../../lib/integrations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (sanadMode() !== "mock") return NextResponse.json({ error: "Mock SANAD is off" }, { status: 404 });
  const body = (await req.json()) as { nationalId?: string; scopes?: SanadScope[]; return?: string };
  if (!body.nationalId || !body.scopes?.length) {
    return NextResponse.json({ error: "nationalId and scopes are required" }, { status: 400 });
  }
  try {
    const code = getMockSanad().authorize(body.nationalId, body.scopes);
    const q = new URLSearchParams({ code, return: body.return || "/m5-demo" });
    return NextResponse.json({ redirect: `/api/sanad/callback?${q}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
