// Government offices that receive the signed forms. Each office only sees the
// forms addressed to it (government dashboard). Keys are M1's office ids
// (data/m1/offices.csv); IRBID is ours until M1 adds municipalities outside
// Amman. The review flow itself is a demo stand-in until each office has an
// integration.

export type OfficeKey = "MIT" | "CCD" | "GAM" | "IRBID" | "ISTD" | "JFDA";

export const OFFICES: Record<OfficeKey, { ar: string; en: string }> = {
  MIT: { ar: "وزارة الصناعة والتجارة والتموين - السجل التجاري", en: "Ministry of Industry, Trade and Supply - Commercial Registry" },
  CCD: { ar: "دائرة مراقبة الشركات", en: "Companies Control Department" },
  GAM: { ar: "أمانة عمّان الكبرى", en: "Greater Amman Municipality" },
  IRBID: { ar: "بلدية إربد الكبرى", en: "Greater Irbid Municipality" },
  ISTD: { ar: "دائرة ضريبة الدخل والمبيعات", en: "Income and Sales Tax Department" },
  JFDA: { ar: "المؤسسة العامة للغذاء والدواء", en: "Jordan Food and Drug Administration" },
};

export function isOffice(key: string): key is OfficeKey {
  return key in OFFICES;
}
