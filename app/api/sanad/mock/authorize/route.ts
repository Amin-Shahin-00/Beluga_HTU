// POST /api/sanad/mock/authorize
//   { action: "verify", nationalId, password }                → { nameAr, nameEn } for the consent screen
//   { action: "authorize", nationalId, password, scopes, return } → { redirect } to the SANAD callback
// MOCK ONLY: called by the mock SANAD page. Real SANAD does this on its own servers and redirects back with a code.
import { NextRequest, NextResponse } from "next/server";
import { getMockSanad, sanadMode } from "../../../../../lib/integrations/sanad";
import type { SanadScope } from "../../../../../lib/integrations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES: SanadScope[] = ["identity", "contact", "address"];

export async function POST(req: NextRequest) {
  if (sanadMode() !== "mock") return NextResponse.json({ error: "Mock SANAD is off" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; nationalId?: string; password?: string; scopes?: SanadScope[]; return?: string };
  const nationalId = String(body.nationalId ?? "").trim();
  const password = String(body.password ?? "");
  if (!/^\d{10}$/.test(nationalId) || !password) return NextResponse.json({ error: "Enter a 10-digit national ID and your SANAD password." }, { status: 400 });
  try {
    if (body.action === "verify") return NextResponse.json(getMockSanad().verify(nationalId, password));
    const scopes = (body.scopes ?? []).filter((s) => SCOPES.includes(s));
    if (!scopes.length) return NextResponse.json({ error: "No data was requested." }, { status: 400 });
    // Only same-site return paths are allowed.
    const returnUrl = typeof body.return === "string" && body.return.startsWith("/") && !body.return.startsWith("//") ? body.return : "/";
    const code = getMockSanad().authorize(nationalId, scopes, password);
    return NextResponse.json({ redirect: `/api/sanad/callback?${new URLSearchParams({ code, return: returnUrl })}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
