// POST /api/documents/upload  (multipart/form-data: file, docType?)
// Saves the file, runs OCR (mock), returns the document with its OcrResult.
import { NextRequest, NextResponse } from "next/server";
import { uploadDocument } from "../../../../lib/integrations/documents";
import type { DocType } from "../../../../lib/integrations/types";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Send the file in a 'file' field" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: `Unsupported type ${file.type}` }, { status: 415 });

  const docType = (form.get("docType") as DocType | null) ?? undefined;
  const doc = await uploadDocument(
    s.id,
    { name: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
    docType,
  );
  return NextResponse.json({ document: { ...doc, fileUrl: `/api/documents/${doc.id}/file` } }, { status: 201 });
}
