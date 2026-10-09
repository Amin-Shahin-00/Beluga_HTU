// GET /api/sanad/demo-users → the scope labels the mock SANAD consent screen shows. Mock only.
// (It no longer lists identities: people sign in with their national ID and SANAD password.)
import { NextResponse } from "next/server";
import { SCOPE_LABELS } from "../../../../lib/integrations/consent";
import { sanadMode } from "../../../../lib/integrations/sanad";

export const runtime = "nodejs";

export function GET() {
  if (sanadMode() !== "mock") return NextResponse.json({ error: "Mock SANAD is off" }, { status: 404 });
  return NextResponse.json({ scopes: SCOPE_LABELS });
}
