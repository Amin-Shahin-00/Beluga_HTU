// POST /api/sites/{slug}/message { name, contact, message } → a visitor's message to a published site.
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { slug } = await context.params;
  const v = z
    .object({ name: z.string().trim().min(1).max(120), contact: z.string().trim().min(3).max(160), message: z.string().trim().min(1).max(2000) })
    .safeParse(await readObject(request, 6000));
  if (!v.success || !/^[a-z0-9-]{3,40}$/.test(slug)) return json({ error: "Please fill in your name, how to reach you and a message." }, 400);
  try {
    const db = await createClient();
    const { error } = await db.rpc("bedaya_site_message", { p_slug: slug, p_name: v.data.name, p_contact: v.data.contact, p_message: v.data.message });
    if (error) return json({ error: "This site isn't accepting messages." }, 404);
    return json({ message: "Sent." }, 201);
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
}
