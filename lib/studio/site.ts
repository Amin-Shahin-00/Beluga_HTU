// Website builder content (D3). The model only ever returns JSON that fills Bedaya's own template;
// it never writes HTML. Every result is validated against this schema before it is saved or shown.
import { z } from "zod";
import { generate, parseJson } from "@/lib/integrations/llm";
import type { Sector } from "@/lib/integrations/types";

const text = (max: number) => z.string().max(max).default("");
const bi = (max: number) => z.object({ en: text(max), ar: text(max) }).default({ en: "", ar: "" });

export const siteSchema = z.object({
  kind: z.enum(["site", "store"]).default("site"),
  name: bi(80),
  hero: z.object({ title: bi(120), subtitle: bi(240), cta: bi(40) }),
  about: z.object({ title: bi(80), body: bi(1200) }),
  products: z
    .array(z.object({ name: bi(80), description: bi(300), price: z.number().min(0).max(100000).nullable().default(null) }))
    .max(24)
    .default([]),
  gallery: z.array(z.object({ caption: bi(80), image: z.string().max(90000).regex(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/).default("") })).max(6).default([]),
  contact: z.object({
    phone: text(30),
    whatsapp: z.string().max(20).regex(/^\d*$/).default(""),
    email: z.string().max(120).default(""),
    address: bi(200),
    hours: bi(120),
  }),
  map: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().default(null),
  sections: z.object({ about: z.boolean(), products: z.boolean(), gallery: z.boolean(), map: z.boolean(), contact: z.boolean() }).default({ about: true, products: true, gallery: true, map: true, contact: true }),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    dark: z.string().regex(/^#[0-9a-f]{6}$/i),
    light: z.string().regex(/^#[0-9a-f]{6}$/i),
    fontArabic: z.string().max(40),
    fontLatin: z.string().max(40),
    logo: z.string().max(60000).default(""),
  }),
});
export type Site = z.infer<typeof siteSchema>;

export interface SiteSeed {
  sector: Sector;
  description: string;
  descriptionAr?: string;
  customers: string;
  city: string;
  phone: string;
  email: string;
  brand: { name: { en: string; ar: string }; palette: { hex: string; role: string }[]; fonts: { arabic: string; latin: string }; logo?: string; tone?: { en: string; ar: string } };
  location: { address: string; lat: number; lng: number } | null;
}

const PRODUCTS: Record<Sector, [string, string, number][]> = {
  food: [["Ma'amoul box", "علبة معمول", 6], ["Knafeh tray", "صينية كنافة", 12], ["Za'atar manaqish (6)", "مناقيش زعتر (6)", 3]],
  retail: [["Gift basket", "سلة هدايا", 15], ["Everyday essentials", "مستلزمات يومية", 5], ["Seasonal offer", "عرض الموسم", 10]],
  crafts: [["Embroidered cushion", "مخدة مطرزة", 18], ["Handwoven bag", "حقيبة منسوجة يدوياً", 25], ["Pottery cup", "كوب فخار", 7]],
  services: [["First consultation", "الاستشارة الأولى", 15], ["Monthly package", "الباقة الشهرية", 60], ["One-off job", "مهمة لمرة واحدة", 30]],
  tech: [["Starter plan", "الباقة الأساسية", 9], ["Business plan", "باقة الأعمال", 29], ["Custom setup", "إعداد مخصص", 99]],
  agriculture: [["Olive oil (1 L)", "زيت زيتون (1 لتر)", 8], ["Seasonal vegetable box", "صندوق خضار موسمي", 7], ["Local honey", "عسل بلدي", 12]],
  tourism: [["Half-day tour", "جولة نصف يوم", 35], ["Overnight camp", "مبيت في المخيم", 60], ["Traditional dinner", "عشاء تقليدي", 15]],
};

