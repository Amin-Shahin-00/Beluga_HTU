// GET /api/staff/sanad → MoDEE's view of SANAD activity for Bedaya (sanad role, mock).
import { NextResponse } from "next/server";
import { sanadOverview } from "../../../../lib/integrations/dashboards";
import { sanadMode } from "../../../../lib/integrations/sanad";
import { requireStaff } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireStaff((r) => r === "sanad");
  if ("error" in s) return s.error;
  return NextResponse.json({ sanadMode: sanadMode(), ...sanadOverview() });
}
