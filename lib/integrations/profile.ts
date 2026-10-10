// Business info the user can read and correct (client dashboard).
// Stand-in for M4's wizard answers: starts from the dummy profile in
// demoData.ts, and any edit is saved in the `profiles` table and marked
// typed_by_user. Legal form and home-based stay as the wizard set them,
// because they decide which forms are needed.

import { demoProfile, demoUser } from "./demoData";
import { isFood } from "./pdf/templates";
import { find, insert, update } from "./store";
import type { BusinessProfile, Field, Sector, UserProfile } from "./types";

export const EDITABLE_TEXT = ["businessNameAr", "businessNameEn", "activityAr", "activityEn", "address"] as const;
export const EDITABLE_NUMBER = ["capitalJod", "partners"] as const;
export type EditableKey = (typeof EDITABLE_TEXT)[number] | (typeof EDITABLE_NUMBER)[number];

const MAX_TEXT = 200;

export function getProfile(nationalId: string): BusinessProfile | null {
  return find("profiles", (p) => p.nationalId === nationalId) ?? demoProfile(nationalId);
}

/** Applies the user's edits. Throws on invalid input; returns the saved profile. */
export function updateProfile(nationalId: string, patch: Partial<Record<EditableKey, unknown>>): BusinessProfile {
  const current = getProfile(nationalId);
  if (!current) throw new Error("No profile for this user. Finish the onboarding wizard first.");
  const next = structuredClone(current);
  const fields = next as unknown as Record<string, Field<unknown>>;

  for (const key of EDITABLE_TEXT) {
    if (patch[key] === undefined) continue;
    const value = String(patch[key]).trim();
    if (value.length > MAX_TEXT) throw new Error(`${key} is longer than ${MAX_TEXT} characters`);
    fields[key] = { value, source: "typed_by_user" };
  }
  for (const key of EDITABLE_NUMBER) {
    if (patch[key] === undefined) continue;
    const value = Number(patch[key]);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a number, 0 or more`);
    fields[key] = { value, source: "typed_by_user" };
  }

  if (find("profiles", (p) => p.nationalId === nationalId)) update("profiles", (p) => p.nationalId === nationalId, next);
  else insert("profiles", next);
  return next;
}

/** Sets the legal structure chosen in Saad (server only): it decides which government forms are needed. */
export function setLegalForm(nationalId: string, legalForm: "home_business" | "sole_proprietorship" | "llc"): BusinessProfile | null {
  const current = getProfile(nationalId);
  if (!current) return null;
  const next = structuredClone(current);
  next.legalForm = { value: legalForm === "llc" ? "llc" : "sole_proprietorship", source: "typed_by_user" };
  next.homeBased = { value: legalForm === "home_business", source: "typed_by_user" };
  if (find("profiles", (p) => p.nationalId === nationalId)) update("profiles", (p) => p.nationalId === nationalId, next);
  else insert("profiles", next);
  return next;
}

// ---------------------------------------------------------------- UserProfile
// Ameen's AI routes (/api/ai/*) take the shared UserProfile. This builds it
// from the signed-in user's SANAD data and business info until M4's wizard
// stores the real one. Answers the wizard hasn't collected yet get defaults.

const CITY_EN: Record<string, string> = { "إربد": "Irbid", "عمّان": "Amman", "عمان": "Amman", "الزرقاء": "Zarqa", "العقبة": "Aqaba" };

function sectorOf(activityCode: string): Sector {
  if (isFood(activityCode)) return "food";
  if (/^(58|6[0-3])/.test(activityCode)) return "tech";
  if (/^4[5-7]/.test(activityCode)) return "retail";
  if (/^0[1-3]/.test(activityCode)) return "agriculture";
  if (/^(55|56|79)/.test(activityCode)) return "tourism";
  return "services";
}

export function toUserProfile(nationalId: string): UserProfile | null {
  const user = demoUser(nationalId);
  const p = getProfile(nationalId);
  if (!user || !p) return null;
  const city = user.city?.value ?? p.city.value;
  return {
    userId: nationalId,
    language: "ar",
    personal: {
      fullNameAr: user.fullNameAr.value,
      fullNameEn: user.fullNameEn.value,
      nationalId,
      birthDate: user.birthDate.value,
      gender: user.gender.value === "F" ? "female" : "male",
      phone: user.phone?.value ?? p.phone.value,
      email: user.email?.value ?? p.email.value,
      city: CITY_EN[city] ?? city,
    },
    business: {
      nameAr: p.businessNameAr.value,
      nameEn: p.businessNameEn.value,
      sector: sectorOf(p.activityCode.value),
      description: p.activityEn.value,
      descriptionAr: p.activityAr.value,
      legalForm: p.legalForm.value === "llc" ? "llc" : p.homeBased.value ? "home_business" : "sole_proprietorship",
      homeBased: p.homeBased.value,
      premises: "owned",
      stage: "idea",
      employeesPlanned: 0,
      wantsTradeName: true,
      startupCapitalJod: p.capitalJod.value,
      fundingNeededJod: 0,
      targetCustomers: "",
      plannedLaunch: "",
    },
  };
}
