import { createClient } from "@/lib/supabase/server";
import { checkMutation, json, readObject } from "@/lib/http";
import { bindSanadSession, clearAllSessions } from "@/lib/account";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Sign in first." }, 401);
    return json({ user: { id: user.id, email: user.email } });
  } catch { return json({ error: "Service unavailable." }, 503); }
}
export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const input = await readObject(request);
  if (!input) return json({ error: "Invalid JSON object." }, 400);
  try {
    const supabase = await createClient();
    if (input.action === "signout") {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      await clearAllSessions();
      return error ? json({ error: "Could not sign out." }, 500) : json({ message: "Signed out." });
    }
    if (!["signin", "signup"].includes(String(input.action))) return json({ error: "Invalid action." }, 400);
    const { email, password } = input;
    const minPasswordLength = input.action === "signup" ? 8 : 1;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof password !== "string" || password.length < minPasswordLength || password.length > 128) return json({ error: "Use a valid email and password. New passwords need at least 8 characters." }, 400);
    if (input.action === "signup") {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return json({ error: "Could not register. Check password requirements or try later." }, 400);
      return json({ message: "Check your email to confirm your account, then sign in." }, 202);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return json({ error: "Incorrect credentials or email not confirmed." }, 401);
    // The SANAD session (documents, forms, signing) must belong to this account, never to whoever used the browser before.
    const { data: identity } = await supabase.from("bedaya_identities").select("national_id, verified").eq("user_id", data.user.id).maybeSingle();
    const linked = identity as { national_id: string; verified: Record<string, { value: unknown; source: string }> } | null;
    await bindSanadSession(linked?.national_id ?? null, linked?.verified);
    return json({ user: { id: data.user.id, email: data.user.email } });
  } catch { return json({ error: "Service unavailable." }, 503); }
}
