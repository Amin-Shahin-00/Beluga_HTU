import "server-only";
// Legal structures for a business in Jordan, explained for owners, with Saad's recommendation for this
// business. Three structures have Bedaya's verified step-by-step data (home business, sole proprietorship,
// LLC); for the others Bedaya explains them and points to an expert instead of guessing fees or steps.
import { conditionHolds, knowledge } from "@/lib/integrations/knowledge";
import type { Lang, LegalForm, UserProfile } from "@/lib/integrations/types";

type Bi = { en: string; ar: string };
export type FormId = LegalForm | "general_partnership" | "limited_partnership" | "private_shareholding" | "non_profit";

interface FormInfo {
  id: FormId;
  name: Bi;
  what: Bi;
  owners: Bi;
  liability: Bi;
  bestFor: Bi[];
  watchOut: Bi[];
  supported: boolean;
}

export const FORMS: FormInfo[] = [
  {
    id: "home_business",
    name: { en: "Home business (individual)", ar: "مشروع منزلي (فردي)" },
    what: { en: "You register as an individual trader and get the municipality's home-business licence to work from your home.", ar: "تسجل كتاجر فرد وتحصل على رخصة المشروع المنزلي من البلدية لتعمل من منزلك." },
    owners: { en: "One owner; up to one employee may work with you at home.", ar: "مالك واحد؛ ويمكن أن يعمل معك موظف واحد في المنزل." },
    liability: { en: "Unlimited: you are personally responsible for the business's debts.", ar: "غير محدودة: أنت مسؤول شخصياً عن ديون المشروع." },
    bestFor: [
      { en: "Starting small from home with the lowest cost", ar: "البدء بمشروع صغير من المنزل بأقل كلفة" },
      { en: "Home food, crafts, design and other home services", ar: "الأغذية المنزلية والحرف والتصميم والخدمات المنزلية" },
    ],
    watchOut: [
      { en: "Up to 15% of the home (max 25 m²), inside closed rooms", ar: "حتى 15% من المنزل (25 م² كحد أقصى) داخل غرف مغلقة" },
      { en: "Your personal assets are not separated from the business", ar: "أموالك الشخصية غير منفصلة عن المشروع" },
    ],
    supported: true,
  },
  {
    id: "sole_proprietorship",
    name: { en: "Sole proprietorship", ar: "مؤسسة فردية" },
    what: { en: "One person owns and runs the business, registered at the Ministry of Industry, Trade and Supply.", ar: "شخص واحد يملك المشروع ويديره، ويُسجل في وزارة الصناعة والتجارة والتموين." },
    owners: { en: "One owner only.", ar: "مالك واحد فقط." },
    liability: { en: "Unlimited: you are personally responsible for the business's debts.", ar: "غير محدودة: أنت مسؤول شخصياً عن ديون المشروع." },
    bestFor: [
      { en: "A shop or office with one owner", ar: "محل أو مكتب بمالك واحد" },
      { en: "Low cost, fast registration and simple bookkeeping", ar: "كلفة منخفضة وتسجيل سريع ومحاسبة بسيطة" },
    ],
    watchOut: [
      { en: "No partners can join without changing the structure", ar: "لا يمكن إضافة شركاء دون تغيير الشكل القانوني" },
      { en: "Harder to bring in investors", ar: "أصعب في جذب المستثمرين" },
    ],
    supported: true,
  },
  {
    id: "llc",
    name: { en: "Limited liability company (LLC)", ar: "شركة ذات مسؤولية محدودة" },
    what: { en: "A company registered at the Companies Control Department. The company, not you, is responsible for its debts.", ar: "شركة تُسجل في دائرة مراقبة الشركات. الشركة، وليس أنت، مسؤولة عن ديونها." },
    owners: { en: "One or more partners (a single-owner LLC needs the Companies Controller's approval).", ar: "شريك واحد أو أكثر (الشركة بشريك واحد تحتاج موافقة مراقب الشركات)." },
    liability: { en: "Limited: each partner risks only their share of the capital.", ar: "محدودة: كل شريك يتحمل بقدر حصته في رأس المال فقط." },
    bestFor: [
      { en: "Working with partners", ar: "العمل مع شركاء" },
      { en: "Protecting your personal assets, hiring staff, signing bigger contracts", ar: "حماية أموالك الشخصية وتوظيف العاملين وتوقيع عقود أكبر" },
      { en: "Growing and taking investment later", ar: "النمو وجذب الاستثمار لاحقاً" },
    ],
    watchOut: [
      { en: "Higher registration cost and a yearly auditor", ar: "كلفة تسجيل أعلى ومدقق حسابات سنوي" },
      { en: "More paperwork (memorandum and articles of association)", ar: "أوراق أكثر (عقد التأسيس والنظام الأساسي)" },
    ],
    supported: true,
  },
  {
    id: "general_partnership",
    name: { en: "General partnership", ar: "شركة تضامن" },
    what: { en: "Two or more partners run the business together under one trade name.", ar: "شريكان أو أكثر يديرون المشروع معاً باسم تجاري واحد." },
    owners: { en: "Two or more partners.", ar: "شريكان أو أكثر." },
    liability: { en: "Unlimited and joint: each partner is personally responsible for all the company's debts.", ar: "غير محدودة وبالتضامن: كل شريك مسؤول شخصياً عن جميع ديون الشركة." },
    bestFor: [{ en: "Family or close partners who fully trust each other", ar: "شركاء من العائلة أو مقربون يثقون ببعضهم تماماً" }],
    watchOut: [{ en: "One partner's decisions can put every partner's personal money at risk", ar: "قرارات أي شريك قد تعرّض أموال جميع الشركاء الشخصية للخطر" }],
    supported: false,
  },
  {
    id: "limited_partnership",
    name: { en: "Limited partnership", ar: "شركة توصية بسيطة" },
    what: { en: "Managing partners run the business; silent partners put in money but don't manage.", ar: "شركاء متضامنون يديرون المشروع، وشركاء موصون يقدمون المال دون الإدارة." },
    owners: { en: "At least one managing partner and one silent partner.", ar: "شريك متضامن واحد على الأقل وشريك موصٍ واحد." },
    liability: { en: "Managing partners: unlimited. Silent partners: only up to their share.", ar: "الشركاء المتضامنون: غير محدودة. الشركاء الموصون: بقدر حصتهم فقط." },
    bestFor: [{ en: "When someone funds the business but doesn't want to manage it", ar: "عندما يموّل شخص المشروع دون أن يرغب في إدارته" }],
    watchOut: [{ en: "The managing partners carry the personal risk", ar: "يتحمل الشركاء المتضامنون المخاطرة الشخصية" }],
    supported: false,
  },
  {
    id: "private_shareholding",
    name: { en: "Private shareholding company", ar: "شركة مساهمة خاصة" },
    what: { en: "A company whose capital is divided into shares, with a board and formal governance.", ar: "شركة رأسمالها مقسم إلى أسهم، ولها مجلس إدارة وحوكمة رسمية." },
    owners: { en: "Shareholders; suited to many investors.", ar: "مساهمون؛ مناسبة لعدد كبير من المستثمرين." },
    liability: { en: "Limited to each shareholder's shares.", ar: "محدودة بقيمة أسهم كل مساهم." },
    bestFor: [{ en: "Startups raising investment rounds", ar: "الشركات الناشئة التي تجمع جولات استثمار" }],
    watchOut: [{ en: "The most governance and running cost", ar: "أعلى مستوى من الحوكمة وكلفة التشغيل" }],
    supported: false,
  },
  {
    id: "non_profit",
    name: { en: "Non-profit company", ar: "شركة غير ربحية" },
    what: { en: "A company whose profits are reinvested in its social purpose and never distributed to owners.", ar: "شركة تُعاد أرباحها إلى هدفها الاجتماعي ولا تُوزع على المالكين." },
    owners: { en: "Founders who don't take profits.", ar: "مؤسسون لا يتقاضون أرباحاً." },
    liability: { en: "Limited, like a company.", ar: "محدودة كالشركات." },
    bestFor: [{ en: "Social, educational, health or community missions funded by grants", ar: "أهداف اجتماعية أو تعليمية أو صحية أو مجتمعية ممولة بالمنح" }],
    watchOut: [{ en: "No profit for owners; extra approvals, including before receiving foreign funding", ar: "لا أرباح للمالكين؛ وموافقات إضافية منها قبل تلقي تمويل أجنبي" }],
    supported: false,
  },
];

