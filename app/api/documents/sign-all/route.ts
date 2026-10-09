// POST /api/documents/sign-all  { documentIds?: string[] }
// Signs every ready-to-sign document (or only the ids given) in one session.
import { NextRequest, NextResponse } from "next/server";
import { signAll } from "../../../../lib/integrations/documents";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { documentIds?: string[] };
  try {
    return NextResponse.json(await signAll(s.id, body.documentIds));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
