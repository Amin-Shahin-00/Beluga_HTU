// GET /api/sanad/demo-users → identities the mock SANAD page offers. Mock only.
import { NextResponse } from "next/server";
import { SCOPE_LABELS } from "../../../../lib/integrations/consent";
import { DEMO_USERS } from "../../../../lib/integrations/demoData";
import { sanadMode } from "../../../../lib/integrations/sanad";

export const runtime = "nodejs";

export function GET() {
  if (sanadMode() !== "mock") return NextResponse.json({ error: "Mock SANAD is off" }, { status: 404 });
  return NextResponse.json({
    users: DEMO_USERS.map((u) => ({ nationalId: u.nationalId, nameAr: u.fullNameAr.value, nameEn: u.fullNameEn.value })),
    scopes: SCOPE_LABELS,
  });
}
