// Business plan generator [14] (prototype). Wizard answers + feature 10's costs -> a one-page plan.
// Numbers and the timeline are computed in code; the LLM only writes the "business" and "market" paragraphs.
import { feeText, office, roadmapFor } from "./knowledge";
import { generate, parseJson, type LlmSource } from "./llm";
import type { Bilingual, UserProfile } from "./types";

export interface CostLine {
  item: Bilingual;
  amountJod: number;
  kind: "official" | "estimate";
}

/** Feature 10's output (cost calculator). */
export interface CostData {
  currency: "JOD";
  setup: CostLine[];
  monthly: CostLine[];
  expectedMonthlyRevenueJod?: number;
}

export interface TimelineItem {
  stepId: string;
  title: Bilingual;
  office: Bilingual;
  start: string;
  end: string;
  /** False when the duration is our estimate rather than a published figure. */
  durationKnown: boolean;
  fee: Bilingual;
}

export interface BusinessPlan {
  title: Bilingual;
  generatedAt: string;
  business: Bilingual;
  market: Bilingual;
  costs: { setup: CostLine[]; monthly: CostLine[]; setupTotalJod: number; monthlyTotalJod: number };
  funding: {
    ownCapitalJod: number;
    requestedJod: number;
    /** Setup costs + 3 months of running costs. */
    neededToLaunchJod: number;
    gapJod: number;
    breakEvenMonths: number | null;
    summary: Bilingual;
  };
  timeline: TimelineItem[];
  source: LlmSource;
}

const ASSUMED_DAYS = 5;
const sum = (lines: CostLine[]) => lines.reduce((n, l) => n + l.amountJod, 0);
const jod = (n: number) => `${n.toLocaleString("en")} JOD`;
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const CITY_AR: Record<string, string> = { Amman: "عمّان", Irbid: "إربد", Zarqa: "الزرقاء", Aqaba: "العقبة", Salt: "السلط", Madaba: "مأدبا", Karak: "الكرك", Mafraq: "المفرق", Jerash: "جرش", Ajloun: "عجلون", Maan: "معان", Tafilah: "الطفيلة" };

function textTemplate(p: UserProfile): { business: Bilingual; market: Bilingual } {
  const b = p.business;
  const cityAr = CITY_AR[p.personal.city] ?? p.personal.city;
  const form = { home_business: ["a home-based business", "مشروع منزلي"], sole_proprietorship: ["a sole proprietorship", "مؤسسة فردية"], llc: ["a limited liability company", "شركة ذات مسؤولية محدودة"] }[b.legalForm];
  return {
    business: {
      en: `${b.nameEn} is ${form[0]} in ${p.personal.city} run by ${p.personal.fullNameEn}. ${b.description} The business is at the ${b.stage} stage and plans to launch in ${b.plannedLaunch}.`,
      ar: `${b.nameAr} ${form[1]} في ${cityAr} ${p.personal.gender === "female" ? "تديره" : "يديره"} ${p.personal.fullNameAr}. ${b.descriptionAr ?? b.description} المشروع في مرحلة ${b.stage === "idea" ? "الفكرة" : b.stage === "prototype" ? "النموذج الأولي" : "تحقيق الإيرادات"} ويخطط للانطلاق في ${b.plannedLaunch}.`,
    },
    market: {
      en: `Target customers: ${b.targetCustomers} Orders come through social media and word of mouth, with ${b.employeesPlanned} helper planned at launch.`,
      ar: `العملاء المستهدفون: ${b.targetCustomersAr ?? b.targetCustomers} تصل الطلبات عبر وسائل التواصل الاجتماعي والتوصيات، وعدد المساعدين المخطط لهم عند الانطلاق: ${b.employeesPlanned}.`,
    },
  };
}

