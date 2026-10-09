// Shared M5 contracts (Ameen + M5 partner). Locked in Step 0.
// Agree with your M5 partner before changing any shape in this file.

export type Lang = "ar" | "en";

export type Bilingual = { ar: string; en: string };

/** Document kinds the OCR route can recognise. Matches `ocr_doc_type` in data/m1/documents.csv. */
export type DocType =
  | "national_id"
  | "passport"
  | "trade_name_certificate"
  | "registration_certificate"
  | "lease_contract"
  | "home_business_consent"
  | "health_certificate"
  | "memorandum_of_association"
  | "bank_capital_letter"
  | "civil_defense_approval"
  | "unknown";

export interface OcrFields {
  /** Name as printed on the document (Arabic on a Jordanian ID). */
  name?: string;
  nameEn?: string;
  /** Jordanian national number, 10 digits. */
  nationalId?: string;
  /** ISO date, yyyy-mm-dd. */
  expiryDate?: string;
  issueDate?: string;
  birthDate?: string;
  documentNumber?: string;
  [key: string]: string | undefined;
}

/**
 * Output of the partner's OCR route, input of Ameen's document checker.
 * `fileId` and `fileName` were added to the original shape so warnings can be shown per file.
 */
export interface OcrResult {
  fileId: string;
  fileName: string;
  docType: DocType;
  fields: OcrFields;
  /** OCR text confidence, 0..1. Below 0.6 counts as blurry. */
  confidence: number;
  /** Image sharpness/lighting score, 0..1. Below 0.5 counts as blurry. */
  imageQuality: number;
}

export const BLUR_THRESHOLDS = { minConfidence: 0.6, minImageQuality: 0.5 } as const;

export type LegalForm = "home_business" | "sole_proprietorship" | "llc";

export type Sector = "food" | "retail" | "tech" | "crafts" | "services" | "agriculture" | "tourism";

export type Stage = "idea" | "prototype" | "revenue";

/** The onboarding wizard answers. Assumed M4 format; swap in M4's real type when it lands. */
export interface UserProfile {
  userId: string;
  language: Lang;
  personal: {
    fullNameAr: string;
    fullNameEn: string;
    nationalId: string;
    birthDate: string;
    gender: "female" | "male";
    phone: string;
    email: string;
    city: string;
  };
  business: {
    nameAr: string;
    nameEn: string;
    sector: Sector;
    description: string;
    legalForm: LegalForm;
    homeBased: boolean;
    stage: Stage;
    employeesPlanned: number;
    startupCapitalJod: number;
    fundingNeededJod: number;
    targetCustomers: string;
    /** yyyy-mm */
    plannedLaunch: string;
  };
}

/** One field on an incubator's application form (from M1's incubator list). */
export interface ApplicationField {
  key: string;
  label: Bilingual;
  type: "text" | "textarea" | "email" | "phone" | "number" | "date" | "select";
  required: boolean;
  maxLength?: number;
  options?: string[];
}

export interface Incubator {
  id: string;
  name: Bilingual;
  city: string;
  sectors: Sector[];
  stages: Stage[];
  womenFocused: boolean;
  homeBasedFriendly: boolean;
  maxFundingJod: number;
  programWeeks: number;
  applicationDeadline: string;
  applicationFields: ApplicationField[];
}

/** A question from M1's test set used to grade the AI assistant. */
export interface TestQuestion {
  id: string;
  lang: Lang;
  question: string;
  expect: {
    /** answer: must answer from data; unknown_redirect: must say it doesn't know and name an office; out_of_scope: must decline. */
    kind: "answer" | "unknown_redirect" | "out_of_scope";
    /** Each inner array is a group of alternatives; the answer must contain one item from every group. */
    mustMention: string[][];
  };
}
