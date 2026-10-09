// POST /api/account/sanad {} → after "Login with SANAD": open the Bedaya account linked to that national ID.
//   200 { status: "signed_in" }           the linked account is now signed in
//   200 { status: "linked" }              the signed-in account had no SANAD link; it's linked now
//   200 { status: "needs_account", user } no account yet: show "Create account with SANAD"
import { accountContext, accountForNationalId, bindSanadSession, linkIdentity, pendingSanad, signInLinkedAccount } from "@/lib/account";
import { checkMutation, json } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const pending = await pendingSanad();
  if (!pending) return json({ error: "Sign in with SANAD first." }, 401);
  try {
    const linked = await accountForNationalId(pending.nationalId);
    const ctx = await accountContext();
    if (linked) {
      if (ctx.account?.id !== linked.userId) {
        // Leave whichever account was open, then open the one this identity belongs to.
        if (ctx.account) await (await createClient()).auth.signOut({ scope: "local" });
        await signInLinkedAccount(linked.email);
      }
      await bindSanadSession(pending.nationalId);
      return json({ status: "signed_in" });
    }
    if (ctx.account && !ctx.identity) {
      await linkIdentity(ctx.account.id, pending.nationalId, pending.user);
      return json({ status: "linked" });
    }
    if (ctx.account && ctx.identity) {
      // Signed in as someone else: this SANAD person has no account yet, so sign the other account out.
      await (await createClient()).auth.signOut({ scope: "local" });
    }
    return json({ status: "needs_account", user: pending.user });
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
}
