// Typed access to knowledge.json (built from M1's spreadsheet by scripts/build-knowledge.mjs).
import raw from "./knowledge.json";
import { pick, t } from "./text";
import type { Bilingual, Lang, LegalForm, UserProfile } from "./types";

export interface Source {
  id: string;
  title: Bilingual;
  url: string;
  accessed: string;
  note: string;
}

export interface Office {
  id: string;
  name: Bilingual;
  city: string;
  address: Bilingual;
  hours: Bilingual | null;
  phone: string | null;
  website: string;
  sourceIds: string[];
}

export interface DocumentInfo {
  id: string;
  name: Bilingual;
  issuedBy: string;
  issuedByStep: string[];
  hasExpiry: boolean;
  ocrDocType: string;
  notes: Bilingual | null;
}

export type Condition = "always" | "optional" | "if_food" | "if_employees" | "if_trade_name" | "if_male_born_1989_plus";

export interface Step {
  order: number;
  id: string;
  title: Bilingual;
  officeId: string;
  requiredDocs: { docId: string; condition: Condition }[];
  fee: { minJod: number | null; maxJod: number | null; note: Bilingual; verified: string };
  days: { value: number | null; note: Bilingual; verified: string };
  condition: Condition;
  notes: Bilingual;
  sourceIds: string[];
}

export interface LegalFormInfo {
  id: LegalForm;
  name: Bilingual;
  steps: Step[];
}

export interface Fact {
  id: string;
  kind: "answer" | "unknown_redirect";
  match: string[][];
  text: Bilingual;
  officeIds: string[];
  sourceIds: string[];
  boost?: number;
}

export interface Knowledge {
  version: string;
  disclaimer: Bilingual;
  sources: Record<string, Source>;
  offices: Record<string, Office>;
  documents: Record<string, DocumentInfo>;
  legalForms: Record<LegalForm, LegalFormInfo>;
  facts: Fact[];
}

export const knowledge = raw as unknown as Knowledge;

export const office = (id: string) => knowledge.offices[id];
export const doc = (id: string) => knowledge.documents[id];

/** Whether a step or document condition applies to this user. Without a profile only "always" holds. */
export function conditionHolds(condition: Condition, profile?: UserProfile): boolean {
  if (condition === "always") return true;
  if (!profile) return false;
  const b = profile.business;
  switch (condition) {
    case "optional":
    case "if_trade_name":
      return b.wantsTradeName ?? false;
    case "if_food":
      return b.sector === "food";
    case "if_employees":
      return b.employeesPlanned > 0;
    case "if_male_born_1989_plus":
      return profile.personal.gender === "male" && Number(profile.personal.birthDate.slice(0, 4)) >= 1989;
  }
}

/** The steps this user has to go through, in order. */
export function roadmapFor(profile: UserProfile): Step[] {
  return knowledge.legalForms[profile.business.legalForm].steps.filter((s) => conditionHolds(s.condition, profile));
}

export function conditionLabel(condition: Condition, lang: Lang): string {
  const labels: Record<Condition, Bilingual> = {
    always: { en: "", ar: "" },
    optional: { en: "optional", ar: "اختياري" },
    if_trade_name: { en: "only if you register a trade name", ar: "فقط إذا سجلت اسماً تجارياً" },
    if_food: { en: "only for food businesses", ar: "فقط للمشاريع الغذائية" },
    if_employees: { en: "only once you have employees", ar: "فقط عند وجود موظفين" },
    if_male_born_1989_plus: { en: "only for Jordanian males born 1989 or later", ar: "فقط للذكور الأردنيين مواليد 1989 فما فوق" },
  };
  return pick(labels[condition], lang);
}

export function feeText(step: Step, lang: Lang): string {
  const unverified = step.fee.verified !== "yes" && step.fee.minJod !== null;
  return pick(step.fee.note, lang) + (unverified ? t(lang, " (please confirm with the office)", " (يرجى التأكد من الجهة)") : "");
}

export function officeLine(id: string, lang: Lang): string {
  const o = office(id);
  const parts = [pick(o.name, lang), pick(o.address, lang)];
  if (o.hours) parts.push(pick(o.hours, lang));
  if (o.phone) parts.push(o.phone);
  parts.push(o.website);
  return parts.filter(Boolean).join(" · ");
}
