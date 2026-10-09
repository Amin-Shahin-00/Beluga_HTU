// Consent before pulling SANAD data, and a log entry for every access.

import { insert, list, newId, now } from "./store";
import type { SanadScope } from "./types";

export const SCOPE_LABELS: Record<SanadScope, { ar: string; en: string }> = {
  identity: { ar: "الاسم، الرقم الوطني، تاريخ الميلاد", en: "Name, national ID number, date of birth" },
  contact: { ar: "رقم الهاتف والبريد الإلكتروني", en: "Phone number and email" },
  address: { ar: "مدينة السكن", en: "City of residence" },
};

export function recordConsent(nationalId: string, scopes: SanadScope[], purpose = "sanad_login") {
  return insert("consent_log", { id: newId(), nationalId, action: "consent_given", scopes, purpose, createdAt: now() });
}

export function revokeConsent(nationalId: string, scopes: SanadScope[]) {
  return insert("consent_log", {
    id: newId(),
    nationalId,
    action: "consent_revoked",
    scopes,
    purpose: "user_request",
    createdAt: now(),
  });
}

/** Call every time SANAD-sourced data is read for any purpose. */
export function logAccess(nationalId: string, scopes: SanadScope[], purpose: string) {
  return insert("consent_log", { id: newId(), nationalId, action: "data_accessed", scopes, purpose, createdAt: now() });
}

/** True when the latest consent/revoke entry for each scope is a consent. */
export function hasConsent(nationalId: string, scopes: SanadScope[]) {
  const rows = list("consent_log", (r) => r.nationalId === nationalId && r.action !== "data_accessed");
  return scopes.every((scope) => {
    const last = [...rows].reverse().find((r) => r.scopes.includes(scope));
    return last?.action === "consent_given";
  });
}

export function consentHistory(nationalId: string) {
  return list("consent_log", (r) => r.nationalId === nationalId);
}
