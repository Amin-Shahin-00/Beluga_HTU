// GET  /api/staff/admin → the Bedaya team's overview: applicants, progress, warnings, outbox.
// POST /api/staff/admin { action: "reset" } → wipes all demo data (for rehearsals).
import { NextRequest, NextResponse } from "next/server";
import { adminOverview } from "../../../../lib/integrations/dashboards";
import { resetStore } from "../../../../lib/integrations/store";
import { requireStaff } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireStaff((r) => r === "admin");
  if ("error" in s) return s.error;
  return NextResponse.json(adminOverview());
}

export async function POST(req: NextRequest) {
  const s = await requireStaff((r) => r === "admin");
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "reset") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  resetStore();
  return NextResponse.json({ ok: true });
}
