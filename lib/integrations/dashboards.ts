// Read-only overviews for the staff dashboards (SANAD/MoDEE and Bedaya admin).
// The government office queue lives in documents.ts (officeDocuments).

import { DEMO_USERS, demoUser } from "./demoData";
import { isBlurry } from "./ocr/mockOcr";
import { list, type DocumentRow } from "./store";

const nameOf = (nationalId: string) => {
  const u = demoUser(nationalId);
  return { nameAr: u?.fullNameAr.value ?? "", nameEn: u?.fullNameEn.value ?? "" };
};

// ---------------------------------------------------------------- SANAD / MoDEE
// What the identity provider sees on its own side. In real life this is
// MoDEE's system, not Bedaya's: shown here only to explain the flow.

export function sanadOverview() {
  const codes = list("mock_sanad_codes").map((c) => ({
    code: c.code.slice(0, 8) + "…",
    nationalId: c.nationalId,
    ...nameOf(c.nationalId),
    scopes: c.scopes,
    // Codes live 5 minutes (mockSanad.ts), so issued = expires - 5 min.
    issuedAt: new Date(new Date(c.expiresAt).getTime() - 5 * 60 * 1000).toISOString(),
    state: c.used ? "used" : new Date(c.expiresAt).getTime() < Date.now() ? "expired" : "waiting",
  }));

  const consentRows = list("consent_log");
  const consents = consentRows
    .filter((r) => r.action !== "data_accessed")
    .map((r) => ({ ...r, ...nameOf(r.nationalId) }));

  const accessByPurpose: Record<string, number> = {};
  for (const r of consentRows) if (r.action === "data_accessed") accessByPurpose[r.purpose] = (accessByPurpose[r.purpose] ?? 0) + 1;

  const docs = list("documents");
  const signatures = list("signatures").map((s) => ({
    ...s,
    ...nameOf(s.nationalId),
    title: docs.find((d) => d.id === s.documentId)?.title ?? "",
  }));

  return {
    codes: codes.reverse(),
    consents: consents.reverse(),
    accessByPurpose,
    signatures: signatures.reverse(),
    payments: list("payments").reverse(),
  };
}

// ---------------------------------------------------------------- Bedaya admin
// Progress and problems per applicant. No files and no personal values beyond
// name and ID: the team supports applicants, it doesn't read their papers.

export function caseStage(docs: DocumentRow[], registered: boolean) {
  const forms = docs.filter((d) => d.kind === "generated");
  const has = (s: string) => forms.some((d) => d.status === s);
  if (forms.length && forms.every((d) => d.status === "approved")) return { key: "approved", ar: "تمت الموافقة", en: "Approved" };
  if (has("returned")) return { key: "returned", ar: "يحتاج تعديلات", en: "Needs fixes" };
  if (has("submitted")) return { key: "submitted", ar: "قيد المراجعة الحكومية", en: "Under government review" };
  if (has("signed")) return { key: "signed", ar: "موقّع، لم يُرسل", en: "Signed, not submitted" };
  if (has("ready_to_sign")) return { key: "ready", ar: "نماذج جاهزة للتوقيع", en: "Forms ready to sign" };
  if (docs.length) return { key: "uploaded", ar: "رفع مستندات", en: "Documents uploaded" };
  if (registered) return { key: "registered", ar: "سجّل الدخول", en: "Logged in, not started" };
  return { key: "none", ar: "لم يسجل بعد", en: "Not registered" };
}

export function adminOverview() {
  const docs = list("documents");
  const consent = list("consent_log");
  const notifications = list("notifications");

  const applicants = DEMO_USERS.map((u) => {
    const mine = docs.filter((d) => d.nationalId === u.nationalId);
    const forms = mine.filter((d) => d.kind === "generated");
    const uploads = mine.filter((d) => d.kind === "upload");
    const warnings: { ar: string; en: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const lastId = uploads.filter((d) => d.docType === "national_id").at(-1);
    if (lastId?.ocr && isBlurry(lastId.ocr)) warnings.push({ ar: "صورة الهوية غير واضحة", en: "ID photo is blurry" });
    if (lastId?.ocr?.fields.expiryDate && lastId.ocr.fields.expiryDate < today) warnings.push({ ar: "الهوية منتهية", en: "ID is expired" });
    if (forms.some((d) => d.missingFields?.length)) warnings.push({ ar: "حقول ناقصة في النماذج", en: "Forms have missing fields" });
    if (forms.some((d) => d.status === "returned")) warnings.push({ ar: "نموذج مُعاد من جهة حكومية", en: "A form was returned by an office" });

    const count = (s: string) => forms.filter((d) => d.status === s).length;
    return {
      nationalId: u.nationalId,
      nameAr: u.fullNameAr.value,
      nameEn: u.fullNameEn.value,
      stage: caseStage(mine, consent.some((r) => r.nationalId === u.nationalId)),
      uploads: uploads.length,
      forms: forms.length,
      signed: forms.filter((d) => d.status !== "ready_to_sign").length,
      submitted: count("submitted"),
      approved: count("approved"),
      returned: count("returned"),
      unread: notifications.filter((n) => n.nationalId === u.nationalId && !n.read).length,
      warnings,
    };
  });

  return {
    applicants,
    totals: {
      applicants: applicants.filter((a) => a.stage.key !== "none").length,
      forms: docs.filter((d) => d.kind === "generated").length,
      waitingOnGovernment: docs.filter((d) => d.status === "submitted").length,
      approved: docs.filter((d) => d.status === "approved").length,
      messages: list("outbox").length,
    },
    outbox: list("outbox").reverse().slice(0, 40),
  };
}
