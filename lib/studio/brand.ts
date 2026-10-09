// Brand kit generators for the AI Launch Studio (D1). Every generator asks the language model through
// generate() and has a deterministic fallback, so the studio works offline and without API keys.
import { generate, parseJson } from "@/lib/integrations/llm";
import type { Sector } from "@/lib/integrations/types";
import { sanitizeSvg } from "./svg";

export interface BrandInput {
  sector: Sector;
  city: string;
  description: string;
  nameEn?: string;
  nameAr?: string;
}
export interface NameIdea { en: string; ar: string; meaningEn: string; meaningAr: string }
export interface Swatch { hex: string; role: "primary" | "secondary" | "accent" | "dark" | "light" }
export interface Fonts { arabic: string; latin: string }
export interface Tone { en: string; ar: string; wordsEn: string[]; wordsAr: string[] }

export const ARABIC_FONTS = ["Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Reem Kufi", "Amiri"];
export const LATIN_FONTS = ["Inter", "Poppins", "Montserrat", "Nunito", "Lora", "Playfair Display", "Work Sans"];

// Small seeded random so "regenerate" gives a new but repeatable set.
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];
const context = (b: BrandInput) => `Activity: ${b.sector}. City: ${b.city}. Description: ${b.description.slice(0, 400)}`;

// ---------------------------------------------------------------- names
const WORDS: Record<Sector, [string, string, string, string][]> = {
  food: [
    ["Sukkar", "سكّر", "sugar: sweet and simple", "السكّر: حلاوة وبساطة"],
    ["Teen", "تين", "fig, a fruit of Jordan's hills", "التين، من ثمار جبال الأردن"],
    ["Zaatar", "زعتر", "thyme, the Levant's favourite herb", "الزعتر، عشبة بلاد الشام المحبوبة"],
    ["Hala", "هلا", "a warm Jordanian welcome", "ترحيب أردني دافئ"],
    ["Dafa", "دفا", "warmth, like a home kitchen", "الدفء، كمطبخ البيت"],
    ["Simsim", "سمسم", "sesame, small but full of flavour", "السمسم، صغير ومليء بالنكهة"],
    ["Nakha", "نكهة", "flavour", "النكهة"],
    ["Sufra", "سفرة", "the family table", "سفرة العائلة"],
  ],
  retail: [
    ["Souq", "سوق", "market", "السوق"],
    ["Dukkan", "دكّان", "the neighbourhood shop", "دكّان الحي"],
    ["Rukn", "ركن", "a corner you come back to", "ركن تعود إليه"],
    ["Wijha", "وجهة", "destination", "الوجهة"],
    ["Salla", "سلّة", "basket", "السلّة"],
    ["Bab", "باب", "a door that's always open", "باب مفتوح دائماً"],
    ["Rawaj", "رواج", "things people love to buy", "الرواج والإقبال"],
  ],
  crafts: [
    ["Noqta", "نقطة", "a dot, where every pattern starts", "النقطة، بداية كل نقش"],
    ["Khayt", "خيط", "thread", "الخيط"],
    ["Tatreez", "تطريز", "traditional embroidery", "التطريز التقليدي"],
    ["Yadawi", "يدوي", "handmade", "صنع يدوي"],
    ["Qasab", "قصب", "reed, used in weaving", "القصب المستخدم في الحياكة"],
    ["Fann", "فن", "art", "الفن"],
    ["Nool", "نول", "a weaving loom", "النول"],
  ],
  services: [
    ["Awn", "عون", "help", "العون والمساعدة"],
    ["Masar", "مسار", "path", "المسار"],
    ["Khutwa", "خطوة", "a step forward", "خطوة إلى الأمام"],
    ["Itqan", "إتقان", "mastery, work done right", "الإتقان والعمل المتقن"],
    ["Wasl", "وصل", "connection", "الوصل والتواصل"],
    ["Amana", "أمانة", "trust", "الأمانة"],
    ["Najm", "نجم", "star", "النجم"],
  ],
  tech: [
    ["Shifra", "شيفرة", "code", "الشيفرة"],
    ["Nabd", "نبض", "pulse", "النبض"],
    ["Jisr", "جسر", "bridge", "الجسر"],
    ["Fikra", "فكرة", "idea", "الفكرة"],
    ["Bunya", "بنية", "structure", "البنية"],
    ["Mada", "مدى", "range, reach", "المدى"],
    ["Raqam", "رقم", "digit", "الرقم"],
  ],
  agriculture: [
    ["Bayader", "بيادر", "threshing floors after the harvest", "البيادر بعد الحصاد"],
    ["Zaitoon", "زيتون", "olive, Jordan's oldest tree", "الزيتون، أقدم شجر الأردن"],
    ["Ghor", "غور", "the Jordan Valley, the country's garden", "الغور، سلة غذاء الأردن"],
    ["Sanabel", "سنابل", "ears of wheat", "سنابل القمح"],
    ["Ard", "أرض", "land", "الأرض"],
    ["Nabta", "نبتة", "a young plant", "النبتة"],
  ],
  tourism: [
    ["Rahhal", "رحّال", "traveller", "الرحّال"],
    ["Sahra", "صحراء", "the desert", "الصحراء"],
    ["Darb", "درب", "trail", "الدرب"],
    ["Nujoom", "نجوم", "stars over Wadi Rum", "نجوم وادي رم"],
    ["Diyafa", "ضيافة", "hospitality", "الضيافة"],
    ["Wadi", "وادي", "valley", "الوادي"],
  ],
};
const PATTERNS: [(w: string) => string, (w: string) => string, string, string][] = [
  [(w) => w, (w) => w, "", ""],
  [(w) => `Bayt ${w}`, (w) => `بيت ${w}`, "the house of ", "بيت "],
  [(w) => `${w} & Co.`, (w) => `${w} وشركاه`, "", ""],
  [(w) => `${w} Studio`, (w) => `استوديو ${w}`, "", ""],
  [(w) => `Dar ${w}`, (w) => `دار ${w}`, "the home of ", "دار "],
  [(w) => `${w} Lab`, (w) => `مختبر ${w}`, "", ""],
];

