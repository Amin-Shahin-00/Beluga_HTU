// GET  /api/consent → the user's consent and data-access log.
// POST /api/consent { action: "revoke" } → withdraws consent for all SANAD data
//      and signs out. The next login asks for consent again.
import { NextRequest, NextResponse } from "next/server";
import { consentHistory, revokeConsent } from "../../../lib/integrations/consent";
import { clearSession, requireUser } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  return NextResponse.json({ log: consentHistory(s.id).reverse() });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "revoke") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  revokeConsent(s.id, ["identity", "contact", "address"]);
  return clearSession(NextResponse.json({ ok: true }));
}
