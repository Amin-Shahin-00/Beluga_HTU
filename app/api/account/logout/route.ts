// POST /api/account/logout {} → ends everything: the Supabase account session, the SANAD session and any staff session.
import { clearAllSessions } from "@/lib/account";
import { checkMutation, json } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) await (await createClient()).auth.signOut({ scope: "local" });
  } catch {
    /* the cookies below are cleared regardless */
  }
  await clearAllSessions();
  return json({ message: "Signed out." });
}
