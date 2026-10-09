import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Route Handlers only: refresh cookies here, and verify identity in each route.
export async function createClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}
