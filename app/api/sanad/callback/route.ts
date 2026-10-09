// GET /api/sanad/callback?code=...&return=/#sanad
// SANAD sends the browser here. Exchanges the code through the IdentityProvider adapter, keeps the
// verified record it returned, and starts the SANAD session. The Bedaya account linked to this
// national ID is opened next by POST /api/account/sanad.
import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider } from "../../../../lib/integrations/sanad";
import { insert, now, update, find } from "../../../../lib/integrations/store";
import { setSession } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const raw = req.nextUrl.searchParams.get("return") || "/";
  const returnUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
  try {
    const user = await getIdentityProvider().exchangeCode(code);
    const row = { nationalId: user.nationalId, user, receivedAt: now() };
    if (find("sanad_sessions", (r) => r.nationalId === user.nationalId)) update("sanad_sessions", (r) => r.nationalId === user.nationalId, row);
    else insert("sanad_sessions", row);
    return setSession(NextResponse.redirect(new URL(returnUrl, req.url)), user.nationalId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
