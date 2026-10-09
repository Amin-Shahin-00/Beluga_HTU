// POST /api/documents/submit → sends every signed form to its government office.
import { NextResponse } from "next/server";
import { submitAll } from "../../../../lib/integrations/documents";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  return NextResponse.json({ submitted: submitAll(s.id) });
}
