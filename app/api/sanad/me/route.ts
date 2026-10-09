// GET /api/sanad/me → the SANAD-verified record for the current SANAD session, each field { value, source }.
// POST /api/sanad/me { action: "logout" } → ends the SANAD session.
import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "../../../../lib/integrations/consent";
import { sanadMode } from "../../../../lib/integrations/sanad";
import { find } from "../../../../lib/integrations/store";
import { clearSession, requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  // The record IdentityProvider.exchangeCode returned at login (never a hard-coded demo person).
  const user = find("sanad_sessions", (r) => r.nationalId === s.id)?.user;
  if (!user) return NextResponse.json({ error: "Sign in with SANAD again." }, { status: 401 });
  logAccess(s.id, ["identity", "contact", "address"], "profile_view");
  return NextResponse.json({ user, sanadMode: sanadMode() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "logout") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return clearSession(NextResponse.json({ ok: true }));
}
