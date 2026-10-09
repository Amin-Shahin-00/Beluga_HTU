// GET  /api/profile → the user's business info, each field { value, source }.
// POST /api/profile { businessNameAr?, businessNameEn?, activityAr?, activityEn?, address?, capitalJod?, partners? }
//      → saves the user's edits (source becomes typed_by_user). Generate again to update unsigned forms.
import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile } from "../../../lib/integrations/profile";
import { requireUser } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const profile = getProfile(s.id);
  if (!profile) return NextResponse.json({ error: "No profile yet. Finish the onboarding wizard first." }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the fields as JSON" }, { status: 400 });
  try {
    return NextResponse.json({ profile: updateProfile(s.id, body) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