export function draftSite(s: SiteSeed): Site {
  const pal = Object.fromEntries(s.brand.palette.map((p) => [p.role, p.hex])) as Record<string, string>;
  const store = ["retail", "food", "crafts", "agriculture"].includes(s.sector);
  const wa = s.phone.replace(/\D/g, "").replace(/^0/, "962");
  return siteSchema.parse({
    kind: store ? "store" : "site",
    name: s.brand.name,
    hero: {
      title: { en: s.brand.name.en, ar: s.brand.name.ar },
      subtitle: { en: s.description.slice(0, 200), ar: (s.descriptionAr || s.description).slice(0, 200) },
      cta: store ? { en: "Order on WhatsApp", ar: "اطلب عبر واتساب" } : { en: "Get in touch", ar: "تواصل معنا" },
    },
    about: {
      title: { en: "About us", ar: "من نحن" },
      body: {
        en: `${s.brand.name.en} is a ${s.sector} business in ${s.city}. ${s.description} We serve ${s.customers}`.slice(0, 1200),
        ar: `${s.brand.name.ar} مشروع في ${s.city}. ${s.descriptionAr || s.description}`.slice(0, 1200),
      },
    },
    products: PRODUCTS[s.sector].map(([en, ar, price]) => ({ name: { en, ar }, description: { en: "", ar: "" }, price })),
    gallery: [
      { caption: { en: "Our work", ar: "من أعمالنا" }, image: "" },
      { caption: { en: "Made with care", ar: "صنع بعناية" }, image: "" },
      { caption: { en: "Visit us", ar: "زورونا" }, image: "" },
    ],
    contact: { phone: s.phone, whatsapp: wa, email: s.email, address: { en: s.location?.address || s.city, ar: s.location?.address || s.city }, hours: { en: "Sat–Thu, 9:00–18:00", ar: "السبت–الخميس، 9:00–18:00" } },
    map: s.location ? { lat: s.location.lat, lng: s.location.lng } : null,
    theme: { primary: pal.primary, accent: pal.accent, dark: pal.dark, light: pal.light, fontArabic: s.brand.fonts.arabic, fontLatin: s.brand.fonts.latin, logo: s.brand.logo || "" },
  });
}

