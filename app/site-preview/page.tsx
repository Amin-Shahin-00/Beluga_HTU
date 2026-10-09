"use client";
// Live preview for the Website builder. The builder (same origin) posts the draft JSON here and this
// page renders it with the same template as the published site. Nothing is saved or sent from here.
import { useEffect, useState } from "react";
import type { Site } from "@/lib/studio/site";
import SiteView from "../s/[slug]/SiteView";

export default function SitePreview() {
  const [state, setState] = useState<{ site: Site; lang: "ar" | "en" } | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "bedaya-site-preview") return;
      setState({ site: e.data.site as Site, lang: e.data.lang === "en" ? "en" : "ar" });
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "bedaya-site-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  if (!state) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Loading preview… · جارٍ تحميل المعاينة…</p>;
  return <SiteView site={state.site} slug="preview" lang={state.lang} preview />;
}
