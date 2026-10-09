// GET    /api/staff/session → { role } of the signed-in staff member, or null.
// POST   /api/staff/session { role } → MOCK staff sign-in (gov:<office> | sanad | admin).
// DELETE /api/staff/session → staff sign-out.
// Real life: each party signs in through its own system, not a role picker.
import { NextRequest, NextResponse } from "next/server";
import { STAFF_ROLES, clearStaffSession, currentStaff, isStaffRole, setStaffSession } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ role: await currentStaff() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!body.role || !isStaffRole(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${STAFF_ROLES.join(", ")}` }, { status: 400 });
  }
  return setStaffSession(NextResponse.json({ role: body.role }), body.role);
}

export function DELETE() {
  return clearStaffSession(NextResponse.json({ ok: true }));
}