function fallbackNames(b: BrandInput, seed: number): NameIdea[] {
  const r = rng(seed + hash(b.description));
  const words = [...WORDS[b.sector]].sort(() => r() - 0.5);
  const out: NameIdea[] = [];
  if (seed === 0 && b.nameEn && b.nameAr) out.push({ en: b.nameEn, ar: b.nameAr, meaningEn: "the name you chose in your profile", meaningAr: "الاسم الذي اخترته في ملفك" });
  for (const [en, ar, mEn, mAr] of words) {
    if (out.length >= 6) break;
    const p = pick(r, PATTERNS);
    out.push({ en: p[0](en), ar: p[1](ar), meaningEn: `${p[2]}${mEn}`.replace(/^the house of (\w)/, "the house of $1"), meaningAr: `${p[3]}${mAr}` });
  }
  return out;
}

export async function nameIdeas(b: BrandInput, seed: number) {
  const res = await generate({
    task: "studio_names",
    system:
      "You name small Jordanian businesses. Reply with JSON only: {\"names\":[{\"en\":\"\",\"ar\":\"\",\"meaningEn\":\"\",\"meaningAr\":\"\"}]} with exactly 6 short, easy to say names. Each has an English spelling, the Arabic name, and a one-line meaning in English and Arabic. Avoid trademarks, government names and SANAD.",
    messages: [{ role: "user", content: `${context(b)}\nVariation: ${seed}` }],
    fallback: () => JSON.stringify({ names: fallbackNames(b, seed) }),
    maxTokens: 900,
  });
  const parsed = parseJson<{ names?: NameIdea[] }>(res.text)?.names;
  const ok = Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.en === "string" && typeof n.ar === "string").slice(0, 6) : [];
  return { names: ok.length >= 3 ? ok.map((n) => ({ en: n.en.slice(0, 60), ar: n.ar.slice(0, 60), meaningEn: String(n.meaningEn ?? "").slice(0, 160), meaningAr: String(n.meaningAr ?? "").slice(0, 160) })) : fallbackNames(b, seed), source: ok.length >= 3 ? res.source : "mock" };
}

