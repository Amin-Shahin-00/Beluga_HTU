// Incubator matching [5]. M4 ranks the programmes; this file writes the "why this matches you" reason
// for each match and pre-fills every programme's application form from the wizard answers.
// The programmes in data/m1/incubators.json are real Jordanian programmes (sources in sources.json).
import incubatorList from "../../data/m1/incubators.json";
import { generate, parseJson, type LlmSource } from "./llm";
import { cityName } from "./text";
import type { ApplicationField, Bilingual, Incubator, Lang, UserProfile } from "./types";

export const incubators = incubatorList as Incubator[];
const byId = new Map(incubators.map((i) => [i.id, i]));

export interface RankedIncubator {
  incubatorId: string;
  score: number;
}

function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Eligibility rules the profile breaks. Empty means eligible as far as we can tell. */
export function eligibilityProblems(profile: UserProfile, inc: Incubator, today = new Date().toISOString().slice(0, 10)): Bilingual[] {
  const problems: Bilingual[] = [];
  const { minAge, maxAge, minMonthsOperating } = inc.eligibility;
  const age = ageOn(profile.personal.birthDate, today);
  if ((minAge !== undefined && age < minAge) || (maxAge !== undefined && age > maxAge)) {
    problems.push({ en: `for ages ${minAge ?? 0}-${maxAge ?? "any"} (you are ${age})`, ar: `للأعمار ${minAge ?? 0} إلى ${maxAge ?? "أي عمر"} (عمرك ${age})` });
  }
  // The wizard has no "months operating" answer; anything before the revenue stage hasn't been running long enough.
  if (minMonthsOperating && profile.business.stage !== "revenue") {
    problems.push({ en: `for businesses running at least ${minMonthsOperating} months`, ar: `للمشاريع العاملة منذ ${minMonthsOperating} شهراً على الأقل` });
  }
  return problems;
}

/** Stand-in for M4's ranking so the feature works alone. Replace with M4's result when it is ready. */
export function rankIncubatorsStandIn(profile: UserProfile, today?: string): RankedIncubator[] {
  const b = profile.business;
  return incubators
    .filter((inc) => eligibilityProblems(profile, inc, today).length === 0)
    .map((inc) => {
      let score = 0;
      if (inc.sectors.includes(b.sector)) score += 3;
      if (inc.stages.includes(b.stage)) score += 2;
      if (inc.womenFocused && profile.personal.gender === "female") score += 2;
      if (inc.homeBasedFriendly && b.homeBased) score += 2;
      if (inc.city === profile.personal.city) score += 1;
      if (inc.maxFundingJod !== null && inc.maxFundingJod >= b.fundingNeededJod) score += 1;
      return { incubatorId: inc.id, score };
    })
    .filter((r) => r.score >= 5)
    .sort((a, b) => b.score - a.score);
}

const SECTOR_NAMES: Record<string, Bilingual> = {
  food: { en: "food", ar: "الغذائية" },
  retail: { en: "retail", ar: "التجارية" },
  tech: { en: "tech", ar: "التقنية" },
  crafts: { en: "crafts", ar: "الحرفية" },
  services: { en: "services", ar: "الخدمية" },
  agriculture: { en: "agriculture", ar: "الزراعية" },
  tourism: { en: "tourism", ar: "السياحية" },
};

const TYPE_NAMES: Record<Incubator["type"], Bilingual> = {
  incubator: { en: "incubator", ar: "حاضنة" },
  accelerator: { en: "accelerator", ar: "مسرّعة" },
  grant: { en: "grant programme", ar: "برنامج منح" },
  loan: { en: "loan programme", ar: "برنامج قروض" },
  competition: { en: "competition", ar: "مسابقة" },
};
export const typeName = (inc: Incubator) => TYPE_NAMES[inc.type];

