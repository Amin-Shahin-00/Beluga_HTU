// Words that point the assistant at a legal form, step, office, document or question type (Arabic + English).
// Keywords are normalized before matching, so spelling variants (أ/ا, ة/ه) don't need separate entries.
import type { LegalForm } from "../types";

export const FORM_WORDS: Record<LegalForm, string[]> = {
  home_business: ["home business", "home-based", "home based", "from home", "home", "house", "منزلي", "من البيت", "من المنزل", "البيت", "المنزل"],
  sole_proprietorship: ["sole proprietorship", "sole proprietor", "individual establishment", "مؤسسة فردية"],
  llc: ["llc", "limited liability", "ذات مسؤولية محدودة", "ذات المسؤولية المحدودة"],
};

export const STEP_WORDS: Record<string, string[]> = {
  reserve_trade_name: ["trade name", "business name", "الاسم التجاري", "اسم تجاري", "حجز الاسم", "احجز الاسم"],
  register_sole_proprietorship: ["sole proprietorship", "commercial regist", "register my business", "تسجيل مؤسسة فردية", "مؤسسة فردية", "السجل التجاري"],
  register_llc: ["register an llc", "register the company", "register a company", "llc", "limited liability", "تسجيل شركة", "ذات مسؤولية محدودة"],
  jfda_home_food_license: ["jfda", "food and drug", "الغذاء والدواء"],
  home_business_license: ["home business licen", "home licen", "home-based licen", "home based licen", "licen", "رخصة المهن المنزلية", "رخصة مهن منزلية", "رخصة المهن", "رخصة مهن", "رخصه", "ترخيص"],
  vocational_license: ["vocational licen", "shop licen", "office licen", "licen", "رخصة المهن", "رخصة مهن", "رخصة محل", "رخصه", "ترخيص"],
  chamber_membership: ["chamber", "غرفة التجارة", "غرفة تجارة", "الغرفة"],
  tax_number: ["tax number", "tax id", "tax registration", "رقم ضريبي", "الرقم الضريبي"],
  social_security: ["social security", "ssc", "الضمان"],
};

export const OFFICE_WORDS: Record<string, string[]> = {
  MIT: ["ministry of industry", "mit", "وزارة الصناعة"],
  CCD: ["companies control", "ccd", "مراقبة الشركات"],
  GAM: ["greater amman", "gam", "municipality", "امانة عمان", "الامانة", "البلدية"],
  ACC: ["chamber of commerce", "غرفة تجارة عمان", "غرفة التجارة"],
  ISTD: ["income and sales tax", "istd", "tax department", "دائرة الضريبة", "ضريبة الدخل والمبيعات"],
  SSC: ["social security corporation", "social security", "ssc", "مؤسسة الضمان", "الضمان الاجتماعي"],
  JFDA: ["jfda", "food and drug", "الغذاء والدواء"],
  CSPD: ["civil status", "passports department", "الاحوال المدنية"],
  JEDCO: ["jedco", "enterprise development", "تطوير المشاريع"],
  MOL: ["ministry of labour", "ministry of labor", "وزارة العمل"],
};

export const DOC_WORDS: Record<string, string[]> = {
  national_id: ["national id", "id card", "identity card", "البطاقة الشخصية", "الهوية", "هوية"],
  passport: ["passport", "جواز"],
  service_booklet: ["service booklet", "military service", "خدمة العلم", "دفتر خدمة"],
  trade_name_certificate: ["trade name certificate", "شهادة الاسم التجاري", "شهادة تسجيل الاسم"],
  registration_certificate: ["commercial register", "registration certificate", "السجل التجاري", "شهادة التسجيل"],
  chamber_certificate: ["chamber certificate", "membership certificate", "شهادة الانتساب", "شهادة الغرفة"],
  lease_contract: ["lease", "rent contract", "rental contract", "title deed", "owner consent", "owner's consent", "عقد ايجار", "عقد الايجار", "سند ملكية", "موافقة المالك"],
  building_permit: ["occupancy permit", "zoning plan", "building permit", "اذن اشغال", "اذن الاشغال", "مخطط تنظيمي"],
  inspection_undertaking: ["inspection undertaking", "تعهد بالتفتيش", "تعهد التفتيش"],
  no_disturbance_undertaking: ["disturb", "ازعاج"],
  jfda_approval: ["jfda approval", "food and drug approval", "موافقة الغذاء والدواء"],
  memorandum_of_association: ["memorandum", "articles of association", "عقد التاسيس", "النظام الاساسي"],
  bank_capital_letter: ["bank letter", "capital deposit", "كتاب بنكي", "كتاب البنك"],
};

export const INTENT_WORDS = {
  fee: ["fee", "fees", "cost", "how much", "price", "pay", "رسوم", "رسم", "تكلفة", "كلفة", "سعر", "بكم", "قديش", "كم بدفع", "كم ادفع"],
  time: ["how long", "how many days", "days", "take", "duration", "كم يوم", "مدة", "بتاخذ", "تاخذ", "تستغرق", "وقت", "ايام"],
  docs: ["document", "papers", "paperwork", "what do i need", "what i need", "الوثائق", "وثائق", "اوراق", "الاوراق", "مستندات", "المطلوبة", "شو بدي", "شو لازم"],
  where: ["where", "which office", "who issues", "who gives", "which authority", "وين", "اين", "مين", "جهة", "الجهة", "اي دائرة"],
  hours: ["hours", "open", "opening", "working hours", "ساعات", "دوام", "الدوام", "بفتح", "يفتح"],
  contact: ["contact", "phone", "website", "address", "call", "رقم", "هاتف", "تلفون", "موقع", "عنوان"],
  first: ["first step", "first thing", "start", "begin", "اول خطوة", "اول شي", "ابدا", "ابدأ"],
  steps: ["steps", "process", "how do i", "how to", "how can i", "procedure", "الخطوات", "خطوات", "كيف", "اجراءات", "الاجراءات"],
  total: ["total", "altogether", "overall", "whole", "all the fees", "مجموع", "المجموع", "اجمالي", "كل الرسوم", "كامل"],
  obtain: ["get", "obtain", "issue", "احصل", "اطلع", "استخرج"],
  needed: ["do i need", "need a", "need an", "required", "must i", "is a", "هل احتاج", "هل بحتاج", "بحتاج", "لازم", "مطلوب"],
};

/** Words that show a question is about starting a business, so an unmatched question gets "I don't know" rather than "out of scope". */
export const DOMAIN_WORDS = [
  "business", "project", "company", "licen", "regist", "permit", "fee", "tax", "office", "ministry", "bedaya", "startup",
  "مشروع", "شركة", "رخصة", "ترخيص", "تسجيل", "رسوم", "ضريبة", "وزارة", "دائرة", "بداية", "تجاري",
];
