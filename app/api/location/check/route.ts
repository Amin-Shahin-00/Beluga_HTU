// POST /api/location/check { businessId }
// Checks the location saved on the business (workspace "location") against the demo zoning map,
// using the business's own activity from its submitted profile.
import { checkMutation, json, readObject } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Zone = { name: string; nameAr: string; polygon: [number, number][]; activities: string[] };

/** Ray casting: is (lat, lng) inside the polygon? */
function inside(lat: number, lng: number, polygon: [number, number][]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ai, bi] = polygon[i];
    const [aj, bj] = polygon[j];
    if (bi > lng !== bj > lng && lat < ((aj - ai) * (lng - bi)) / (bj - bi) + ai) hit = !hit;
  }
  return hit;
}

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const input = await readObject(request);
  const bid = Number(input?.businessId);
  if (!Number.isInteger(bid) || bid <= 0) return json({ error: "businessId is required." }, 400);
  try {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return json({ error: "Sign in first." }, 401);
    const [loc, profile, catalog] = await Promise.all([
      db.from("bedaya_workspace").select("data").eq("business_id", bid).eq("kind", "location").eq("item", "").order("version", { ascending: false }).limit(1).maybeSingle(),
      db.from("bedaya_profiles").select("answers").eq("business_id", bid).maybeSingle(),
      db.from("bedaya_catalog").select("payload").eq("key", "location-demo").maybeSingle(),
    ]);
    const location = loc.data?.data as { address?: string; lat?: number; lng?: number } | undefined;
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") return json({ error: "Pick and save your location on the map first." }, 409);
    const activity = (profile.data?.answers as { business?: { sector?: string } } | undefined)?.business?.sector ?? "services";
    const zones = ((catalog.data?.payload as { zones?: Zone[] } | undefined)?.zones ?? []) as Zone[];
    const zone = zones.find((z) => inside(location.lat!, location.lng!, z.polygon)) ?? null;
    return json({
      location,
      activity,
      zone: zone ? { name: zone.name, nameAr: zone.nameAr, activities: zone.activities } : null,
      allowed: zone ? zone.activities.includes(activity) : null,
      zones,
      isDemo: true,
      disclaimer: "Fictional zoning areas for the demo; not an official municipal check. Confirm with your municipality.",
    });
  } catch {
    return json({ error: "Service unavailable." }, 503);
  }
}
