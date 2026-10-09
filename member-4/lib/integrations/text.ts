import type { Bilingual, Lang } from "./types";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Lowercases, strips Arabic diacritics/tatweel, unifies letter variants and digits, and turns punctuation into spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{N}%²\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLang(text: string): Lang {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  return arabic > latin ? "ar" : "en";
}

export const pick = (b: Bilingual, lang: Lang) => b[lang];

export const t = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

const CITY_AR: Record<string, string> = {
  Amman: "عمّان", Irbid: "إربد", Zarqa: "الزرقاء", Aqaba: "العقبة", Salt: "السلط", Madaba: "مأدبا",
  Karak: "الكرك", Mafraq: "المفرق", Jerash: "جرش", Ajloun: "عجلون", Maan: "معان", Tafilah: "الطفيلة",
};

/** Governorate names as people write them in each language. */
export const cityName = (city: string, lang: Lang) => (lang === "ar" ? (CITY_AR[city] ?? city) : city);

/** "National ID card" -> "national ID card" for use mid-sentence; leaves acronyms like "JFDA approval" alone. */
export const midSentence = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** A keyword prepared for matching against normalized text. */
export interface Keyword {
  raw: string;
  norm: string;
  wholeWord: boolean;
}

export function keyword(raw: string): Keyword {
  const norm = normalize(raw);
  // Short single words match whole words only, so "mit" doesn't fire inside "permit" and "كم" not inside "حكم".
  const short = /^[a-z0-9]+$/.test(norm) ? norm.length <= 4 : norm.length <= 3;
  return { raw, norm, wholeWord: !norm.includes(" ") && short };
}

/** Length of the longest keyword found in `text` (already normalized), or 0. */
export function longestMatch(text: string, keywords: Keyword[]): number {
  const padded = ` ${text} `;
  let best = 0;
  for (const k of keywords) {
    const hit = k.wholeWord ? padded.includes(` ${k.norm} `) : text.includes(k.norm);
    if (hit && k.norm.length > best) best = k.norm.length;
  }
  return best;
}

export const toKeywords = (words: string[]) => words.map(keyword);