/** Facts that are true for this pair, in the order they make the best sentence. */
function matchPoints(profile: UserProfile, inc: Incubator): Bilingual[] {
  const b = profile.business;
  // Arabic phrases agree with "البرنامج" (masculine), so they read right whatever the programme's name is.
  const points: Bilingual[] = [];
  if (inc.womenFocused && profile.personal.gender === "female") points.push({ en: "it is aimed at women and young founders", ar: "موجّه للنساء والشباب" });
  if (inc.homeBasedFriendly && b.homeBased) points.push({ en: "it is built for home-based businesses", ar: "مخصص للمشاريع المنزلية" });
  const allSectors = inc.sectors.length >= Object.keys(SECTOR_NAMES).length;
  if (inc.sectors.includes(b.sector) && !allSectors) {
    const s = SECTOR_NAMES[b.sector];
    points.push({ en: `it supports ${s.en} projects like ${b.nameEn}`, ar: `يدعم المشاريع ${s.ar} مثل ${b.nameAr}` });
  }
  if (inc.fundingNote) points.push({ en: `it offers ${inc.fundingNote.en}`, ar: `يقدم ${inc.fundingNote.ar}` });
  if (inc.city === profile.personal.city && inc.city !== "Amman") points.push({ en: `it is in ${inc.city}, close to you`, ar: `مقره في ${inc.city} قريب منك` });
  return points;
}

function reasonTemplate(profile: UserProfile, inc: Incubator): Bilingual {
  const points = matchPoints(profile, inc).slice(0, 3);
  const en = points.map((p) => p.en);
  const ar = points.map((p) => p.ar);
  const listEn = en.length > 1 ? `${en.slice(0, -1).join(", ")} and ${en.at(-1)}` : (en[0] ?? "it fits your stage and sector");
  const listAr = ar.length ? ar.join("، و") : "يناسب مرحلة مشروعك وقطاعه";
  const needs = inc.requirements.length
    ? {
        en: ` You'll need to show: ${inc.requirements.map((r) => r.en.charAt(0).toLowerCase() + r.en.slice(1)).join("; ")}.`,
        ar: ` ستحتاج إلى إثبات: ${inc.requirements.map((r) => r.ar).join("؛ ")}.`,
      }
    : { en: "", ar: "" };
  return {
    en: `${inc.name.en} fits you because ${listEn}.${needs.en}`,
    ar: `${inc.name.ar} - يناسبك هذا البرنامج لأنه ${listAr}.${needs.ar}`,
  };
}

export interface IncubatorMatch {
  incubatorId: string;
  type: Incubator["type"];
  name: Bilingual;
  organisation: Bilingual;
  score: number;
  reason: Bilingual;
  benefits: Bilingual;
  requirements: Bilingual[];
  /** Eligibility rules the user seems to break (only possible when M4's ranking includes them). */
  eligibilityProblems: Bilingual[];
  maxFundingJod: number | null;
  applicationDeadline: string | null;
  website: string;
}

export async function explainMatches(
  profile: UserProfile,
  ranked: RankedIncubator[] = rankIncubatorsStandIn(profile),
): Promise<{ matches: IncubatorMatch[]; source: LlmSource }> {
  const known = ranked.filter((r) => byId.has(r.incubatorId));
  const templates = new Map(known.map((r) => [r.incubatorId, reasonTemplate(profile, byId.get(r.incubatorId) as Incubator)]));

  const result = await generate({
    task: "match_reasons",
    cacheKey: `${profile.userId}:${known.map((r) => r.incubatorId).join(",")}`,
    system:
      'You write the "why this matches you" line for support-programme matches in Bedaya. For each programme write one or two warm sentences in English and in Arabic, ' +
      "addressed to the founder, using only the facts given, and mention what they'll need to show. Return only JSON: [{\"id\": \"...\", \"en\": \"...\", \"ar\": \"...\"}].",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          founder: { name: profile.personal.fullNameEn, gender: profile.personal.gender, city: profile.personal.city, business: profile.business },
          matches: known.map((r) => {
            const inc = byId.get(r.incubatorId) as Incubator;
            return { id: inc.id, name: inc.name, type: inc.type, facts: matchPoints(profile, inc).map((p) => p.en), requirements: inc.requirements.map((x) => x.en) };
          }),
        }),
      },
    ],
    maxTokens: 2000,
    fallback: () => JSON.stringify(known.map((r) => ({ id: r.incubatorId, ...templates.get(r.incubatorId) }))),
  });

  const parsed = new Map((parseJson<{ id: string; en: string; ar: string }[]>(result.text) ?? []).map((p) => [p.id, p]));
  return {
    source: result.source,
    matches: known.map((r) => {
      const inc = byId.get(r.incubatorId) as Incubator;
      const p = parsed.get(inc.id);
      return {
        incubatorId: inc.id,
        type: inc.type,
        name: inc.name,
        organisation: inc.organisation,
        score: r.score,
        reason: p?.en && p?.ar ? { en: p.en, ar: p.ar } : (templates.get(inc.id) as Bilingual),
        benefits: inc.benefits,
        requirements: inc.requirements,
        eligibilityProblems: eligibilityProblems(profile, inc),
        maxFundingJod: inc.maxFundingJod,
        applicationDeadline: inc.applicationDeadline,
        website: inc.website,
      };
    }),
  };
}

