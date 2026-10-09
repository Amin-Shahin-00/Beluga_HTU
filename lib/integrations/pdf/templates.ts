// DEMO FORM TEMPLATES. Stand-ins until M1 delivers the official forms.
// These are NOT official government forms; every generated PDF says so.
// To add a real form: add a template with its fields and (if needed) map it
// onto the official PDF's coordinates in fillForm.ts.

import type { OfficeKey } from "../offices";
import type { BusinessProfile, Field, OcrFields, SanadUser } from "../types";

export interface FormContext {
  user: SanadUser;
  profile: BusinessProfile;
  /** Fields read from the user's uploaded national ID, if any. */
  idOcr?: OcrFields;
}

export interface TemplateField {
  key: string;
  labelAr: string;
  labelEn: string;
  get: (c: FormContext) => Field | undefined;
}

export interface FormTemplate {
  key: string;
  titleAr: string;
  titleEn: string;
  authorityAr: (c: FormContext) => string;
  authorityEn: (c: FormContext) => string;
  /** The office that receives the signed form (see offices.ts). */
  office: (c: FormContext) => OfficeKey;
  /** Whether this form is needed for this user's case. */
  appliesTo: (c: FormContext) => boolean;
  fields: TemplateField[];
  /** Pledge text printed under the fields (pledge forms only). */
  statement?: { ar: string; en: string };
}

const str = (f: Field<unknown> | undefined): Field | undefined =>
  f ? { value: String(f.value), source: f.source } : undefined;

const isLlc = (c: FormContext) => c.profile.legalForm.value === "llc";

const municipalityAr = (c: FormContext) =>
  c.profile.city.value.includes("عم") ? "أمانة عمّان الكبرى" : `بلدية ${c.profile.city.value} الكبرى`;
const municipalityEn = (c: FormContext) =>
  c.profile.city.value.includes("عم") ? "Greater Amman Municipality" : "Greater Irbid Municipality";
const municipality = (c: FormContext): OfficeKey => (c.profile.city.value.includes("عم") ? "GAM" : "IRBID");
/** ISIC 10xx/11xx: food and drink. Decides the JFDA steps, like M1's "if_food" rule. */
export const isFood = (code: string) => /^1[01]/.test(code);