// ---------------------------------------------------------------- palette
const HUES: Record<Sector, number[]> = { food: [18, 32, 350, 140], retail: [200, 330, 260, 12], crafts: [24, 175, 300, 45], services: [205, 160, 230, 190], tech: [250, 190, 280, 210], agriculture: [95, 120, 40, 75], tourism: [28, 195, 15, 45] };
function hsl(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};
function fallbackPalette(b: BrandInput, seed: number): Swatch[] {
  const r = rng(seed + hash(b.sector + b.city));
  const base = pick(r, HUES[b.sector]) + Math.round(r() * 20 - 10);
  const second = (base + 150 + Math.round(r() * 60)) % 360;
  return [
    { hex: hsl(base, 55 + r() * 20, 30 + r() * 8), role: "primary" },
    { hex: hsl(second, 40 + r() * 20, 45 + r() * 10), role: "secondary" },
    { hex: hsl((base + 40) % 360, 75 + r() * 15, 55 + r() * 8), role: "accent" },
    { hex: hsl(base, 20, 12 + r() * 6), role: "dark" },
    { hex: hsl(base, 35 + r() * 20, 95 + r() * 2), role: "light" },
  ];
}
const HEX = /^#[0-9a-f]{6}$/i;
export async function palette(b: BrandInput, seed: number) {
  const res = await generate({
    task: "studio_palette",
    system: "You design brand colour palettes. Reply with JSON only: {\"colors\":[\"#rrggbb\" x5]} in this order: primary, secondary, accent, dark text colour, light background. The dark colour must have at least 7:1 contrast on the light one.",
    messages: [{ role: "user", content: `${context(b)}\nVariation: ${seed}` }],
    fallback: () => JSON.stringify({ colors: fallbackPalette(b, seed).map((s) => s.hex) }),
    maxTokens: 200,
  });
  const colors = parseJson<{ colors?: string[] }>(res.text)?.colors;
  const roles: Swatch["role"][] = ["primary", "secondary", "accent", "dark", "light"];
  if (Array.isArray(colors) && colors.length === 5 && colors.every((c) => HEX.test(c))) return { palette: colors.map((hex, i) => ({ hex: hex.toLowerCase(), role: roles[i] })), source: res.source };
  return { palette: fallbackPalette(b, seed), source: "mock" as const };
}

