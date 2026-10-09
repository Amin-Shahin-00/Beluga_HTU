// GET /api/documents/check → Ameen's document checker (feature 9) run on the
// signed-in user's own files: missing, expired and blurry documents.
// Same response as POST /api/ai/documents/check; this route just fills in
// the profile and files from the session so the screen doesn't have to.
import { NextResponse } from "next/server";
import { checkDocuments } from "../../../../lib/integrations/document-checker";
import { ocrResults } from "../../../../lib/integrations/documents";
import { toUserProfile } from "../../../../lib/integrations/profile";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const profile = toUserProfile(s.id);
  if (!profile) return NextResponse.json({ error: "No profile yet. Finish the onboarding wizard first." }, { status: 404 });
  return NextResponse.json(await checkDocuments({ profile, files: ocrResults(s.id) }));
}
