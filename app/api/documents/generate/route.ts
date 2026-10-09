// POST /api/documents/generate → fills every form this user's case needs.
import { NextResponse } from "next/server";
import { generateForms } from "../../../../lib/integrations/documents";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  try {
    const r = await generateForms(s.id);
    const withUrl = (d: { id: string }) => ({ ...d, fileUrl: `/api/documents/${d.id}/file` });
    return NextResponse.json({ generated: r.generated.map(withUrl), keptSigned: r.keptSigned.map(withUrl) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