// ---------------------------------------------------------------- chat edits
// Offline editor for common requests (English or Arabic). The real model handles everything else.
function ruleEdit(site: Site, instruction: string): { site: Site; reply: { en: string; ar: string } } | null {
  const next: Site = structuredClone(site);
  const q = instruction.trim();
  const quoted = (q.match(/"([^"]{1,200})"/) || q.match(/“([^”]{1,200})”/) || q.match(/«([^»]{1,200})»/) || q.match(/'([^']{1,200})'/))?.[1];
  const isAr = /[؀-ۿ]/.test(quoted ?? q);
  const lang = isAr ? "ar" : "en";
  const ok = (en: string, ar: string) => ({ site: next, reply: { en, ar } });

  const section = (re: RegExp, key: keyof Site["sections"]) => {
    if (!re.test(q)) return null;
    const off = /(remove|hide|delete|without|احذف|أخف|اخف|إزالة|ازالة|بدون)/i.test(q);
    const on = /(add|show|include|أضف|اضف|أظهر|اظهر)/i.test(q);
    if (!off && !on) return null;
    next.sections[key] = !off;
    return ok(`${off ? "Hidden" : "Showing"} the ${key} section.`, `${off ? "تم إخفاء" : "تم إظهار"} قسم ${key}.`);
  };
  for (const [re, key] of [
    [/gallery|معرض|صور/i, "gallery"],
    [/\bmap\b|خريطة/i, "map"],
    [/products?|menu|المنتجات|منتجات|القائمة/i, "products"],
    [/about|من نحن/i, "about"],
    [/contact form|contact|تواصل/i, "contact"],
  ] as const) {
    const done = section(re, key);
    if (done) return done;
  }
  if (quoted && /(title|headline|heading|عنوان)/i.test(q)) {
    next.hero.title[lang] = quoted;
    return ok("Updated the headline.", "تم تحديث العنوان الرئيسي.");
  }
  if (quoted && /(subtitle|tagline|slogan|شعار|وصف)/i.test(q)) {
    next.hero.subtitle[lang] = quoted;
    return ok("Updated the tagline.", "تم تحديث الشعار.");
  }
  if (quoted && /(button|cta|زر)/i.test(q)) {
    next.hero.cta[lang] = quoted;
    return ok("Updated the button.", "تم تحديث الزر.");
  }
  const add = q.match(/(?:add|أضف|اضف)\s+(?:a\s+)?(?:product|item|منتج)?\s*["“«']?([^"”»'\d]{2,60}?)["”»']?\s*(?:for|at|ب|بسعر|price)?\s*(\d+(?:\.\d+)?)\s*(?:jod|jd|دينار)?/i);
  if (add) {
    const name = add[1].trim();
    next.products.push({ name: { en: isAr ? "" : name, ar: isAr ? name : "" }, description: { en: "", ar: "" }, price: Number(add[2]) });
    return ok(`Added "${name}" for ${add[2]} JOD.`, `تمت إضافة "${name}" بسعر ${add[2]} دينار.`);
  }
  const price = q.match(/(?:price of|سعر)\s+["“«']?(.+?)["”»']?\s+(?:to|=|إلى|الى|ليصبح)\s*(\d+(?:\.\d+)?)/i);
  if (price) {
    const p = next.products.find((x) => x.name.en.toLowerCase().includes(price[1].toLowerCase()) || x.name.ar.includes(price[1]));
    if (p) {
      p.price = Number(price[2]);
      return ok(`Price updated to ${price[2]} JOD.`, `تم تحديث السعر إلى ${price[2]} دينار.`);
    }
  }
  const hours = q.match(/(?:hours|opening|ساعات|أوقات الدوام|اوقات الدوام)\D*(.+)$/i);
  if (hours && /\d/.test(hours[1])) {
    next.contact.hours[lang] = hours[1].trim().slice(0, 120);
    return ok("Updated the opening hours.", "تم تحديث ساعات العمل.");
  }
  if (/(store|shop|متجر)/i.test(q) && /(make|turn|switch|حوّل|حول|اجعل)/i.test(q)) {
    next.kind = "store";
    next.sections.products = true;
    return ok("Switched to an online store layout.", "تم التحويل إلى تصميم متجر إلكتروني.");
  }
  if (/(darker|أغمق|اغمق)/i.test(q)) {
    next.theme.primary = shade(next.theme.primary, -0.18);
    return ok("Made the main colour darker.", "تم جعل اللون الرئيسي أغمق.");
  }
  if (/(lighter|brighter|أفتح|افتح)/i.test(q)) {
    next.theme.primary = shade(next.theme.primary, 0.18);
    return ok("Made the main colour lighter.", "تم جعل اللون الرئيسي أفتح.");
  }
  return null;
}
function shade(hex: string, amount: number) {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).map((c) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount));
  return `#${n.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

export async function editSite(site: Site, instruction: string, tone?: string) {
  const rule = ruleEdit(site, instruction);
  const res = await generate({
    task: "studio_site_edit",
    system:
      "You edit a small business website stored as JSON. Apply the owner's request and reply with JSON only: {\"site\": <the full updated JSON, same shape>, \"reply\": {\"en\": \"one short sentence\", \"ar\": \"the same in Arabic\"}}. Never add HTML, scripts or links; text fields are plain text. Keep both Arabic and English filled in. " +
      (tone ? `Brand voice: ${tone}` : ""),
    messages: [{ role: "user", content: `Website JSON:\n${JSON.stringify({ ...site, gallery: site.gallery.map((g) => ({ ...g, image: g.image ? "[image]" : "" })), theme: { ...site.theme, logo: site.theme.logo ? "[logo]" : "" } })}\n\nRequest: ${instruction.slice(0, 500)}` }],
    fallback: () =>
      JSON.stringify(rule ?? { site, reply: { en: "I couldn't do that offline. Try: change the title to \"…\", add product \"…\" 5, hide the gallery, make it darker, or edit the text directly.", ar: "تعذر تنفيذ ذلك دون اتصال. جرّب: غيّر العنوان إلى \"…\"، أضف منتج \"…\" 5، أخفِ المعرض، اجعله أغمق، أو عدّل النص مباشرة." }, unchanged: true }),
    maxTokens: 4000,
    timeoutMs: 30000,
  });
  const parsed = parseJson<{ site?: unknown; reply?: { en?: string; ar?: string }; unchanged?: boolean }>(res.text);
  if (parsed?.site) {
    // The model never sees images or the logo, so they are carried over from the current version.
    const candidate = parsed.site as Site;
    const restored = { ...candidate, gallery: (candidate.gallery || []).map((g, i) => ({ ...g, image: site.gallery[i]?.image ?? "" })), theme: { ...candidate.theme, logo: site.theme.logo } };
    const checked = siteSchema.safeParse(restored);
    if (checked.success) return { site: checked.data, reply: { en: String(parsed.reply?.en ?? "Done."), ar: String(parsed.reply?.ar ?? "تم.") }, changed: !parsed.unchanged, source: res.source };
  }
  return rule ? { ...rule, changed: true, source: "mock" as const } : { site, reply: { en: "I couldn't apply that. Try rephrasing, or edit the text directly.", ar: "تعذر تطبيق ذلك. جرّب صياغة أخرى أو عدّل النص مباشرة." }, changed: false, source: res.source };
}
