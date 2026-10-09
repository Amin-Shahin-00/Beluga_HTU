// Experts and their own availability (separate from funding/partner appointment slots).
//   GET    /api/experts                         experts with their number of free slots
//   GET    /api/experts/{key}/slots             that expert's free future slots (only theirs)
//   POST   /api/experts/{key}/book              { slotId, businessId } → book (409 if just taken)
//   GET    /api/experts/bookings                the owner's expert bookings
//   POST   /api/experts/bookings/{slotId}/cancel
//   GET    /api/experts/me                      the signed-in expert's profile, slots and bookings
//   POST   /api/experts/me/slots                { startsAt, minutes } → add availability
//   DELETE /api/experts/me/slots/{slotId}       remove a free slot
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
type Slot = { id: string; expert_key: string; starts_at: string; duration_minutes: number; status: string; booked_by: string | null; business_id: number | null };

function dbError(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  if (error.code === "P0001" || /unavailable/i.test(error.message || "")) return json({ error: "That slot was just booked by someone else. Pick another." }, 409);
  if (error.code === "23505") return json({ error: "You already have a slot at that time." }, 409);
  if (error.code === "42501") return json({ error: "You can't change this." }, 403);
  return json({ error: error.message?.includes("future") ? "Choose a time in the future." : "The operation could not be completed." }, 400);
}

async function handler(request: Request, context: Context) {
  if (request.method !== "GET") {
    const rejected = checkMutation(request);
    if (rejected) return rejected;
  }
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: "Sign in first." }, 401);
  const path = (await context.params).path ?? [];
  const route = path.join("/");
  const now = new Date().toISOString();

  if (route === "" && request.method === "GET") return listExperts();
  if (path[0] === "me") {
    const { data: me } = await db.from("bedaya_experts").select("*").eq("user_id", auth.user.id).maybeSingle();
    if (!me) return json({ error: "This account isn't an expert." }, 403);
    if (path.length === 1 && request.method === "GET") {
      const { data } = await db.from("bedaya_expert_slots").select("*").eq("expert_key", me.key).gte("starts_at", new Date(Date.now() - 864e5).toISOString()).order("starts_at");
      return json({ expert: me, slots: data ?? [] });
    }
    if (path[1] === "slots" && path.length === 2 && request.method === "POST") {
      const input = validate(z.object({ startsAt: z.string().datetime({ offset: true }), minutes: z.number().int().min(15).max(240) }).strict(), await readObject(request));
      if ("error" in input) return input.error;
      const { data, error } = await db.rpc("bedaya_expert_add_slot", { p_starts: input.value.startsAt, p_minutes: input.value.minutes });
      return dbError(error) ?? json({ id: data }, 201);
    }
    if (path[1] === "slots" && path.length === 3 && request.method === "DELETE") {
      const { error } = await db.rpc("bedaya_expert_remove_slot", { p_slot: path[2] });
      return dbError(error) ?? json({ message: "Slot removed." });
    }
  }
  if (path[0] === "bookings" && path.length === 1 && request.method === "GET") {
    const { data } = await db.from("bedaya_expert_slots").select("*").eq("booked_by", auth.user.id).order("starts_at");
    return json({ data: data ?? [] });
  }
  if (path[0] === "bookings" && path[2] === "cancel" && request.method === "POST") {
    const { error } = await db.rpc("bedaya_cancel_expert", { p_slot: path[1] });
    return dbError(error) ?? json({ message: "Booking cancelled." });
  }
  if (path.length === 2 && path[1] === "slots" && request.method === "GET") {
    const { data } = await db.from("bedaya_expert_slots").select("id, expert_key, starts_at, duration_minutes, status").eq("expert_key", path[0]).eq("status", "open").gt("starts_at", now).order("starts_at");
    return json({ data: (data ?? []) as Partial<Slot>[] });
  }
  if (path.length === 2 && path[1] === "book" && request.method === "POST") {
    const input = validate(z.object({ slotId: z.string().uuid(), businessId: z.number().int().positive() }).strict(), await readObject(request));
    if ("error" in input) return input.error;
    const { data: slot } = await db.from("bedaya_expert_slots").select("expert_key").eq("id", input.value.slotId).maybeSingle();
    if (!slot || slot.expert_key !== path[0]) return json({ error: "That slot doesn't belong to this expert." }, 400);
    const { error } = await db.rpc("bedaya_book_expert", { p_slot: input.value.slotId, p_business: input.value.businessId });
    return dbError(error) ?? json({ message: "Booked.", slotId: input.value.slotId }, 201);
  }
  return json({ error: "Not found." }, 404);

  async function listExperts() {
    const [{ data: experts }, { data: slots }] = await Promise.all([
      db.from("bedaya_experts").select("key, name_ar, name_en, title_ar, title_en, fee_jod, is_demo").order("name_en"),
      db.from("bedaya_expert_slots").select("expert_key").eq("status", "open").gt("starts_at", now),
    ]);
    const free = new Map<string, number>();
    for (const s of slots ?? []) free.set(s.expert_key, (free.get(s.expert_key) ?? 0) + 1);
    return json({ data: (experts ?? []).map((e) => ({ ...e, freeSlots: free.get(e.key) ?? 0 })) });
  }
}

function validate<T>(schema: z.ZodType<T>, value: unknown): { value: T } | { error: Response } {
  const parsed = schema.safeParse(value);
  return parsed.success ? { value: parsed.data } : { error: json({ error: "Check the details and try again." }, 400) };
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
