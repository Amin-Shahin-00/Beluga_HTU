// GET /api/staff/gov/documents/:id/file → the signed PDF, only for the office it was sent to.
// Every open is written to the applicant's access log, so they can see which office read it.
import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "../../../../../../../lib/integrations/consent";
import { getOfficeDocument } from "../../../../../../../lib/integrations/documents";
import type { OfficeKey } from "../../../../../../../lib/integrations/offices";
import { getFile } from "../../../../../../../lib/integrations/store";
import { requireStaff } from "../../../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff((r) => r.startsWith("gov:"));
  if ("error" in s) return s.error;
  const office = s.role.slice(4) as OfficeKey;
  const { id } = await params;
  const doc = getOfficeDocument(office, id);
  const bytes = doc ? getFile(id) : null;
  if (!doc || !bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logAccess(doc.nationalId, ["identity", "contact"], `gov_review:${office}`);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