// Fields shared by most forms.
const owner: TemplateField[] = [
  { key: "fullNameAr", labelAr: "الاسم الكامل", labelEn: "Full name (Arabic)", get: (c) => c.user.fullNameAr },
  { key: "fullNameEn", labelAr: "الاسم بالإنجليزية", labelEn: "Full name (English)", get: (c) => c.user.fullNameEn },
  { key: "nationalId", labelAr: "الرقم الوطني", labelEn: "National ID number", get: (c) => ({ value: c.user.nationalId, source: "verified_by_sanad" }) },
  { key: "birthDate", labelAr: "تاريخ الميلاد", labelEn: "Date of birth", get: (c) => c.user.birthDate },
  {
    key: "idExpiry",
    labelAr: "تاريخ انتهاء الهوية",
    labelEn: "ID expiry date",
    get: (c) => (c.idOcr?.expiryDate ? { value: c.idOcr.expiryDate, source: "read_by_ocr" } : undefined),
  },
  { key: "phone", labelAr: "رقم الهاتف", labelEn: "Phone", get: (c) => c.user.phone ?? c.profile.phone },
  { key: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", get: (c) => c.user.email ?? c.profile.email },
];

const business: TemplateField[] = [
  { key: "businessNameAr", labelAr: "الاسم التجاري", labelEn: "Trade name (Arabic)", get: (c) => c.profile.businessNameAr },
  { key: "businessNameEn", labelAr: "الاسم التجاري بالإنجليزية", labelEn: "Trade name (English)", get: (c) => c.profile.businessNameEn },
  { key: "activityAr", labelAr: "النشاط", labelEn: "Activity", get: (c) => c.profile.activityAr },
  { key: "activityCode", labelAr: "رمز النشاط", labelEn: "Activity code", get: (c) => c.profile.activityCode },
  { key: "address", labelAr: "العنوان", labelEn: "Address", get: (c) => c.profile.address },
];

export const TEMPLATES: FormTemplate[] = [
  {
    key: "trade_registration",
    titleAr: "طلب تسجيل مؤسسة فردية",
    titleEn: "Sole Proprietorship Registration Request",
    authorityAr: () => "وزارة الصناعة والتجارة والتموين - السجل التجاري",
    authorityEn: () => "Ministry of Industry, Trade and Supply - Commercial Registry",
    office: () => "MIT",
    appliesTo: (c) => !isLlc(c),
    fields: [
      ...owner,
      ...business,
      { key: "capitalJod", labelAr: "رأس المال (دينار)", labelEn: "Capital (JOD)", get: (c) => str(c.profile.capitalJod) },
    ],
  },
  {
    key: "company_registration",
    titleAr: "طلب تسجيل شركة ذات مسؤولية محدودة",
    titleEn: "Limited Liability Company Registration Request",
    authorityAr: () => "دائرة مراقبة الشركات",
    authorityEn: () => "Companies Control Department",
    office: () => "CCD",
    appliesTo: isLlc,
    fields: [
      ...owner,
      ...business,
      { key: "capitalJod", labelAr: "رأس المال (دينار)", labelEn: "Capital (JOD)", get: (c) => str(c.profile.capitalJod) },
      { key: "partners", labelAr: "عدد الشركاء", labelEn: "Number of partners", get: (c) => str(c.profile.partners) },
    ],
  },
  {
    key: "vocational_license",
    titleAr: "طلب رخصة مهن",
    titleEn: "Vocational License Application",
    authorityAr: municipalityAr,
    authorityEn: municipalityEn,
    office: municipality,
    appliesTo: () => true,
    fields: [
      owner[0],
      owner[2],
      owner[5],
      ...business,
      {
        key: "premises",
        labelAr: "نوع المكان",
        labelEn: "Premises type",
        get: (c) => ({ value: c.profile.homeBased.value ? "منزل (عمل منزلي)" : "محل تجاري", source: c.profile.homeBased.source }),
      },
    ],
  },
  // M1 doc id "declaration_pledge": the applicant signs it, inside Bedaya.
  {
    key: "declaration_pledge",
    titleAr: "نموذج الإقرار والتعهد للعمل من المنزل",
    titleEn: "Home-Based Business Declaration and Pledge",
    authorityAr: municipalityAr,
    authorityEn: municipalityEn,
    office: municipality,
    appliesTo: (c) => c.profile.homeBased.value === true,
    fields: [owner[0], owner[2], owner[5], business[0], business[2], business[4]],
    statement: {
      ar: "أقرّ بأن المعلومات أعلاه صحيحة، وأتعهد بالالتزام بشروط رخصة العمل من المنزل، وبالسماح لموظفي البلدية بالكشف على المكان في أي وقت خلال ساعات العمل.",
      en: "I declare that the information above is correct. I pledge to follow the conditions of the home-based business licence and to let municipality staff inspect the place at any time during working hours.",
    },
  },
  // M1 doc id "inspection_pledge": JFDA, home food businesses only.
  {
    key: "inspection_pledge",
    titleAr: "نموذج التعهد بالتفتيش",
    titleEn: "Pledge for Inspection (Home Food Production)",
    authorityAr: () => "المؤسسة العامة للغذاء والدواء",
    authorityEn: () => "Jordan Food and Drug Administration",
    office: () => "JFDA",
    appliesTo: (c) => c.profile.homeBased.value === true && isFood(c.profile.activityCode.value),
    fields: [owner[0], owner[2], owner[5], business[0], business[2], business[3], business[4]],
    statement: {
      ar: "أتعهد بالسماح لمفتشي المؤسسة العامة للغذاء والدواء بالتفتيش على مكان تحضير الغذاء وأخذ العينات، وبالالتزام بشروط سلامة الغذاء والنظافة.",
      en: "I pledge to let JFDA inspectors inspect the place where the food is prepared and take samples, and to follow food safety and hygiene conditions.",
    },
  },
  {
    key: "tax_registration",
    titleAr: "طلب تسجيل لدى ضريبة الدخل والمبيعات",
    titleEn: "Income and Sales Tax Registration",
    authorityAr: () => "دائرة ضريبة الدخل والمبيعات",
    authorityEn: () => "Income and Sales Tax Department",
    office: () => "ISTD",
    appliesTo: () => true,
    fields: [owner[0], owner[1], owner[2], owner[5], owner[6], business[0], business[1], business[3], business[4]],
  },
];

export function templatesFor(c: FormContext) {
  return TEMPLATES.filter((t) => t.appliesTo(c));
}
