// Document vault service: upload + OCR (feature 3), auto-fill (feature 3),
// sign all (feature 4), then submit to government and the office's review.
// API routes call these; M3's screens call the routes.

import { createHash } from "crypto";
import { logAccess } from "./consent";
import { demoUser } from "./demoData";
import { notify } from "./notify";
import { getOcrProvider, isBlurry } from "./ocr/mockOcr";
import { OFFICES, type OfficeKey } from "./offices";
import { fillForm } from "./pdf/fillForm";
import { templatesFor } from "./pdf/templates";
import { getProfile } from "./profile";
import { getSignatureProvider, sanadMode } from "./sanad";
import { find, getFile, insert, list, newId, now, putFile, remove, update, type DocumentRow, type DocumentStatus, type ReviewDecision } from "./store";
import type { DocType, OcrResult } from "./types";

/** Statuses that are final for the user: generate keeps these forms as they are. */
const LOCKED: DocumentStatus[] = ["signed", "submitted", "approved"];

// ---------------------------------------------------------------- upload

export async function uploadDocument(
  nationalId: string,
  file: { name: string; mimeType: string; bytes: Uint8Array },
  hint?: DocType,
): Promise<DocumentRow> {
  const id = newId();
  const ocr = await getOcrProvider().scan({ id, ...file }, hint, { nationalId });
  putFile(id, file.bytes);
  const row: DocumentRow = {
    id,
    nationalId,
    kind: "upload",
    docType: ocr.docType,
    title: DOC_TITLES[ocr.docType] ?? file.name,
    fileName: file.name,
    mimeType: file.mimeType,
    status: "uploaded",
    ocr,
    createdAt: now(),
    updatedAt: now(),
  };
  insert("documents", row);
  return row;
}

const DOC_TITLES: Record<string, string> = {
  national_id: "National ID | الهوية الوطنية",
  lease_contract: "Lease contract | عقد الإيجار",
  property_ownership_document: "Title deed | سند ملكية العقار",
  property_owner_approval: "Property owner approval | موافقة مالك العقار",
};

// ---------------------------------------------------------------- auto-fill

export interface GenerateResult {
  generated: DocumentRow[];
  /** Forms already signed, submitted or approved are kept, not regenerated. Returned forms are regenerated. */
  keptSigned: DocumentRow[];
}

