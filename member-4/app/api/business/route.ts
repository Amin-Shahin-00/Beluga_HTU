
import { createClient } from "@/lib/supabase/server";
import { checkMutation, json, readObject } from "@/lib/http";
const columns = "id, name, type, city, status, created_at";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sign in first." }, 401);
    const { data, error } = await supabase.from("businesses").select(columns).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: "Could not load businesses." }, 500);
    return json({ data });
  } catch { return json({ error: "Service unavailable." }, 503); }
}
export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sign in first." }, 401);
    const input = await readObject(request);
    if (!input || Object.keys(input).some(key => !["name", "type", "city"].includes(key))) return json({ error: "Send only name, type, and city as a JSON object." }, 400);
    const fields: Record<string, string> = {};
    for (const field of ["name", "type", "city"]) {
      const value = input[field];
      if (typeof value !== "string" || !value.trim() || value.trim().length > 120) return json({ error: `${field} must contain 1–120 characters.` }, 400);
      fields[field] = value.trim();
    }
    const { data, error } = await supabase.from("businesses").insert({ ...fields, status: "New", user_id: user.id }).select(columns).single();
    if (error) return json({ error: "Could not save business. Check database setup." }, 500);
    return json({ data }, 201);
  } catch { return json({ error: "Service unavailable." }, 503); }
}
