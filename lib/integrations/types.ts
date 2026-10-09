// Shared M5 contracts (Ameen + M5 partner). Locked in Step 0.
// Agree with your M5 partner before changing any shape in this file.

export type Lang = "ar" | "en";

export type Bilingual = { ar: string; en: string };

/** Document kinds the OCR route can recognise. Matches `ocr_doc_type` in data/m1/documents.csv. */
export type DocType =
  | "national_id"
  | "passport"
  | "service_booklet"
  | "trade_name_certificate"
  | "registration_certificate"
  | "chamber_certificate"
  | "lease_contract"
  | "property_ownership_document"
  | "property_owner_approval"
  | "declaration_pledge"
  | "building_documents"
  | "building_residents_consent"
  | "inspection_pledge"
  | "product_label"
  | "gam_rental_certificate"
  | "jfda_approval"
  | "vocational_licence"
  | "liaison_officer_form"
  | "memorandum_of_association"
  | "bank_capital_letter"
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
    /** Arabic versions of the free-text answers, if the wizard collected them. */
    descriptionAr?: string;
    legalForm: LegalForm;
    homeBased: boolean;
    /** Whether the home or shop is rented or owned; decides the rent-contract steps. Defaults to rented. */
    premises?: "rented" | "owned";
    stage: Stage;
    employeesPlanned: number;
    /** Registers a trade name instead of trading under the owner's own name. */
    wantsTradeName?: boolean;
    startupCapitalJod: number;
    fundingNeededJod: number;
    targetCustomers: string;
    targetCustomersAr?: string;
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

/** A real support programme (incubator, accelerator, grant, loan or competition) from M1's list. */
export interface Incubator {
  id: string;
  type: "incubator" | "accelerator" | "grant" | "loan" | "competition";
  name: Bilingual;
  organisation: Bilingual;
  city: string;
  sectors: Sector[];
  stages: Stage[];
  womenFocused: boolean;
  homeBasedFriendly: boolean;
  /** Largest amount on offer, or null when not published. */
  maxFundingJod: number | null;
  fundingNote: Bilingual | null;
  benefits: Bilingual;
  programWeeks: number | null;
  /** yyyy-mm-dd, or null when applications are rolling or not announced. */
  applicationDeadline: string | null;
  /** Rules we can check against the profile. */
  eligibility: { minAge?: number; maxAge?: number; jordanianOnly?: boolean; minMonthsOperating?: number };
  /** Conditions the user must confirm themselves. */
  requirements: Bilingual[];
  website: string;
  sourceIds: string[];
  /** The real forms are online and not published; these are the fields we expect them to ask for. */
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

// ======================================================================
// M5 partner: identity, documents, signing. Added when merging into the team
// repo; nothing above was changed. OCR uses OcrResult and DocType from above.
// SANAD-ready: login, signing and payments go through the three provider
// interfaces below. MockSanad implements them today; the real SANAD adapter
// becomes a second implementation once MoDEE approves.

/** Where a value came from. Every field shown to the user carries one. */
export type Source = "verified_by_sanad" | "typed_by_user" | "read_by_ocr";

export interface Field<T = string> {
  value: T;
  source: Source;
}

/** Data scopes the user must consent to before we pull them from SANAD. */
export type SanadScope = "identity" | "contact" | "address";

export interface SanadUser {
  /** National ID number: the main user key across M5. */
  nationalId: string;
  fullNameAr: Field;
  fullNameEn: Field;
  birthDate: Field; // YYYY-MM-DD
  gender: Field<"M" | "F">;
  phone?: Field;
  email?: Field;
  city?: Field;
}

export interface IdentityProvider {
  /** URL to send the browser to for "Login with SANAD". */
  getLoginUrl(returnUrl: string, scopes: SanadScope[]): string;
  /** Exchange the one-time code from the callback for verified user data. */
  exchangeCode(code: string): Promise<SanadUser>;
}

export interface DocumentToSign {
  documentId: string;
  title: string;
  pdf: Uint8Array;
}

export interface SignedDocument {
  documentId: string;
  signedPdf: Uint8Array;
  /** SHA-256 of the signed PDF bytes. */
  hash: string;
  signedAt: string; // ISO timestamp
  /** Reference the signature provider gives the signature. */
  signatureRef: string;
}

export interface SignatureProvider {
  /** Sign all documents in one session ("sign all"). */
  signDocuments(nationalId: string, docs: DocumentToSign[]): Promise<SignedDocument[]>;
}

export type PaymentStatus = "pending" | "paid" | "failed";

export interface Payment {
  paymentId: string;
  nationalId: string;
  amountJod: number;
  description: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface PaymentProvider {
  createPayment(nationalId: string, amountJod: number, description: string): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment | null>;
}

/** Produces the OcrResult above. OCR_PROVIDER=mock today; tesseract/cloud later. */
export interface OcrProvider {
  scan(
    /** `id` becomes OcrResult.fileId (the stored document's id). */
    file: { id: string; name: string; mimeType: string; bytes: Uint8Array },
    hint?: DocType,
    /** Who uploaded it. Real OCR ignores this; the mock uses it to pick dummy data. */
    context?: { nationalId?: string },
  ): Promise<OcrResult>;
}

/**
 * The business answers M5's forms are filled from, each value with its source.
 * Stand-in for M4's wizard output; toUserProfile() in profile.ts converts it
 * to the UserProfile above for the AI routes.
 */
export interface BusinessProfile {
  nationalId: string;
  businessNameAr: Field;
  businessNameEn: Field;
  activityAr: Field;
  activityEn: Field;
  /** ISIC activity code, dummy for the demo. 10xx/11xx = food. */
  activityCode: Field;
  city: Field;
  address: Field;
  homeBased: Field<boolean>;
  legalForm: Field<"sole_proprietorship" | "llc">;
  capitalJod: Field<number>;
  partners: Field<number>;
  phone: Field;
  email: Field;
}