// ---------- Multi-apply: profile -> each incubator's application fields ----------

type Origin = "profile" | "derived" | "empty";
interface Resolved {
  value: string;
  origin: Origin;
  /** The profile path the value came from, shown to the user so they can check it. */
  from: string | null;
}

const get = (value: string | number, from: string): Resolved => ({ value: String(value), origin: "profile", from });
const derived = (value: string | number, from: string): Resolved => ({ value: String(value), origin: "derived", from });

/** Language for a name field: the key's suffix if it has one, else the form's language. */
const nameLang = (f: ApplicationField, formLang: Lang): Lang => (f.key.endsWith("_en") ? "en" : f.key.endsWith("_ar") ? "ar" : formLang);

const CONCEPTS: Record<string, (p: UserProfile, f: ApplicationField, formLang: Lang) => Resolved> = {
  personName: (p, f, formLang) =>
    nameLang(f, formLang) === "en"
      ? get(p.personal.fullNameEn, "personal.fullNameEn")
      : get(p.personal.fullNameAr, "personal.fullNameAr"),
  email: (p) => get(p.personal.email, "personal.email"),
  phone: (p) => get(p.personal.phone, "personal.phone"),
  nationalId: (p) => get(p.personal.nationalId, "personal.nationalId"),
  city: (p, _f, formLang) => get(cityName(p.personal.city, formLang), "personal.city"),
  birthDate: (p) => get(p.personal.birthDate, "personal.birthDate"),
  businessName: (p, f, formLang) =>
    nameLang(f, formLang) === "en" ? get(p.business.nameEn, "business.nameEn") : get(p.business.nameAr, "business.nameAr"),
  description: (p, _f, formLang) =>
    formLang === "ar" && p.business.descriptionAr
      ? get(p.business.descriptionAr, "business.descriptionAr")
      : get(p.business.description, "business.description"),
  pitch: (p) => derived(p.business.description, "business.description"),
  stage: (p) => get(p.business.stage, "business.stage"),
  sector: (p) => get(p.business.sector, "business.sector"),
  fundingNeed: (p) => get(p.business.fundingNeededJod, "business.fundingNeededJod"),
  capital: (p) => get(p.business.startupCapitalJod, "business.startupCapitalJod"),
  budget: (p) => derived(p.business.startupCapitalJod + p.business.fundingNeededJod, "business.startupCapitalJod + business.fundingNeededJod"),
  homeBased: (p) => get(p.business.homeBased ? "yes" : "no", "business.homeBased"),
  teamSize: (p) => derived(p.business.employeesPlanned + 1, "business.employeesPlanned + 1 (you)"),
  employees: (p) => get(p.business.employeesPlanned, "business.employeesPlanned"),
  targetMarket: (p, _f, formLang) =>
    formLang === "ar" && p.business.targetCustomersAr
      ? get(p.business.targetCustomersAr, "business.targetCustomersAr")
      : get(p.business.targetCustomers, "business.targetCustomers"),
  launchDate: (p) => get(p.business.plannedLaunch, "business.plannedLaunch"),
};

// Field keys seen in M1's incubator list, mapped to profile concepts.
const SYNONYMS: Record<string, string> = {
  founder_name: "personName", team_lead: "personName", name: "personName", owner_name: "personName",
  applicant_full_name_ar: "personName", full_name_en: "personName",
  email: "email", contact_email: "email", email_address: "email",
  mobile: "phone", phone_number: "phone",
  national_number: "nationalId", id_number: "nationalId",
  governorate: "city", date_of_birth: "birthDate",
  startup_name: "businessName", company: "businessName", business_name: "businessName", project_name_ar: "businessName", project_name: "businessName",
  pitch: "pitch", project_idea: "description", problem: "description", mvp_description: "description", product_idea: "description",
  stage: "stage", sector: "sector",
  funding_ask_jod: "fundingNeed", need_jod: "fundingNeed", loan_amount_jod: "fundingNeed", capital_jod: "capital", budget_jod: "budget",
  works_from_home: "homeBased", team_size: "teamSize", employees: "employees",
  target_market: "targetMarket", launch_date: "launchDate",
};

