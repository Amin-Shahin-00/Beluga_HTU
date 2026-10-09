// GET /api/account/me → who is logged in: account, role and linked SANAD identity.
// It also keeps the SANAD session (used by documents, forms and signing) pointed at this account's own
// national ID, so a previous person's SANAD session can never show up in another account.
import { accountContext, accountForNationalId, bindSanadSession, pendingSanad } from "@/lib/account";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await accountContext();
  let pending = await pendingSanad();
  if (ctx.account) {
    if (ctx.identity) {
      if (pending?.nationalId !== ctx.identity.nationalId) await bindSanadSession(ctx.identity.nationalId, ctx.identity.verified);
      pending = null;
    } else if (pending && (await linkedElsewhere(pending.nationalId))) {
      // Another person's SANAD session: drop it.
      await bindSanadSession(null);
      pending = null;
    }
  }
  return json({ ...ctx, pendingSanad: pending ? { nationalId: pending.nationalId, user: pending.user } : null });
}

async function linkedElsewhere(nationalId: string) {
  try {
    return (await accountForNationalId(nationalId)) !== null;
  } catch {
    return true; // can't check: treat as not ours
  }
}
