// GET /api/documents → the user's documents (uploads + generated forms).
import { NextResponse } from "next/server";
import { getSignature, listDocuments } from "../../../lib/integrations/documents";
import { OFFICES, isOffice } from "../../../lib/integrations/offices";
import { requireUser } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const documents = listDocuments(s.id).map((d) => ({
    ...d,
    fileUrl: `/api/documents/${d.id}/file`,
    officeName: d.office && isOffice(d.office) ? OFFICES[d.office] : null,
    signature: d.status === "uploaded" || d.status === "ready_to_sign" ? null : getSignature(d.id),
  }));
  return NextResponse.json({ documents });
}