// For field keys M1 adds later: guess the concept from the key.
const PATTERNS: [RegExp, string][] = [
  [/e-?mail/, "email"],
  [/phone|mobile|whatsapp/, "phone"],
  [/national|id_?num/, "nationalId"],
  [/birth|dob/, "birthDate"],
  [/(startup|company|business|project).*name|brand/, "businessName"],
  [/name|founder|owner|applicant/, "personName"],
  [/city|governorate|location/, "city"],
  [/fund|ask|need/, "fundingNeed"],
  [/capital/, "capital"],
  [/budget/, "budget"],
  [/idea|descri|problem|about/, "description"],
  [/market|customer|audience/, "targetMarket"],
  [/team|employee|staff/, "teamSize"],
  [/sector|industry/, "sector"],
  [/stage/, "stage"],
  [/launch|start_date/, "launchDate"],
  [/home/, "homeBased"],
];

const OPTION_ALIASES: Record<string, string[]> = { prototype: ["mvp", "prototype"], revenue: ["revenue", "growth"], idea: ["idea"] };

function fitToField(r: Resolved, f: ApplicationField): Resolved {
  if (f.type === "select" && f.options) {
    if (f.options.includes(r.value)) return r;
    const alias = (OPTION_ALIASES[r.value] ?? []).find((o) => f.options?.includes(o));
    if (alias) return { ...r, value: alias, origin: "derived" };
    if (f.options.includes("other")) return { ...r, value: "other", origin: "derived" };
    return { value: "", origin: "empty", from: null };
  }
  if (f.maxLength && r.value.length > f.maxLength) {
    // Cut at the last full word that fits.
    const cut = r.value.slice(0, f.maxLength - 1);
    return { ...r, value: `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`, origin: "derived" };
  }
  return r;
}

export interface PrefilledField extends ApplicationField, Resolved {}

export interface PrefilledApplication {
  incubatorId: string;
  name: Bilingual;
  fields: PrefilledField[];
  /** Required fields the user still has to fill in by hand. */
  missingRequired: string[];
  readyToSubmit: boolean;
}

export function prefillApplication(profile: UserProfile, incubatorId: string): PrefilledApplication | null {
  const inc = byId.get(incubatorId);
  if (!inc) return null;
  // A form with only *_en (or only *_ar) fields is in that language; otherwise use the user's language.
  const keys = inc.applicationFields.map((f) => f.key);
  const hasEn = keys.some((k) => k.endsWith("_en"));
  const hasAr = keys.some((k) => k.endsWith("_ar"));
  const formLang: Lang = hasEn && !hasAr ? "en" : hasAr && !hasEn ? "ar" : profile.language;
  const fields = inc.applicationFields.map((f): PrefilledField => {
    const concept = SYNONYMS[f.key] ?? PATTERNS.find(([re]) => re.test(f.key))?.[1];
    let resolved: Resolved = concept ? fitToField(CONCEPTS[concept](profile, f, formLang), f) : { value: "", origin: "empty", from: null };
    // Never ask a programme for more than it offers.
    if (concept === "fundingNeed" && inc.maxFundingJod !== null && Number(resolved.value) > inc.maxFundingJod) {
      resolved = derived(inc.maxFundingJod, `business.fundingNeededJod, capped at the programme's ${inc.maxFundingJod} JOD maximum`);
    }
    return { ...f, ...resolved };
  });
  const missingRequired = fields.filter((f) => f.required && !f.value).map((f) => f.key);
  return { incubatorId, name: inc.name, fields, missingRequired, readyToSubmit: missingRequired.length === 0 };
}

export function prefillApplications(profile: UserProfile, incubatorIds: string[]): PrefilledApplication[] {
  return incubatorIds.flatMap((id) => prefillApplication(profile, id) ?? []);
}