export async function generateBusinessPlan(profile: UserProfile, costs: CostData, today = new Date().toISOString().slice(0, 10)): Promise<BusinessPlan> {
  const b = profile.business;

  // Timeline: roadmap steps one after another from today.
  let cursor = today;
  const timeline: TimelineItem[] = roadmapFor(profile).map((step) => {
    const days = step.days.value ?? ASSUMED_DAYS;
    const start = cursor;
    cursor = addDays(cursor, days);
    return {
      stepId: step.id,
      title: step.title,
      office: office(step.officeId).name,
      start,
      end: cursor,
      durationKnown: step.days.verified === "yes",
      fee: { en: feeText(step, "en"), ar: feeText(step, "ar") },
    };
  });

  const setupTotal = sum(costs.setup);
  const monthlyTotal = sum(costs.monthly);
  const neededToLaunch = setupTotal + 3 * monthlyTotal;
  const gap = Math.max(0, neededToLaunch - b.startupCapitalJod);
  const margin = (costs.expectedMonthlyRevenueJod ?? 0) - monthlyTotal;
  const breakEven = margin > 0 ? Math.ceil(setupTotal / margin) : null;

  const template = textTemplate(profile);
  const result = await generate({
    task: "business_plan",
    cacheKey: `${profile.userId}:${b.plannedLaunch}`,
    system:
      "You write two short paragraphs for a one-page business plan for a new business in Jordan: 'business' (what it is, who runs it, stage) and 'market' (customers, channels, edge). " +
      "Use only the facts given, 60 words or fewer each, in English and Arabic. Return only JSON: {\"business\": {\"en\": \"\", \"ar\": \"\"}, \"market\": {\"en\": \"\", \"ar\": \"\"}}.",
    messages: [{ role: "user", content: JSON.stringify({ founder: profile.personal.fullNameEn, city: profile.personal.city, business: b }) }],
    maxTokens: 1500,
    fallback: () => JSON.stringify(template),
  });
  const text = parseJson<{ business: Bilingual; market: Bilingual }>(result.text);
  const ok = (x?: Bilingual) => Boolean(x?.en && x?.ar);

  return {
    title: { en: `${b.nameEn}: one-page business plan`, ar: `${b.nameAr}: خطة عمل في صفحة واحدة` },
    generatedAt: today,
    business: ok(text?.business) ? (text?.business as Bilingual) : template.business,
    market: ok(text?.market) ? (text?.market as Bilingual) : template.market,
    costs: { setup: costs.setup, monthly: costs.monthly, setupTotalJod: setupTotal, monthlyTotalJod: monthlyTotal },
    funding: {
      ownCapitalJod: b.startupCapitalJod,
      requestedJod: b.fundingNeededJod,
      neededToLaunchJod: neededToLaunch,
      gapJod: gap,
      breakEvenMonths: breakEven,
      summary: {
        en:
          `Launching needs about ${jod(neededToLaunch)} (setup ${jod(setupTotal)} + 3 months of running costs at ${jod(monthlyTotal)}/month). ` +
          `With ${jod(b.startupCapitalJod)} of own capital, the gap is ${jod(gap)}; the plan asks for ${jod(b.fundingNeededJod)}.` +
          (breakEven ? ` At the expected revenue, setup costs are recovered in about ${breakEven} months.` : ""),
        ar:
          `يحتاج الانطلاق حوالي ${neededToLaunch.toLocaleString("en")} دينار (تجهيز ${setupTotal.toLocaleString("en")} + تكاليف تشغيل 3 أشهر بواقع ${monthlyTotal.toLocaleString("en")} دينار شهرياً). ` +
          `مع رأس مال ذاتي ${b.startupCapitalJod.toLocaleString("en")} دينار تبلغ الفجوة ${gap.toLocaleString("en")} دينار، والخطة تطلب ${b.fundingNeededJod.toLocaleString("en")} دينار.` +
          (breakEven ? ` بالإيرادات المتوقعة تُسترد تكاليف التجهيز خلال ${breakEven} أشهر تقريباً.` : ""),
      },
    },
    timeline,
    source: result.source,
  };
}
