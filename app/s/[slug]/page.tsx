// A published Bedaya website (D3): Bedaya's own template (SiteView) filled with the owner's JSON.
// Reachable at /s/<slug> and at <slug>.<site domain> (see proxy.ts).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteSchema, type Site } from "@/lib/studio/site";
import SiteView from "./SiteView";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> };

async function load(slug: string): Promise<Site | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  try {
    const db = await createClient();
    const { data } = await db.rpc("bedaya_get_site", { p_slug: slug });
    const row = Array.isArray(data) ? data[0] : null;
    const parsed = row ? siteSchema.safeParse(row.data) : null;
    return parsed?.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await load((await params).slug);
  return site ? { title: `${site.name.en || site.name.ar} | ${site.name.ar || site.name.en}`, description: site.hero.subtitle.en || site.hero.subtitle.ar } : { title: "Site not found" };
}

export default async function PublicSite({ params, searchParams }: Props) {
  const { slug } = await params;
  const site = await load(slug);
  if (!site) notFound();
  return <SiteView site={site} slug={slug} lang={(await searchParams).lang === "en" ? "en" : "ar"} />;
}