// ---------------------------------------------------------------- fonts and tone
const TONES: Record<Sector, Tone> = {
  food: { en: "Warm, generous and homely. Speak like a neighbour who loves to cook: short sentences, sensory words, always welcoming.", ar: "دافئ وكريم وبيتي. تحدث كجار يحب الطبخ: جمل قصيرة وكلمات تثير الحواس وترحيب دائم.", wordsEn: ["warm", "fresh", "homemade"], wordsAr: ["دافئ", "طازج", "بيتي"] },
  retail: { en: "Friendly, clear and helpful. Lead with what the customer gets; keep prices and offers easy to find.", ar: "ودود وواضح ومفيد. ابدأ بما يحصل عليه الزبون واجعل الأسعار والعروض سهلة الإيجاد.", wordsEn: ["friendly", "clear", "good value"], wordsAr: ["ودود", "واضح", "قيمة جيدة"] },
  crafts: { en: "Proud, personal and story-led. Tell who made each piece and how; celebrate Jordanian heritage.", ar: "فخور وشخصي ويحكي القصص. اذكر من صنع كل قطعة وكيف، واحتفِ بالتراث الأردني.", wordsEn: ["handmade", "heritage", "personal"], wordsAr: ["يدوي", "تراث", "شخصي"] },
  services: { en: "Professional, reassuring and plain-spoken. Explain the outcome first; avoid jargon.", ar: "مهني ومطمئن وبسيط. اشرح النتيجة أولاً وتجنب المصطلحات المعقدة.", wordsEn: ["reliable", "clear", "on time"], wordsAr: ["موثوق", "واضح", "في الموعد"] },
  agriculture: { en: "Honest, earthy and proud of the land. Name where things grow and when they are picked.", ar: "صادق وقريب من الأرض وفخور بها. اذكر أين تنمو المنتجات ومتى تُقطف.", wordsEn: ["fresh", "local", "honest"], wordsAr: ["طازج", "محلي", "صادق"] },
  tourism: { en: "Inviting, vivid and hospitable. Paint the experience and make booking feel easy.", ar: "جذاب وحيوي ومضياف. صف التجربة واجعل الحجز سهلاً.", wordsEn: ["welcoming", "authentic", "memorable"], wordsAr: ["مرحّب", "أصيل", "لا يُنسى"] },
  tech: { en: "Confident, curious and simple. Show what the product does in one line; numbers over adjectives.", ar: "واثق وفضولي وبسيط. اعرض ما يفعله المنتج في سطر واحد، والأرقام قبل الصفات.", wordsEn: ["smart", "simple", "fast"], wordsAr: ["ذكي", "بسيط", "سريع"] },
};
const FONT_PAIRS: Record<Sector, Fonts[]> = {
  food: [{ arabic: "Tajawal", latin: "Nunito" }, { arabic: "Reem Kufi", latin: "Poppins" }, { arabic: "Amiri", latin: "Lora" }],
  retail: [{ arabic: "Cairo", latin: "Poppins" }, { arabic: "Almarai", latin: "Montserrat" }, { arabic: "Tajawal", latin: "Work Sans" }],
  crafts: [{ arabic: "Amiri", latin: "Playfair Display" }, { arabic: "Reem Kufi", latin: "Lora" }, { arabic: "Noto Kufi Arabic", latin: "Nunito" }],
  services: [{ arabic: "IBM Plex Sans Arabic", latin: "Inter" }, { arabic: "Cairo", latin: "Work Sans" }, { arabic: "Almarai", latin: "Inter" }],
  tech: [{ arabic: "IBM Plex Sans Arabic", latin: "Inter" }, { arabic: "Noto Kufi Arabic", latin: "Montserrat" }, { arabic: "Cairo", latin: "Poppins" }],
  agriculture: [{ arabic: "Tajawal", latin: "Nunito" }, { arabic: "Amiri", latin: "Lora" }, { arabic: "Almarai", latin: "Work Sans" }],
  tourism: [{ arabic: "Reem Kufi", latin: "Playfair Display" }, { arabic: "Cairo", latin: "Montserrat" }, { arabic: "Amiri", latin: "Lora" }],
};
export async function fontsAndTone(b: BrandInput, seed: number) {
  const fallback = { fonts: FONT_PAIRS[b.sector][seed % 3], tone: TONES[b.sector] };
  const res = await generate({
    task: "studio_tone",
    system: `You define a brand's typography and voice. Reply with JSON only: {"fonts":{"arabic":one of ${JSON.stringify(ARABIC_FONTS)},"latin":one of ${JSON.stringify(LATIN_FONTS)}},"tone":{"en":"two sentences","ar":"the same in Arabic","wordsEn":[3 words],"wordsAr":[3 words]}}`,
    messages: [{ role: "user", content: `${context(b)}\nVariation: ${seed}` }],
    fallback: () => JSON.stringify(fallback),
    maxTokens: 500,
  });
  const p = parseJson<{ fonts?: Fonts; tone?: Tone }>(res.text);
  const fonts = p?.fonts && ARABIC_FONTS.includes(p.fonts.arabic) && LATIN_FONTS.includes(p.fonts.latin) ? p.fonts : fallback.fonts;
  const tone = p?.tone && typeof p.tone.en === "string" && typeof p.tone.ar === "string" ? { en: p.tone.en.slice(0, 400), ar: p.tone.ar.slice(0, 400), wordsEn: (p.tone.wordsEn || []).slice(0, 3).map(String), wordsAr: (p.tone.wordsAr || []).slice(0, 3).map(String) } : fallback.tone;
  return { fonts, tone, source: p ? res.source : "mock" };
}

