// GET    /api/staff/session → { role, allowed } of the signed-in staff member (role null if none).
// POST   /api/staff/session { role } → staff sign-in (gov:<office> | sanad | admin), Bedaya admin account only.
// DELETE /api/staff/session → staff sign-out.
// The Bedaya admin account plays each office in this demo. Real life: each party's own login system.
import { NextRequest, NextResponse } from "next/server";
import { STAFF_ROLES, clearStaffSession, currentStaff, isStaffRole, setStaffSession, staffAllowed } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const allowed = await staffAllowed();
  return NextResponse.json({ role: allowed ? await currentStaff() : null, allowed });
}

export async function POST(req: NextRequest) {
  if (!(await staffAllowed())) return NextResponse.json({ error: "Sign in to Bedaya with the admin account to open the staff dashboards." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!body.role || !isStaffRole(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${STAFF_ROLES.join(", ")}` }, { status: 400 });
  }
  return setStaffSession(NextResponse.json({ role: body.role }), body.role);
}

export function DELETE() {
  return clearStaffSession(NextResponse.json({ ok: true }));
}