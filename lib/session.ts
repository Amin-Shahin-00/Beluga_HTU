// Minimal session for the demo: an httpOnly cookie holding the national ID.
// M4 replaces this with Supabase auth; route handlers only call these helpers.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "bedaya_uid";

export async function currentUserId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Returns the national ID, or a 401 response to return from the route. */
export async function requireUser(): Promise<{ id: string } | { error: NextResponse }> {
  const id = await currentUserId();
  if (!id) return { error: NextResponse.json({ error: "Not signed in. Use Login with SANAD." }, { status: 401 }) };
  return { id };
}

export function setSession(res: NextResponse, nationalId: string) {
  res.cookies.set(SESSION_COOKIE, nationalId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

// ---------------------------------------------------------------- staff (MOCK)
// Staff dashboards: a government office, SANAD/MoDEE, or the Bedaya team.
// MOCK: anyone can pick a role on the dashboard. In real life each party signs
// in through its own system (government staff accounts, MoDEE, Bedaya admin auth).

export const STAFF_COOKIE = "bedaya_staff";
/** gov:<OfficeKey> (offices.ts, M1's office ids), then SANAD/MoDEE and the Bedaya team. */
export const STAFF_ROLES = ["gov:MIT", "gov:CCD", "gov:GAM", "gov:IRBID", "gov:ISTD", "gov:JFDA", "sanad", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export async function currentStaff(): Promise<StaffRole | null> {
  const role = (await cookies()).get(STAFF_COOKIE)?.value ?? "";
  return isStaffRole(role) ? role : null;
}

/** Returns the staff role, or a 401/403 response when the role doesn't pass `allowed`. */
export async function requireStaff(allowed: (role: StaffRole) => boolean): Promise<{ role: StaffRole } | { error: NextResponse }> {
  const role = await currentStaff();
  if (!role) return { error: NextResponse.json({ error: "Staff sign-in required (mock)." }, { status: 401 }) };
  if (!allowed(role)) return { error: NextResponse.json({ error: "Your role can't open this." }, { status: 403 }) };
  return { role };
}

export function setStaffSession(res: NextResponse, role: StaffRole) {
  res.cookies.set(STAFF_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}

export function clearStaffSession(res: NextResponse) {
  res.cookies.delete(STAFF_COOKIE);
  return res;
}
