import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the secret key. Used for exactly two things:
 * 1. opening the Bedaya account linked to a verified SANAD identity (no password involved), and
 * 2. writing the account ↔ national-ID link, which users must never be able to write themselves.
 * Returns null when SUPABASE_SECRET_KEY isn't configured. Never import this from client code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
