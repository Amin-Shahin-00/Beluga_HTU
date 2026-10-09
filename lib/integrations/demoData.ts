// DUMMY DATA ONLY. Fake people, fake ID numbers (999… prefix), example.com
// emails. Stands in for what SANAD returns and for M4's wizard answers.

import type { BusinessProfile, SanadUser } from "./types";

const s = <T>(value: T) => ({ value, source: "verified_by_sanad" as const });
const t = <T>(value: T) => ({ value, source: "typed_by_user" as const });

export const DEMO_USERS: SanadUser[] = [
  {
    nationalId: "9990000001",
    fullNameAr: s("ليلى محمود أحمد"),
    fullNameEn: s("Layla Mahmoud Ahmad"),
    birthDate: s("1995-03-14"),
    gender: s("F"),
    phone: s("+962790000001"),
    email: s("layla.demo@example.com"),
    city: s("إربد"),
    address: s("إربد، حي النزهة، شارع 12، بناية 7"),
  },
  {
    nationalId: "9990000002",
    fullNameAr: s("عمر خالد يوسف"),
    fullNameEn: s("Omar Khaled Yousef"),
    birthDate: s("1990-11-02"),
    gender: s("M"),
    phone: s("+962790000002"),
    email: s("omar.demo@example.com"),
    city: s("عمّان"),
    address: s("عمّان، الشميساني، شارع 5، بناية 21"),
  },
  {
    // No Bedaya account yet: use this person to try "Create account with SANAD".
    nationalId: "9990000003",
    fullNameAr: s("رامي سامي صالح"),
    fullNameEn: s("Rami Sami Saleh"),
    birthDate: s("1998-07-21"),
    gender: s("M"),
    phone: s("+962790000003"),
    email: s("rami.demo@example.com"),
    city: s("الزرقاء"),
    address: s("الزرقاء، حي الأمير محمد، شارع 3، بناية 9"),
  },
];

/** MOCK SANAD passwords (the real SANAD checks its own credentials). Listed in the README only. */
export const MOCK_SANAD_PASSWORDS: Record<string, string> = {
  "9990000001": "Sanad2026!",
  "9990000002": "Sanad2026!",
  "9990000003": "Sanad2026!",
};

/** Wizard answers (feature 1) for each demo user. Owned by M4 in the real app. */
export const DEMO_PROFILES: BusinessProfile[] = [
  {
    nationalId: "9990000001",
    businessNameAr: t("مخبز ليلى المنزلي"),
    businessNameEn: t("Layla's Home Bakery"),
    activityAr: t("صناعة المخبوزات والحلويات منزليًا"),
    activityEn: t("Home-based baking and sweets"),
    activityCode: t("1071"),
    city: s("إربد"),
    address: t("إربد، حي النزهة، شارع 12، بناية 7"),
    homeBased: t(true),
    legalForm: t("sole_proprietorship"),
    capitalJod: t(1500),
    partners: t(0),
    phone: s("+962790000001"),
    email: s("layla.demo@example.com"),
  },
  {
    nationalId: "9990000002",
    businessNameAr: t("شركة عمر للخدمات الرقمية ذ.م.م"),
    businessNameEn: t("Omar Digital Services LLC"),
    activityAr: t("خدمات تصميم وتطوير المواقع"),
    activityEn: t("Web design and development services"),
    activityCode: t("6201"),
    city: s("عمّان"),
    address: t("عمّان، الشميساني، شارع 5، بناية 21"),
    homeBased: t(false),
    legalForm: t("llc"),
    capitalJod: t(5000),
    partners: t(2),
    phone: s("+962790000002"),
    email: s("omar.demo@example.com"),
  },
];

export const LAYLA_ID = "9990000001";

export function demoUser(nationalId: string) {
  return DEMO_USERS.find((u) => u.nationalId === nationalId) ?? null;
}

export function demoProfile(nationalId: string) {
  return DEMO_PROFILES.find((p) => p.nationalId === nationalId) ?? null;
}
