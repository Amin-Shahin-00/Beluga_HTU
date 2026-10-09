// GET /api/sanad/login?return=/roadmap
// Starts "Login with SANAD". Redirects to the (mock) SANAD login page.
import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider } from "../../../../lib/integrations/sanad";
import type { SanadScope } from "../../../../lib/integrations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const returnUrl = req.nextUrl.searchParams.get("return") || "/m5-demo";
  const scopes: SanadScope[] = ["identity", "contact", "address"];
  return NextResponse.redirect(new URL(getIdentityProvider().getLoginUrl(returnUrl, scopes), req.url));
}
