// Saved assistant conversations (signed-in owners only; each person sees only their own).
//   GET    /api/ai/chats          → { data: [{ id, title, updated_at, turns }] } newest first
//   GET    /api/ai/chats/{id}     → { data: { id, title, messages } }
//   POST   /api/ai/chats          { title, messages } → { id }
//   PUT    /api/ai/chats/{id}     { title?, messages } → ok
//   DELETE /api/ai/chats/{id}
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id?: string[] }> };

const messages = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(80);
const uuid = z.string().uuid();

async function setup(request: Request, context: Context) {
  if (request.method !== "GET") {
    const rejected = checkMutation(request);
    if (rejected) return { error: rejected };
  }
  const id = (await context.params).id?.[0];
  if (id !== undefined && !uuid.safeParse(id).success) return { error: json({ error: "Not found." }, 404) };
  try {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    if (!data.user) return { error: json({ error: "Sign in to keep your conversations." }, 401) };
    return { db, id, userId: data.user.id };
  } catch {
    return { error: json({ error: "Service unavailable." }, 503) };
  }
}

export async function GET(request: Request, context: Context) {
  const s = await setup(request, context);
  if ("error" in s) return s.error;
  if (s.id) {
    const { data } = await s.db.from("bedaya_chats").select("id, title, messages").eq("id", s.id).maybeSingle();
    return data ? json({ data }) : json({ error: "Not found." }, 404);
  }
  const { data } = await s.db.from("bedaya_chats").select("id, title, updated_at, messages").order("updated_at", { ascending: false }).limit(50);
  return json({ data: (data ?? []).map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, turns: Array.isArray(c.messages) ? c.messages.length : 0 })) });
}

export async function POST(request: Request, context: Context) {
  const s = await setup(request, context);
  if ("error" in s) return s.error;
  const v = z.object({ title: z.string().max(120), messages }).safeParse(await readObject(request, 220_000));
  if (!v.success) return json({ error: "Invalid conversation." }, 400);
  const { data, error } = await s.db.from("bedaya_chats").insert({ user_id: s.userId, title: v.data.title, messages: v.data.messages }).select("id").single();
  return error ? json({ error: "Could not save." }, 500) : json({ id: data.id }, 201);
}

export async function PUT(request: Request, context: Context) {
  const s = await setup(request, context);
  if ("error" in s) return s.error;
  if (!s.id) return json({ error: "Not found." }, 404);
  const v = z.object({ title: z.string().max(120).optional(), messages }).safeParse(await readObject(request, 220_000));
  if (!v.success) return json({ error: "Invalid conversation." }, 400);
  const { data, error } = await s.db
    .from("bedaya_chats")
    .update({ messages: v.data.messages, ...(v.data.title !== undefined ? { title: v.data.title } : {}), updated_at: new Date().toISOString() })
    .eq("id", s.id)
    .select("id")
    .maybeSingle();
  if (error) return json({ error: "Could not save." }, 500);
  return data ? json({ ok: true }) : json({ error: "Not found." }, 404);
}

export async function DELETE(request: Request, context: Context) {
  const s = await setup(request, context);
  if ("error" in s) return s.error;
  if (!s.id) return json({ error: "Not found." }, 404);
  await s.db.from("bedaya_chats").delete().eq("id", s.id);
  return json({ ok: true });
}
