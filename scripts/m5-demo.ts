// Runs Layla's M5 path end to end with dummy data, no network:
// SANAD mock login → upload ID (mock OCR) → auto-fill forms → sign all →
// submit + office review → document check → notifications. PDFs land in output/. Run: npm run demo:m5

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { consentHistory } from "../lib/integrations/consent";
import { LAYLA_ID, MOCK_SANAD_PASSWORDS } from "../lib/integrations/demoData";
import { checkDocuments } from "../lib/integrations/document-checker";
import { generateForms, getDocumentFile, listDocuments, ocrResults, reviewDocument, signAll, submitAll, uploadDocument } from "../lib/integrations/documents";
import { EINVOICING_SETUP } from "../lib/integrations/einvoicing";
import { listNotifications, listOutbox, notify } from "../lib/integrations/notify";
import { toUserProfile } from "../lib/integrations/profile";
import { getIdentityProvider, getMockSanad } from "../lib/integrations/sanad";
import { getFile, resetStore } from "../lib/integrations/store";

const OUT = join(process.cwd(), "output");
const line = (s = "") => console.log(s);
const step = (n: number, s: string) => line(`\n[${n}] ${s}`);

async function main() {
  resetStore();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "unsigned"), { recursive: true });
  mkdirSync(join(OUT, "signed"), { recursive: true });

  line("Bedaya M5 demo: Layla opens a home bakery in Irbid (all data is dummy)");

  // 1. Login with SANAD (mock)
  step(1, "Login with SANAD (MOCK)");
  const idp = getIdentityProvider();
  const url = idp.getLoginUrl("/roadmap", ["identity", "contact", "address"]);
  line(`    login URL: ${url}`);
  const code = getMockSanad().authorize(LAYLA_ID, ["identity", "contact", "address"], MOCK_SANAD_PASSWORDS[LAYLA_ID]);
  const user = await idp.exchangeCode(code);
  line(`    signed in: ${user.fullNameEn.value} (${user.nationalId})`);
  for (const [k, v] of Object.entries(user)) {
    if (v && typeof v === "object") line(`      ${k.padEnd(11)} ${String(v.value).padEnd(24)} ${v.source}`);
  }

  // 2. Upload national ID → mock OCR
  step(2, "Upload national ID (mock OCR)");
  for (const name of ["layla-national-id.png", "layla-national-id-blurry.png", "layla-national-id-expired.png"]) {
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), "assets", "samples", name)));
    const doc = await uploadDocument(LAYLA_ID, { name, mimeType: "image/png", bytes }, "national_id");
    const o = doc.ocr!;
    line(`    ${name.padEnd(32)} quality=${String(o.imageQuality).padEnd(4)} confidence=${o.confidence} expiry=${o.fields.expiryDate ?? "-"}`);
  }
  // The good scan last, so forms use it.
  await uploadDocument(
    LAYLA_ID,
    { name: "layla-national-id.png", mimeType: "image/png", bytes: new Uint8Array(readFileSync(join(process.cwd(), "assets", "samples", "layla-national-id.png"))) },
    "national_id",
  );

  // 3. Auto-fill forms
  step(3, "Auto-fill government forms (pdf-lib, Arabic + English)");
  const { generated } = await generateForms(LAYLA_ID);
  for (const d of generated) {
    writeFileSync(join(OUT, "unsigned", d.fileName), getFile(d.id)!);
    const sources = Object.values(d.fieldSources ?? {});
    const count = (s: string) => sources.filter((x) => x === s).length;
    line(
      `    ${d.fileName.padEnd(32)} SANAD=${count("verified_by_sanad")} OCR=${count("read_by_ocr")} typed=${count("typed_by_user")} missing=${d.missingFields?.length ?? 0}`,
    );
  }

  // 4. Sign all in one session
  step(4, "Sign all documents in one session (SANAD MOCK)");
  const { signed } = await signAll(LAYLA_ID);
  for (const s of signed) {
    const f = getDocumentFile(LAYLA_ID, s.documentId)!;
    writeFileSync(join(OUT, "signed", f.doc.fileName), f.bytes!);
    line(`    ${f.doc.fileName.padEnd(32)} ${s.signatureRef}  sha256=${s.hash.slice(0, 16)}...`);
  }

  // 5. Submit to the offices; two offices review
  step(5, "Submit to government offices; offices review (demo)");
  submitAll(LAYLA_ID);
  const byKey = (k: string) => listDocuments(LAYLA_ID).find((d) => d.docType === k)!;
  reviewDocument("IRBID", byKey("vocational_license").id, "approved");
  reviewDocument("JFDA", byKey("inspection_pledge").id, "returned", "Please add the kitchen area in square metres.");
  for (const d of listDocuments(LAYLA_ID).filter((d) => d.kind === "generated")) {
    line(`    ${d.fileName.padEnd(32)} ${d.office?.padEnd(6)} ${d.status}${d.review?.note ? `: ${d.review.note}` : ""}`);
  }

  // 6. Ameen's document checker on Layla's files (uploads + signed pledges)
  step(6, "Document check (Ameen's checker, feature 9) on Layla's own files");
  const check = await checkDocuments({ profile: toUserProfile(LAYLA_ID)!, files: ocrResults(LAYLA_ID) });
  line(`    summary: ${JSON.stringify(check.summary)}`);
  for (const f of check.files.filter((f) => f.warnings.length)) line(`    ${f.fileName}: ${f.warnings.map((w) => w.code).join(", ")}`);
  for (const m of check.missing) line(`    ${m.severity === "error" ? "missing" : "later  "} ${m.docId}`);

  // 7. Notifications
  step(7, "Notifications (in-app saved; email logged; WhatsApp would-send)");
  notify(LAYLA_ID, "document_needed", {
    docAr: "إثبات ملكية المنزل",
    docEn: "home ownership proof",
    stepAr: "رخصة المهن",
    stepEn: "Vocational license",
  });
  notify(LAYLA_ID, "visit_soon", { placeAr: "بلدية إربد الكبرى", placeEn: "Greater Irbid Municipality", date: "2026-10-14", time: "10:00" });
  notify(LAYLA_ID, "step_changed", { stepAr: "التسجيل التجاري", stepEn: "Trade registration", statusAr: "مكتملة", statusEn: "Done" });
  for (const n of listNotifications(LAYLA_ID)) line(`    [${n.event}] ${n.titleEn}: ${n.bodyEn}`);
  const outbox = listOutbox();
  line(`    outbox: ${outbox.filter((o) => o.channel === "email").length} emails logged, ${outbox.filter((o) => o.channel === "whatsapp").length} WhatsApp would-send`);

  // 8. Consent log and e-invoicing content
  step(8, "Consent and access log");
  for (const c of consentHistory(LAYLA_ID)) line(`    ${c.createdAt.slice(11, 19)} ${c.action.padEnd(14)} ${c.purpose.padEnd(14)} ${c.scopes.join(",")}`);

  step(9, "E-invoicing setup content (screens only)");
  line(`    ${EINVOICING_SETUP.steps.length} steps, ${EINVOICING_SETUP.fields.length} fields for M2/M3's setup page`);

  writeFileSync(
    join(OUT, "demo-summary.json"),
    JSON.stringify({ user, documents: listDocuments(LAYLA_ID), notifications: listNotifications(LAYLA_ID), outbox, consent: consentHistory(LAYLA_ID) }, null, 2),
  );
  line(`\nDone. PDFs in output/unsigned and output/signed, full data in output/demo-summary.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
