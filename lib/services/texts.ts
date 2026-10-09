// Startup services (Part E) text helpers: online-presence copy (E4) and hiring (E5).
// Each asks the model through generate() and falls back to a deterministic, bilingual draft.
import { generate, parseJson } from "@/lib/integrations/llm";

export interface Biz {
  nameEn: string;
  nameAr: string;
  sector: string;
  city: string;
  description: string;
  phone: string;
  tone?: string;
}
type Bi = { en: string; ar: string };

// ---------------------------------------------------------------- E4 presence
export interface Presence {
  google: Bi; // Google Business Profile description (≤ 750 characters)
  instagram: Bi; // bio (≤ 150 characters)
  facebook: Bi; // page "About"
  whatsappGreeting: Bi;
  whatsappAway: Bi;
  posts: Bi[]; // three starter posts
  hashtags: string[];
}
function presenceFallback(b: Biz): Presence {
  const cityAr = { Amman: "عمّان", Irbid: "إربد", Zarqa: "الزرقاء", Aqaba: "العقبة", Salt: "السلط", Madaba: "مأدبا" }[b.city] ?? b.city;
  return {
    google: {
      en: `${b.nameEn} is a ${b.sector} business in ${b.city}, Jordan. ${b.description} Contact us on ${b.phone || "WhatsApp"} to order or ask a question.`.slice(0, 750),
      ar: `${b.nameAr} مشروع في ${cityAr}، الأردن. ${b.description} تواصلوا معنا على ${b.phone || "واتساب"} للطلب أو الاستفسار.`.slice(0, 750),
    },
    instagram: { en: `${b.nameEn} · ${b.city} 🇯🇴\n${b.description.slice(0, 70)}\nOrder on WhatsApp ⬇️`.slice(0, 150), ar: `${b.nameAr} · ${cityAr} 🇯🇴\n${b.description.slice(0, 60)}\nاطلب عبر واتساب ⬇️`.slice(0, 150) },
    facebook: { en: `Welcome to ${b.nameEn}! ${b.description} Based in ${b.city}. Message us any time.`, ar: `أهلاً بكم في ${b.nameAr}! ${b.description} من ${cityAr}. راسلونا في أي وقت.` },
    whatsappGreeting: { en: `Hello and welcome to ${b.nameEn}! How can we help you today?`, ar: `أهلاً وسهلاً بكم في ${b.nameAr}! كيف نقدر نساعدكم اليوم؟` },
    whatsappAway: { en: `Thanks for your message! We're closed right now and will reply first thing tomorrow.`, ar: `شكراً لرسالتكم! نحن خارج أوقات العمل الآن وسنرد عليكم صباح الغد.` },
    posts: [
      { en: `We're open! 🎉 ${b.nameEn} is now taking orders in ${b.city}. Message us to order.`, ar: `افتتحنا! 🎉 ${b.nameAr} تستقبل الطلبات الآن في ${cityAr}. راسلونا للطلب.` },
      { en: `Behind the scenes at ${b.nameEn}: every order is made with care, here in Jordan.`, ar: `من خلف الكواليس في ${b.nameAr}: كل طلب نجهزه بعناية، هنا في الأردن.` },
      { en: `First-order offer: 10% off this week only. Tag a friend who'd love this!`, ar: `عرض أول طلب: خصم 10% هذا الأسبوع فقط. أشر لصديق رح يحب هالشي!` },
    ],
    hashtags: [`#${b.nameEn.replace(/[^A-Za-z0-9]/g, "")}`, `#${b.city.replace(/\s/g, "")}`, "#Jordan", "#الأردن", "#صنع_في_الأردن", "#مشاريع_صغيرة"],
  };
}
const isBi = (v: unknown): v is Bi => !!v && typeof (v as Bi).en === "string" && typeof (v as Bi).ar === "string";
export async function presence(b: Biz) {
  const fb = presenceFallback(b);
  const res = await generate({
    task: "services_presence",
    system:
      'You write online-presence copy for small Jordanian businesses, in English and Jordanian-friendly Arabic. Reply with JSON only: {"google":{"en","ar"} (max 750 chars each),"instagram":{"en","ar"} (max 150 chars),"facebook":{"en","ar"},"whatsappGreeting":{"en","ar"},"whatsappAway":{"en","ar"},"posts":[3 × {"en","ar"}],"hashtags":[up to 8]}. No made-up facts, prices or awards.' +
      (b.tone ? ` Brand voice: ${b.tone}` : ""),
    messages: [{ role: "user", content: JSON.stringify(b) }],
    fallback: () => JSON.stringify(fb),
    maxTokens: 2500,
    timeoutMs: 30000,
  });
  const p = parseJson<Partial<Presence>>(res.text);
  const ok = p && isBi(p.google) && isBi(p.instagram) && isBi(p.facebook) && isBi(p.whatsappGreeting) && isBi(p.whatsappAway) && Array.isArray(p.posts) && p.posts.every(isBi);
  const out = ok ? (p as Presence) : fb;
  out.google = { en: out.google.en.slice(0, 750), ar: out.google.ar.slice(0, 750) };
  out.instagram = { en: out.instagram.en.slice(0, 150), ar: out.instagram.ar.slice(0, 150) };
  return { presence: { ...out, posts: out.posts.slice(0, 3), hashtags: (out.hashtags || []).slice(0, 8).map(String) }, source: ok ? res.source : "mock" };
}

