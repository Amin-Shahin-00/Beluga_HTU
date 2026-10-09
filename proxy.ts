// Published websites on their own subdomain: <slug>.localhost (local demo) or <slug>.<BEDAYA_SITE_DOMAIN>.
// The request is rewritten to /s/<slug>; everything else passes through untouched.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const domains = ["localhost", process.env.BEDAYA_SITE_DOMAIN?.toLowerCase()].filter(Boolean) as string[];
  const root = domains.find((d) => host.endsWith(`.${d}`));
  if (!root) return NextResponse.next();
  const slug = host.slice(0, -(root.length + 1));
  if (!/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/.test(slug) || slug === "www") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/s/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Only page requests; API calls, Next assets and static files are served as usual.
  matcher: ["/((?!api|_next|vendor|bedaya|s/|favicon).*)"],
};