export async function generateForms(nationalId: string): Promise<GenerateResult> {
  // Real app: user from the session (SANAD), profile from M4's wizard tables.
  const user = demoUser(nationalId);
  const profile = getProfile(nationalId);
  if (!user || !profile) throw new Error("No profile for this user. Finish the onboarding wizard first.");

  // Use the newest clear ID scan; fall back to the newest scan of any quality.
  const idScans = list("documents", (d) => d.nationalId === nationalId && d.kind === "upload" && d.docType === "national_id");
  const idUpload = [...idScans].reverse().find((d) => d.ocr && !isBlurry(d.ocr)) ?? idScans[idScans.length - 1];
  const ctx = { user, profile, idOcr: idUpload?.ocr?.fields };
  logAccess(nationalId, ["identity", "contact"], "form_autofill");

  const generated: DocumentRow[] = [];
  const keptSigned: DocumentRow[] = [];
  for (const t of templatesFor(ctx)) {
    const existing = find("documents", (d) => d.nationalId === nationalId && d.kind === "generated" && d.docType === t.key);
    if (existing && LOCKED.includes(existing.status)) {
      keptSigned.push(existing);
      continue;
    }
    const id = existing?.id ?? newId();
    const ref = `BDY-${nationalId.slice(-4)}-${t.key.slice(0, 3).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`;
    const filled = await fillForm(t, ctx, ref);
    putFile(id, filled.bytes);
    const row: DocumentRow = {
      id,
      nationalId,
      kind: "generated",
      docType: t.key,
      title: `${t.titleEn} | ${t.titleAr}`,
      fileName: `${t.key}.pdf`,
      mimeType: "application/pdf",
      status: "ready_to_sign",
      fieldSources: filled.fieldSources,
      missingFields: filled.missing,
      office: t.office(ctx),
      // A returned form starts over: clear the old submission and decision.
      submittedAt: undefined,
      review: undefined,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    if (existing) update("documents", (d) => d.id === id, row);
    else insert("documents", row);
    generated.push(row);
  }

  if (generated.length) notify(nationalId, "forms_ready", { count: generated.length });
  return { generated, keptSigned };
}

/**
 * After the legal structure changes, unsigned forms the new structure doesn't need are withdrawn.
 * Signed, submitted or approved forms are never touched.
 */
export function withdrawUnneededForms(nationalId: string): number {
  const user = demoUser(nationalId);
  const profile = getProfile(nationalId);
  if (!user || !profile) return 0;
  const needed = new Set(templatesFor({ user, profile }).map((t) => t.key));
  return remove("documents", (d) => d.nationalId === nationalId && d.kind === "generated" && !LOCKED.includes(d.status) && !needed.has(d.docType));
}

// ---------------------------------------------------------------- sign all

export interface SignAllResult {
  signed: { documentId: string; title: string; signatureRef: string; hash: string; signedAt: string }[];
}

export async function signAll(nationalId: string, documentIds?: string[]): Promise<SignAllResult> {
  const docs = list(
    "documents",
    (d) => d.nationalId === nationalId && d.status === "ready_to_sign" && (!documentIds || documentIds.includes(d.id)),
  );
  if (!docs.length) return { signed: [] };

  const toSign = docs.map((d) => ({ documentId: d.id, title: d.title, pdf: getFile(d.id)! }));
  const results = await getSignatureProvider().signDocuments(nationalId, toSign);

  for (const r of results) {
    putFile(`${r.documentId}.unsigned`, getFile(r.documentId)!);
    putFile(r.documentId, r.signedPdf);
    update("documents", (d) => d.id === r.documentId, { status: "signed", updatedAt: now() });
    insert("signatures", {
      id: newId(),
      documentId: r.documentId,
      nationalId,
      provider: sanadMode() === "real" ? "sanad" : "mock_sanad",
      signatureRef: r.signatureRef,
      hash: r.hash,
      signedAt: r.signedAt,
    });
  }
  notify(nationalId, "documents_signed", { count: results.length });

  return {
    signed: results.map((r) => ({
      documentId: r.documentId,
      title: docs.find((d) => d.id === r.documentId)!.title,
      signatureRef: r.signatureRef,
      hash: r.hash,
      signedAt: r.signedAt,
    })),
  };
}

// ---------------------------------------------------------------- submit
// Sends every signed form to its office. Real app: each office's own system.

export function submitAll(nationalId: string): DocumentRow[] {
  const docs = list("documents", (d) => d.nationalId === nationalId && d.kind === "generated" && d.status === "signed");
  const at = now();
  // Forms generated before offices existed have no office yet: look it up from the template.
  const user = demoUser(nationalId);
  const profile = getProfile(nationalId);
  const templates = user && profile ? templatesFor({ user, profile }) : [];
  for (const d of docs) {
    const office = d.office ?? templates.find((t) => t.key === d.docType)?.office({ user: user!, profile: profile! });
    update("documents", (r) => r.id === d.id, { status: "submitted", submittedAt: at, office, updatedAt: at });
  }
  if (docs.length) notify(nationalId, "forms_submitted", { count: docs.length });
  return docs.map((d) => ({ ...d, status: "submitted" as const, submittedAt: at }));
}

// ---------------------------------------------------------------- office review

/** Forms an office has received, newest first. An office never sees another office's forms. */
export function officeDocuments(office: OfficeKey) {
  const visible: DocumentStatus[] = ["submitted", "approved", "returned"];
  return list("documents", (d) => d.office === office && visible.includes(d.status)).sort((a, b) =>
    (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""),
  );
}

export function getOfficeDocument(office: OfficeKey, id: string) {
  return officeDocuments(office).find((d) => d.id === id) ?? null;
}

export function reviewDocument(office: OfficeKey, id: string, decision: ReviewDecision, note?: string): DocumentRow {
  const doc = getOfficeDocument(office, id);
  if (!doc) throw new Error("This form was not sent to your office");
  if (doc.status !== "submitted") throw new Error("This form was already reviewed");
  const cleanNote = note?.trim().slice(0, 500) || undefined;
  if (decision === "returned" && !cleanNote) throw new Error("Write a note so the applicant knows what to fix");

  const at = now();
  const review = { decision, note: cleanNote, at };
  update("documents", (d) => d.id === id, { status: decision, review, updatedAt: at });
  insert("reviews", { id: newId(), documentId: id, nationalId: doc.nationalId, office, decision, note: cleanNote, createdAt: at });
  logAccess(doc.nationalId, ["identity", "contact"], `gov_review:${office}`);

  const [formEn, formAr] = doc.title.split(" | ");
  notify(doc.nationalId, decision === "approved" ? "form_approved" : "form_returned", {
    officeAr: OFFICES[office].ar,
    officeEn: OFFICES[office].en,
    formAr: formAr ?? doc.title,
    formEn: formEn ?? doc.title,
    note: cleanNote ?? "",
  });
  return { ...doc, status: decision, review, updatedAt: at };
}

/**
 * True when the stored PDF is byte-for-byte the one that was signed, so
 * nobody changed it after signing. Real SANAD: verify the PDF signature itself.
 */
export function verifySignature(documentId: string) {
  const sig = getSignature(documentId);
  const bytes = getFile(documentId);
  if (!sig || !bytes) return { signed: false, valid: false };
  const hash = createHash("sha256").update(bytes).digest("hex");
  return { signed: true, valid: hash === sig.hash, signatureRef: sig.signatureRef, signedAt: sig.signedAt };
}

// ---------------------------------------------------------------- for the document checker
// Ameen's checker (POST /api/ai/documents/check) takes OcrResult[]. Uploads
// give their OCR result. Pledge forms signed in Bedaya count as provided, so
// the checker doesn't ask for them again.

/** M1 document ids the applicant signs inside Bedaya (data/m1/documents.csv). */
const SIGNED_IN_APP = ["declaration_pledge", "inspection_pledge"];

export function ocrResults(nationalId: string): OcrResult[] {
  const uploads = list("documents", (d) => d.nationalId === nationalId && d.kind === "upload" && !!d.ocr).map((d) => d.ocr!);
  const signedPledges = list(
    "documents",
    (d) => d.nationalId === nationalId && d.kind === "generated" && SIGNED_IN_APP.includes(d.docType) && !["ready_to_sign", "returned"].includes(d.status),
  ).map(
    (d): OcrResult => ({
      fileId: d.id,
      fileName: d.fileName,
      docType: d.docType as DocType,
      fields: { name: demoUser(nationalId)?.fullNameAr.value },
      confidence: 1,
      imageQuality: 1,
    }),
  );
  return [...uploads, ...signedPledges];
}

// ---------------------------------------------------------------- read

export function listDocuments(nationalId: string) {
  return list("documents", (d) => d.nationalId === nationalId);
}

export function getDocument(nationalId: string, id: string) {
  return find("documents", (d) => d.nationalId === nationalId && d.id === id) ?? null;
}

export function getDocumentFile(nationalId: string, id: string) {
  const doc = getDocument(nationalId, id);
  return doc ? { doc, bytes: getFile(id) } : null;
}

/** The latest signature (a returned form that was fixed and signed again has several). */
export function getSignature(documentId: string) {
  const rows = list("signatures", (s) => s.documentId === documentId);
  return rows[rows.length - 1] ?? null;
}
