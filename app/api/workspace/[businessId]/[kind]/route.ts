// Versioned drafts for one business (Launch Studio, Startup Services, saved location).
//   GET  /api/workspace/{businessId}/{kind}?item=logo[&version=3]
//        → { latest, approved, versions: [{ version, approved, created_at }] }  (or { data } for one version)
//   POST /api/workspace/{businessId}/{kind} { item?, data, approved? } → the saved version
// Every save is a new version, so the owner can always go back.
import { z } from "zod";
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ businessId: string; kind: string }> };
type Row = { id: string; version: number; data: unknown; approved: boolean; created_at: string; item: string };

async function setup(context: Context) {
  const { businessId, kind } = await context.params;
  const bid = Number(businessId);
  if (!Number.isInteger(bid) || bid <= 0 || !/^[a-z_]{2,40}$/.test(kind)) return { error: json({ error: "Not found." }, 404) };
  try {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    if (!data.user) return { error: json({ error: "Sign in first." }, 401) };
    return { db, bid, kind, userId: data.user.id };
  } catch {
    return { error: json({ error: "Service unavailable." }, 503) };
  }
}

export async function GET(request: Request, context: Context) {
  const s = await setup(context);
  if ("error" in s) return s.error;
  const url = new URL(request.url);
  const item = (url.searchParams.get("item") || "").slice(0, 80);
  const version = Number(url.searchParams.get("version") || 0);
  const query = s.db.from("bedaya_workspace").select("id, version, data, approved, created_at, item").eq("business_id", s.bid).eq("kind", s.kind).eq("item", item);
  if (version > 0) {
    const { data } = await query.eq("version", version).maybeSingle();
    return data ? json({ data }) : json({ error: "Version not found." }, 404);
  }
  const { data, error } = await query.order("version", { ascending: false }).limit(50);
  if (error) return json({ error: "Could not load drafts." }, 500);
  const rows = (data ?? []) as Row[];
  return json({
    latest: rows[0] ?? null,
    approved: rows.find((r) => r.approved) ?? null,
    versions: rows.map(({ version: v, approved, created_at }) => ({ version: v, approved, created_at })),
  });
}

export async function POST(request: Request, context: Context) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const s = await setup(context);
  if ("error" in s) return s.error;
  const parsed = z
    .object({ item: z.string().max(80).optional(), data: z.unknown(), approved: z.boolean().optional() })
    .strict()
    .safeParse(await readObject(request, 400000));
  if (!parsed.success || parsed.data.data === undefined) return json({ error: "Send { item?, data, approved? } (max 400 KB)." }, 400);
  const { data, error } = await s.db.rpc("bedaya_workspace_save", {
    p_business: s.bid,
    p_kind: s.kind,
    p_item: parsed.data.item ?? "",
    p_data: parsed.data.data,
    p_approved: parsed.data.approved ?? false,
  });
  if (error) return json({ error: error.code === "42501" ? "This isn't your business." : "Could not save." }, error.code === "42501" ? 403 : 500);
  return json({ data }, 201);
}
