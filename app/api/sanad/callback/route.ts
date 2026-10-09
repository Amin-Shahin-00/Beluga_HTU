// GET /api/sanad/callback?code=...&return=/roadmap
// SANAD sends the browser here. Exchanges the code, starts the session.
import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider } from "../../../../lib/integrations/sanad";
import { setSession } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const returnUrl = req.nextUrl.searchParams.get("return") || "/m5-demo";
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
  try {
    const user = await getIdentityProvider().exchangeCode(code);
    // Real app: M4 upserts the user row here, keyed by user.nationalId.
    return setSession(NextResponse.redirect(new URL(returnUrl, req.url)), user.nationalId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
