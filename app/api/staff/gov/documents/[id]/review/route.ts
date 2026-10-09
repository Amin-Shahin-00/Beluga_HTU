// POST /api/staff/gov/documents/:id/review { decision: "approved" | "returned", note? }
// The office approves the form or returns it with a note (note required to return).
// The applicant gets a notification either way.
import { NextRequest, NextResponse } from "next/server";
import { reviewDocument } from "../../../../../../../lib/integrations/documents";
import type { OfficeKey } from "../../../../../../../lib/integrations/offices";
import { requireStaff } from "../../../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff((r) => r.startsWith("gov:"));
  if ("error" in s) return s.error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };
  if (body.decision !== "approved" && body.decision !== "returned") {
    return NextResponse.json({ error: "decision must be approved or returned" }, { status: 400 });
  }
  try {
    const doc = reviewDocument(s.role.slice(4) as OfficeKey, id, body.decision, body.note);
    return NextResponse.json({ document: { id: doc.id, status: doc.status, review: doc.review } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
