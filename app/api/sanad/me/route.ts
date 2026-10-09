// GET /api/sanad/me → the signed-in user's data, each field with its source.
// POST /api/sanad/me { action: "logout" } → ends the session.
import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "../../../../lib/integrations/consent";
import { demoUser } from "../../../../lib/integrations/demoData";
import { sanadMode } from "../../../../lib/integrations/sanad";
import { clearSession, requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  // Real app: read the stored user row (M4). Demo: the dummy SANAD record.
  const user = demoUser(s.id);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  logAccess(s.id, ["identity", "contact", "address"], "profile_view");
  return NextResponse.json({ user, sanadMode: sanadMode() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "logout") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return clearSession(NextResponse.json({ ok: true }));
}
