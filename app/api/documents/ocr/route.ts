// GET /api/documents/ocr → { files: OcrResult[] } for the signed-in user.
// The shared OcrResult (lib/integrations/types.ts): every upload's OCR result,
// plus pledge forms signed in Bedaya. Pass `files` to POST /api/ai/documents/check.
import { NextResponse } from "next/server";
import { ocrResults } from "../../../../lib/integrations/documents";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  return NextResponse.json({ files: ocrResults(s.id) });
}
