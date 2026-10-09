import "server-only";
// One place that answers "who is logged in": the Supabase account, its role, and the SANAD identity
// linked to it. Every page reads this (GET /api/account/me); nothing is cached in the browser.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { find, insert } from "@/lib/integrations/store";
import type { SanadUser } from "@/lib/integrations/types";
import { SESSION_COOKIE, STAFF_COOKIE } from "@/lib/session";

export type Role = "owner" | "bank" | "incubator" | "expert" | "admin";

export interface AccountContext {
  backend: "ok" | "down";
  account: { id: string; email: string | null } | null;
  role: Role | null;
  partnerKey: string | null;
  expert: { key: string; name: { ar: string; en: string }; title: { ar: string; en: string } } | null;
  identity: { nationalId: string; verified: Record<string, { value: unknown; source: string }> } | null;
}

const SANAD_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };

type Verified = Record<string, { value: unknown; source: string }>;

/**
 * Points the SANAD session (used by documents, forms and signing) at this account's own national ID.
 * `verified` is the SANAD record saved on the account when it was linked; it restores the SANAD
 * record for sessions that started with email sign-in rather than a fresh SANAD login.
 */
export async function bindSanadSession(nationalId: string | null, verified?: Verified) {
  const jar = await cookies();
  if (!nationalId) {
    jar.delete(SESSION_COOKIE);
    return;
  }
  jar.set(SESSION_COOKIE, nationalId, SANAD_COOKIE_OPTIONS);
  if (verified && !find("sanad_sessions", (r) => r.nationalId === nationalId)) {
    const user = { nationalId, ...Object.fromEntries(Object.entries(verified).map(([k, f]) => [k, { value: f.value, source: "verified_by_sanad" }])) } as unknown as SanadUser;
    insert("sanad_sessions", { nationalId, user, receivedAt: new Date().toISOString() });
  }
}

export async function clearAllSessions() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(STAFF_COOKIE);
}

/** The national ID from the SANAD login that just happened (cookie set by the SANAD callback). */
export async function pendingSanad(): Promise<{ nationalId: string; user: SanadUser } | null> {
  const nationalId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!nationalId) return null;
  const row = find("sanad_sessions", (r) => r.nationalId === nationalId);
  return row ? { nationalId, user: row.user } : null;
}

/** SANAD fields stored on the account, each marked as verified by SANAD. */
export function verifiedFields(user: SanadUser) {
  const out: Record<string, { value: unknown; source: string }> = {};
  for (const [key, field] of Object.entries(user)) {
    if (key === "nationalId" || !field || typeof field !== "object") continue;
    out[key] = { value: (field as { value: unknown }).value, source: "verified_by_sanad" };
  }
  return out;
}

export async function accountContext(): Promise<AccountContext> {
  const empty: AccountContext = { backend: "ok", account: null, role: null, partnerKey: null, expert: null, identity: null };
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { ...empty, backend: "down" };
    db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return empty;
    const user = data.user;
    const [identity, member, expert] = await Promise.all([
      db.from("bedaya_identities").select("national_id, verified").eq("user_id", user.id).maybeSingle(),
      db.from("bedaya_members").select("role, partner_key").eq("user_id", user.id).maybeSingle(),
      db.from("bedaya_experts").select("key, name_ar, name_en, title_ar, title_en").eq("user_id", user.id).maybeSingle(),
    ]);
    const m = member.data as { role: string; partner_key: string | null } | null;
    const e = expert.data as { key: string; name_ar: string; name_en: string; title_ar: string; title_en: string } | null;
    const role: Role = m?.role === "admin" ? "admin" : m?.role === "expert" ? "expert" : m?.role === "partner" ? (m.partner_key === "bank-demo" || m.partner_key?.startsWith("bank") ? "bank" : "incubator") : "owner";
    const id = identity.data as { national_id: string; verified: Record<string, { value: unknown; source: string }> } | null;
    return {
      backend: "ok",
      account: { id: user.id, email: user.email ?? null },
      role,
      partnerKey: m?.partner_key ?? null,
      expert: e ? { key: e.key, name: { ar: e.name_ar, en: e.name_en }, title: { ar: e.title_ar, en: e.title_en } } : null,
      identity: id ? { nationalId: id.national_id, verified: id.verified } : null,
    };
  } catch {
    return { ...empty, backend: "down" };
  }
}

/** Finds the account linked to a national ID (server only). */
export async function accountForNationalId(nationalId: string): Promise<{ userId: string; email: string } | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  const { data } = await admin.from("bedaya_identities").select("user_id").eq("national_id", nationalId).maybeSingle();
  if (!data) return null;
  const { data: u } = await admin.auth.admin.getUserById(data.user_id);
  return u.user?.email ? { userId: data.user_id, email: u.user.email } : null;
}

/** Opens a session for the account linked to a verified SANAD identity. */
export async function signInLinkedAccount(email: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error("Could not open the linked account.");
  const db = await createClient();
  const verified = await db.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verified.error) throw new Error("Could not open the linked account.");
}

/** Links an account to a SANAD identity (server only, after a verified SANAD login). */
export async function linkIdentity(userId: string, nationalId: string, user: SanadUser) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  const { error } = await admin.from("bedaya_identities").insert({ user_id: userId, national_id: nationalId, verified: verifiedFields(user), provider: "mock_sanad" });
  if (error) throw new Error(error.code === "23505" ? "This SANAD identity or account is already linked." : "Could not link the SANAD identity.");
}
