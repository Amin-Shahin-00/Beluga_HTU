// POST /api/account/sanad-signup { email, password, consent: true }
// "Create account with SANAD": name, national ID, birth date, phone and address come from the
// verified SANAD record (never from the browser); the user only adds an email and password.
import { bindSanadSession, linkIdentity, pendingSanad, accountForNationalId } from "@/lib/account";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const input = await readObject(request);
  const pending = await pendingSanad();
  if (!pending) return json({ error: "Sign in with SANAD first." }, 401);
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (input?.consent !== true) return json({ error: "Please agree to use your SANAD data." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) {
    return json({ error: "Use a valid email and a password of at least 8 characters." }, 400);
  }
  try {
    if (await accountForNationalId(pending.nationalId)) return json({ error: "This SANAD identity already has an account. Use Login with SANAD." }, 409);
    const db = await createClient();
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: pending.user.fullNameEn.value, full_name_ar: pending.user.fullNameAr.value } },
    });
    // Supabase returns a user with no identities when the email is already registered.
    if (error || !data.user || data.user.identities?.length === 0) return json({ error: "That email can't be used. It may already have an account." }, 400);
    await linkIdentity(data.user.id, pending.nationalId, pending.user);
    if (!data.session) return json({ status: "confirm_email", message: "Check your email to confirm your account, then use Login with SANAD." }, 202);
    await bindSanadSession(pending.nationalId);
    return json({ status: "signed_in" }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
}