// ---------------------------------------------------------------- E5 hiring
export interface JobAd { title: Bi; summary: Bi; duties: Bi[]; requirements: Bi[]; offer: Bi; apply: Bi; keywords: string[] }
const DUTIES: Record<string, [string, string][]> = {
  sales: [["Serve customers in the shop and on WhatsApp", "خدمة الزبائن في المحل وعبر واتساب"], ["Take and track orders", "استلام الطلبات ومتابعتها"], ["Keep the display and stock tidy", "ترتيب العرض والمخزون"]],
  baker: [["Prepare daily batches to our recipes", "تحضير الإنتاج اليومي حسب وصفاتنا"], ["Follow food-safety and hygiene rules", "اتباع قواعد سلامة الغذاء والنظافة"], ["Pack orders for pickup and delivery", "تغليف الطلبات للاستلام والتوصيل"]],
  marketing: [["Plan and post content on Instagram and Facebook", "تخطيط ونشر المحتوى على إنستغرام وفيسبوك"], ["Reply to messages and comments", "الرد على الرسائل والتعليقات"], ["Report what works each month", "إعداد تقرير شهري بما ينجح"]],
  accountant: [["Record income and expenses", "تسجيل الإيرادات والمصاريف"], ["Prepare invoices and monthly summaries", "إعداد الفواتير والملخصات الشهرية"], ["Handle tax and SSC deadlines", "متابعة مواعيد الضريبة والضمان"]],
  developer: [["Build and maintain our website and app", "بناء الموقع والتطبيق وصيانتهما"], ["Fix bugs and ship small features weekly", "إصلاح الأخطاء وإطلاق تحسينات أسبوعية"], ["Work with the team on product ideas", "العمل مع الفريق على أفكار المنتج"]],
  driver: [["Deliver orders on time", "توصيل الطلبات في الوقت المحدد"], ["Collect cash on delivery accurately", "تحصيل الدفع عند الاستلام بدقة"], ["Keep the vehicle clean and safe", "الحفاظ على نظافة المركبة وسلامتها"]],
};
const roleKey = (title: string) => {
  const q = title.toLowerCase();
  if (/sale|cashier|بيع|كاشير|مبيعات/.test(q)) return "sales";
  if (/bak|cook|chef|خباز|طاه|شيف|مطبخ/.test(q)) return "baker";
  if (/market|social|تسويق|سوشال/.test(q)) return "marketing";
  if (/account|book|محاسب/.test(q)) return "accountant";
  if (/develop|program|engineer|مطور|مبرمج/.test(q)) return "developer";
  if (/driv|deliver|سائق|توصيل/.test(q)) return "driver";
  return "sales";
};
const KEYWORDS: Record<string, string[]> = {
  sales: ["customer", "sales", "cash", "whatsapp", "arabic", "english", "retail", "زبائن", "مبيعات"],
  baker: ["baking", "pastry", "food safety", "hygiene", "kitchen", "خبز", "حلويات", "سلامة الغذاء"],
  marketing: ["instagram", "facebook", "content", "canva", "photography", "copywriting", "تسويق", "محتوى"],
  accountant: ["accounting", "excel", "invoice", "tax", "jofotara", "bookkeeping", "محاسبة", "ضريبة"],
  developer: ["javascript", "react", "node", "sql", "git", "api", "typescript"],
  driver: ["driving licence", "license", "delivery", "motorcycle", "amman", "رخصة", "توصيل"],
};
function adFallback(b: Biz, title: string, hours: string, salary: string): JobAd {
  const k = roleKey(title);
  return {
    title: { en: title, ar: title },
    summary: { en: `${b.nameEn} in ${b.city} is hiring a ${title}. ${b.description}`.slice(0, 400), ar: `${b.nameAr} في ${b.city} تبحث عن ${title}. ${b.description}`.slice(0, 400) },
    duties: DUTIES[k].map(([en, ar]) => ({ en, ar })),
    requirements: [
      { en: "Reliable, friendly and good with people", ar: "ملتزم وودود ويجيد التعامل مع الناس" },
      { en: "Arabic required; English is a plus", ar: "العربية مطلوبة والإنجليزية ميزة إضافية" },
      { en: "Previous experience in a similar role is a plus", ar: "الخبرة في عمل مشابه ميزة إضافية" },
    ],
    offer: { en: `${hours || "Full time"} · ${salary ? `${salary} JOD/month` : "salary based on experience"} · Social Security (SSC) registration from day one`, ar: `${hours || "دوام كامل"} · ${salary ? `${salary} دينار شهرياً` : "الراتب حسب الخبرة"} · تسجيل في الضمان الاجتماعي من اليوم الأول` },
    apply: { en: `Send your CV on WhatsApp ${b.phone} with the job title.`, ar: `أرسل سيرتك الذاتية عبر واتساب ${b.phone} مع اسم الوظيفة.` },
    keywords: KEYWORDS[k],
  };
}
export async function jobAd(b: Biz, title: string, hours: string, salary: string) {
  const fb = adFallback(b, title, hours, salary);
  const res = await generate({
    task: "services_job_ad",
    system:
      'You write fair, inclusive job ads for small Jordanian businesses. Reply with JSON only: {"title":{"en","ar"},"summary":{"en","ar"},"duties":[{"en","ar"}],"requirements":[{"en","ar"}],"offer":{"en","ar"},"apply":{"en","ar"},"keywords":[skills to look for in CVs]}. No age, gender, nationality, religion or marital-status requirements. Mention Social Security registration.',
    messages: [{ role: "user", content: JSON.stringify({ business: b, title, hours, salary }) }],
    fallback: () => JSON.stringify(fb),
    maxTokens: 1800,
    timeoutMs: 30000,
  });
  const p = parseJson<JobAd>(res.text);
  const ok = p && isBi(p.title) && isBi(p.summary) && Array.isArray(p.duties) && Array.isArray(p.requirements) && isBi(p.offer) && isBi(p.apply);
  return { ad: ok ? { ...p, keywords: (p.keywords || fb.keywords).slice(0, 15).map(String) } : fb, source: ok ? res.source : "mock" };
}

