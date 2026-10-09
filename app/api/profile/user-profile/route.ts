// GET /api/profile/user-profile → { profile: UserProfile } for the signed-in user.
// The shared UserProfile the AI routes take (/api/ai/*), built from SANAD data
// and business info until M4's wizard stores the real one.
import { NextResponse } from "next/server";
import { toUserProfile } from "../../../../lib/integrations/profile";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const profile = toUserProfile(s.id);
  if (!profile) return NextResponse.json({ error: "No profile yet. Finish the onboarding wizard first." }, { status: 404 });
  return NextResponse.json({ profile });
}