// ---------------------------------------------------------------- logos
const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ICONS: Record<Sector, string> = {
  // simple single-path marks, drawn in a 100×100 box
  food: "M50 12c10 14 22 22 22 38a22 22 0 0 1-44 0c0-16 12-24 22-38zm0 26c-5 6-9 10-9 16a9 9 0 0 0 18 0c0-6-4-10-9-16z",
  retail: "M22 38h56l-6 44H28zM36 38v-8a14 14 0 0 1 28 0v8h-6v-8a8 8 0 0 0-16 0v8z",
  crafts: "M50 10l10 30h30l-24 18 9 30-25-18-25 18 9-30-24-18h30z",
  services: "M50 14a36 36 0 1 0 0.1 0zm-6 52-16-16 6-6 10 10 22-22 6 6z",
  tech: "M30 20h40l20 30-20 30H30L10 50zm6 10L22 50l14 20h28l14-20-14-20z",
  agriculture: "M50 90V40M50 40c0-16 12-26 28-26 0 16-12 26-28 26zm0 14c0-14-10-22-24-22 0 14 10 22 24 22z",
  tourism: "M10 80l28-44 14 20 12-16 26 40zM70 22a8 8 0 1 0 0.1 0z",
};
function fallbackLogos(name: { en: string; ar: string }, pal: Swatch[], fonts: Fonts, sector: Sector, seed: number): string[] {
  const p = Object.fromEntries(pal.map((s) => [s.role, s.hex])) as Record<Swatch["role"], string>;
  const ar = xml(name.ar);
  const en = xml(name.en);
  const fa = xml(`'${fonts.arabic}', Tahoma, sans-serif`);
  const fl = xml(`'${fonts.latin}', Arial, sans-serif`);
  const initial = xml((name.en.replace(/^(Bayt|Dar)\s+/i, "")[0] || "B").toUpperCase());
  const icon = ICONS[sector];
  const r = rng(seed * 7919 + hash(name.en));
  // Colour schemes: background / main / highlight / text. Each regeneration reshuffles them.
  const schemes = [
    { bg: p.light, main: p.primary, hi: p.accent, ink: p.dark, soft: p.secondary },
    { bg: p.primary, main: p.light, hi: p.accent, ink: p.light, soft: p.secondary },
    { bg: p.dark, main: p.accent, hi: p.primary, ink: p.light, soft: p.secondary },
    { bg: p.light, main: p.secondary, hi: p.primary, ink: p.dark, soft: p.accent },
  ];
  const scheme = () => schemes[Math.floor(r() * schemes.length)];
  const head = (c: { bg: string }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${c.bg}"/>`;
  const tilt = () => Math.round(r() * 30 - 15);
  // Shrinks a font size so the text fits the width (average glyph ≈ 0.58 em; uppercase/spaced ≈ 0.75 em).
  const fit = (text: string, size: number, width = 340, em = 0.58) => Math.max(14, Math.min(size, Math.floor(width / (Math.max(1, [...text].length) * em))));
  const A = (size: number, width?: number) => fit(name.ar, size, width);
  const E = (size: number, width?: number) => fit(name.en, size, width);
  const EU = (size: number, width?: number) => fit(name.en, size, width, 0.82);
  const styles: (() => string)[] = [
    () => { // monogram badge
      const c = scheme();
      return `${head(c)}<circle cx="200" cy="160" r="${90 + Math.round(r() * 12)}" fill="${c.main}"/><circle cx="200" cy="160" r="80" fill="none" stroke="${c.hi}" stroke-width="${3 + Math.round(r() * 4)}"/><text x="200" y="192" text-anchor="middle" font-family="${fl}" font-size="96" font-weight="700" fill="${c.bg}">${initial}</text><text x="200" y="316" text-anchor="middle" font-family="${fa}" font-size="${A(44)}" font-weight="700" fill="${c.ink}" direction="rtl">${ar}</text><text x="200" y="356" text-anchor="middle" font-family="${fl}" font-size="${EU(24)}" letter-spacing="4" fill="${c.soft}">${en.toUpperCase()}</text></svg>`;
    },
    () => { // wordmark with underline
      const c = scheme();
      const y = 236 + Math.round(r() * 30);
      return `${head(c)}<rect x="60" y="${y}" width="280" height="8" rx="4" fill="${c.hi}"/><text x="200" y="${y - 40}" text-anchor="middle" font-family="${fa}" font-size="${A(80)}" font-weight="700" fill="${c.ink}" direction="rtl">${ar}</text><text x="200" y="${y + 60}" text-anchor="middle" font-family="${fl}" font-size="${E(32)}" font-weight="600" fill="${c.ink}" letter-spacing="2">${en}</text></svg>`;
    },
    () => { // emblem with the activity mark
      const c = scheme();
      return `${head(c)}<g transform="translate(130 50) scale(1.4) rotate(${tilt()} 50 50)"><path d="${icon}" fill="${c.main}" fill-rule="evenodd"/></g><circle cx="200" cy="120" r="104" fill="none" stroke="${c.soft}" stroke-width="3" stroke-dasharray="${4 + Math.round(r() * 6)} 8"/><text x="200" y="300" text-anchor="middle" font-family="${fl}" font-size="${E(40)}" font-weight="700" fill="${c.ink}">${en}</text><text x="200" y="350" text-anchor="middle" font-family="${fa}" font-size="${A(34)}" fill="${c.main}" direction="rtl">${ar}</text></svg>`;
    },
    () => { // overlapping shapes
      const c = scheme();
      const t = tilt();
      return `${head(c)}<circle cx="${150 + Math.round(r() * 20)}" cy="150" r="70" fill="${c.main}"/><circle cx="235" cy="150" r="70" fill="${c.hi}" opacity="0.85"/><rect x="160" y="150" width="70" height="70" fill="${c.soft}" opacity="0.9" transform="rotate(${45 + t} 195 185)"/><text x="200" y="310" text-anchor="middle" font-family="${fa}" font-size="${A(50)}" font-weight="700" fill="${c.ink}" direction="rtl">${ar}</text><text x="200" y="352" text-anchor="middle" font-family="${fl}" font-size="${EU(24)}" fill="${c.ink}" letter-spacing="3">${en.toUpperCase()}</text></svg>`;
    },
    () => { // stacked label
      const c = scheme();
      return `${head(c)}<rect x="40" y="70" width="320" height="180" rx="${Math.round(r() * 40)}" fill="${c.main}"/><text x="200" y="182" text-anchor="middle" font-family="${fa}" font-size="${A(72)}" font-weight="700" fill="${c.bg}" direction="rtl">${ar}</text><rect x="120" y="230" width="160" height="40" rx="20" fill="${c.hi}"/><text x="200" y="258" text-anchor="middle" font-family="${fl}" font-size="20" font-weight="700" fill="${c.ink === c.bg ? c.main : c.ink}" letter-spacing="3">${xml(sector.toUpperCase())}</text><text x="200" y="330" text-anchor="middle" font-family="${fl}" font-size="${E(36)}" font-weight="700" fill="${c.ink}">${en}</text></svg>`;
    },
    () => { // mark beside the name
      const c = scheme();
      return `${head(c)}<g transform="translate(150 60) rotate(${tilt()} 50 50)"><path d="${icon}" fill="${c.hi}" fill-rule="evenodd"/></g><rect x="60" y="190" width="280" height="4" fill="${c.soft}"/><text x="200" y="270" text-anchor="middle" font-family="${fa}" font-size="${A(58)}" font-weight="700" fill="${c.ink}" direction="rtl">${ar}</text><text x="200" y="325" text-anchor="middle" font-family="${fl}" font-size="${E(28)}" fill="${c.main}" letter-spacing="2">${en}</text></svg>`;
    },
  ];
  const start = seed % styles.length;
  return [0, 1, 2, 3].map((i) => styles[(start + i) % styles.length]());
}
export async function logos(name: { en: string; ar: string }, pal: Swatch[], fonts: Fonts, sector: Sector, seed: number) {
  const fallback = fallbackLogos(name, pal, fonts, sector, seed);
  const res = await generate({
    task: "studio_logos",
    system:
      'You are a logo designer. Reply with JSON only: {"logos":["<svg ...>…</svg>" x4]}. Each logo is a standalone SVG with viewBox="0 0 400 400", flat shapes only (rect, circle, path, polygon, text), no images, no scripts, no external fonts or links. Use only the given colours. Make the 4 logos clearly different styles (badge, wordmark, emblem, abstract). Include the Arabic and English names as text.',
    messages: [{ role: "user", content: `Names: ${name.ar} / ${name.en}. Activity: ${sector}. Colours: ${pal.map((p) => `${p.role} ${p.hex}`).join(", ")}. Fonts: ${fonts.arabic}, ${fonts.latin}. Variation: ${seed}` }],
    fallback: () => JSON.stringify({ logos: fallback }),
    maxTokens: 6000,
    timeoutMs: 30000,
  });
  const list = parseJson<{ logos?: string[] }>(res.text)?.logos;
  // Every SVG from the model is rebuilt by the allow-list sanitiser; any that fail are replaced.
  const clean = fallback.map((fb, i) => (Array.isArray(list) && typeof list[i] === "string" ? sanitizeSvg(list[i]) : null) ?? sanitizeSvg(fb)!);
  return { logos: clean, source: res.source };
}