const pickBi = (b: Bi, lang: Lang) => (lang === "ar" ? b.ar : b.en);

/** Official cost, step count and time for one supported structure, for this owner's situation. */
function estimate(profile: UserProfile, form: LegalForm) {
  const p = { ...profile, business: { ...profile.business, legalForm: form, homeBased: form === "home_business" } };
  const steps = knowledge.legalForms[form].steps.filter((s) => conditionHolds(s.condition, p));
  let min = 0;
  let max = 0;
  let unknown = 0;
  let days = 0;
  for (const s of steps) {
    if (s.fee.minJod === null) unknown++;
    min += s.fee.minJod ?? 0;
    max += s.fee.maxJod ?? s.fee.minJod ?? 0;
    days += s.days.value ?? 0;
  }
  return { steps: steps.length, feeMin: min, feeMax: max, unknownFees: unknown, days };
}

/** Saad's scoring: what suits this business, with the reasons in plain words. */
function score(profile: UserProfile, partnersCount: number | null) {
  const b = profile.business;
  const s: Record<string, { points: number; why: Bi[] }> = Object.fromEntries(FORMS.map((f) => [f.id, { points: 0, why: [] as Bi[] }]));
  const add = (id: FormId, points: number, why: Bi) => ((s[id].points += points), s[id].why.push(why));
  const bigMoney = b.startupCapitalJod >= 20000 || b.fundingNeededJod >= 20000;
  const team = b.employeesPlanned >= 2;
  // The real number of partners (from the forms profile); without it, an LLC choice suggests partners.
  const partners = partnersCount === null ? b.legalForm === "llc" : partnersCount > 0;
  if (b.homeBased || ["food", "crafts"].includes(b.sector)) add("home_business", 3, { en: "You plan to work from home, which this licence is made for", ar: "تخطط للعمل من المنزل، وهذه الرخصة مصممة لذلك" });
  if (!bigMoney && !team) {
    add("home_business", 2, { en: "It's the cheapest and fastest way to start small", ar: "إنها الطريقة الأرخص والأسرع للبدء بمشروع صغير" });
    add("sole_proprietorship", 2, { en: "Low cost and simple for a single owner", ar: "كلفة منخفضة وبسيطة لمالك واحد" });
  }
  if (!b.homeBased) add("sole_proprietorship", 2, { en: "It suits a shop or office with one owner", ar: "تناسب محلاً أو مكتباً بمالك واحد" });
  if (partners) add("llc", 4, { en: "You're starting with partners, and an LLC protects each partner's personal money", ar: "تبدأ مع شركاء، والشركة ذات المسؤولية المحدودة تحمي أموال كل شريك الشخصية" });
  if (bigMoney) add("llc", 3, { en: `Your capital or funding (${Math.max(b.startupCapitalJod, b.fundingNeededJod).toLocaleString("en")} JOD) is worth protecting`, ar: `رأس مالك أو التمويل (${Math.max(b.startupCapitalJod, b.fundingNeededJod).toLocaleString("en")} دينار) يستحق الحماية` });
  if (team) add("llc", 2, { en: "You plan to hire, and a company separates the business's obligations from you", ar: "تخطط للتوظيف، والشركة تفصل التزامات المشروع عنك" });
  if (b.sector === "tech") add("llc", 2, { en: "Tech startups usually need a company to take investment", ar: "الشركات التقنية الناشئة تحتاج عادةً إلى شركة لجذب الاستثمار" });
  if (b.homeBased && partners) s.home_business.points -= 5;
  if (partners) s.sole_proprietorship.points -= 5;
  if (/non.?profit|charity|community|social impact|غير ربح|خيري|مجتمع/i.test(`${b.description} ${b.descriptionAr ?? ""}`)) add("non_profit", 4, { en: "Your description sounds like a social mission", ar: "يبدو من وصفك أن لديك هدفاً اجتماعياً" });
  return s;
}

export function structuresFor(profile: UserProfile, lang: Lang, partnersCount: number | null = null) {
  const scores = score(profile, partnersCount);
  const supported = FORMS.filter((f) => f.supported);
  const recommended = [...supported].sort((a, b) => scores[b.id].points - scores[a.id].points)[0].id;
  return {
    current: profile.business.legalForm,
    recommended,
    options: FORMS.map((f) => {
      const pts = scores[f.id].points;
      const fit = f.id === recommended ? "recommended" : pts >= 3 ? "good" : pts <= -3 ? "not_for_you" : "possible";
      return {
        id: f.id,
        name: pickBi(f.name, lang),
        what: pickBi(f.what, lang),
        owners: pickBi(f.owners, lang),
        liability: pickBi(f.liability, lang),
        bestFor: f.bestFor.map((x) => pickBi(x, lang)),
        watchOut: f.watchOut.map((x) => pickBi(x, lang)),
        supported: f.supported,
        fit,
        why: scores[f.id].why.map((x) => pickBi(x, lang)),
        estimate: f.supported ? estimate(profile, f.id as LegalForm) : null,
        current: f.id === profile.business.legalForm,
      };
    }),
  };
}