export function interviewQuestions(title: string): { q: Bi; listenFor: Bi }[] {
  const k = roleKey(title);
  const common: { q: Bi; listenFor: Bi }[] = [
    { q: { en: "Tell us about a time you dealt with an unhappy customer.", ar: "حدثنا عن موقف تعاملت فيه مع زبون غير راضٍ." }, listenFor: { en: "Stays calm, listens, finds a fix", ar: "الهدوء والإصغاء وإيجاد حل" } },
    { q: { en: "Which hours and days can you work?", ar: "ما الأيام والساعات التي يمكنك العمل فيها؟" }, listenFor: { en: "Clear availability that fits the shifts", ar: "توفر واضح يناسب المناوبات" } },
    { q: { en: "Why do you want to work with a small local business?", ar: "لماذا تريد العمل مع مشروع محلي صغير؟" }, listenFor: { en: "Motivation and fit with the team", ar: "الدافع والانسجام مع الفريق" } },
  ];
  const specific: Record<string, { q: Bi; listenFor: Bi }[]> = {
    sales: [{ q: { en: "How would you suggest a second item to a customer without being pushy?", ar: "كيف تقترح منتجاً إضافياً على الزبون دون إلحاح؟" }, listenFor: { en: "Natural recommendations based on needs", ar: "اقتراحات طبيعية حسب حاجة الزبون" } }],
    baker: [{ q: { en: "Walk us through how you keep a kitchen food-safe during a busy day.", ar: "اشرح كيف تحافظ على سلامة الغذاء في يوم مزدحم." }, listenFor: { en: "Hygiene, temperatures, labelling", ar: "النظافة ودرجات الحرارة والتوسيم" } }],
    marketing: [{ q: { en: "Show us a post you made and tell us how it performed.", ar: "أرنا منشوراً صممته وأخبرنا كيف كان أداؤه." }, listenFor: { en: "Uses numbers, learns from results", ar: "يستخدم الأرقام ويتعلم من النتائج" } }],
    accountant: [{ q: { en: "How do you make sure every sale is invoiced and recorded?", ar: "كيف تتأكد من فوترة وتسجيل كل عملية بيع؟" }, listenFor: { en: "Routine, checks, reconciliation", ar: "روتين ومراجعة ومطابقة" } }],
    developer: [{ q: { en: "Describe a bug you fixed recently and how you found it.", ar: "صف خطأً برمجياً أصلحته مؤخراً وكيف اكتشفته." }, listenFor: { en: "Methodical debugging, testing", ar: "تتبع منهجي واختبار" } }],
    driver: [{ q: { en: "How do you plan a route with five deliveries across the city?", ar: "كيف تخطط مسار خمس طلبات في أنحاء المدينة؟" }, listenFor: { en: "Planning, communication with customers", ar: "التخطيط والتواصل مع الزبائن" } }],
  };
  return [...specific[k], ...common];
}

/** Scores CVs against the ad's keywords and requirements; explains each score. Shortlisting aid only. */
export function rankCvs(keywords: string[], cvs: { name: string; text: string }[]) {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  return cvs
    .map((cv) => {
      const text = cv.text.toLowerCase();
      const found = kws.filter((k) => text.includes(k));
      const years = Math.max(0, ...[...text.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs|سنوات|سنة)/g)].map((m) => Number(m[1])));
      const score = Math.round(Math.min(100, (found.length / Math.max(1, kws.length)) * 80 + Math.min(years, 5) * 4));
      return { name: cv.name, score, matched: found, missing: kws.filter((k) => !found.includes(k)), years };
    })
    .sort((a, b) => b.score - a.score);
}
