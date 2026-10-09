// GET /api/documents/:id/file → the file (signed version once signed).
// Add ?download=1 to download instead of opening in the browser.
import { NextRequest, NextResponse } from "next/server";
import { getDocumentFile } from "../../../../../lib/integrations/documents";
import { requireUser } from "../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const { id } = await params;
  const f = getDocumentFile(s.id, id);
  if (!f?.bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new NextResponse(Buffer.from(f.bytes), {
    headers: {
      "Content-Type": f.doc.mimeType,
      "Content-Disposition": `${disposition}; filename="${f.doc.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
