// Cross-checks the Step 0 dummy data. Run: node scripts/check-step0.mjs
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const text = (p) => readFileSync(new URL(p, root), "utf8");
const json = (p) => JSON.parse(text(p));
const csv = (p) => {
  const [header, ...rows] = text(p).trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) => {
    const cells = row.split(",");
    if (cells.length !== keys.length) throw new Error(`${p}: expected ${keys.length} columns, got ${cells.length}: ${row}`);
    return Object.fromEntries(keys.map((k, i) => [k, cells[i]]));
  });
};

const errors = [];
const check = (ok, msg) => ok || errors.push(msg);

const rules = csv("data/m1/rules.csv");
const offices = csv("data/m1/offices.csv");
const documents = csv("data/m1/documents.csv");
const incubators = json("data/m1/incubators.json");
const questions = json("data/m1/test-questions.json");
const profile = json("lib/integrations/fixtures/user-profile.layla.json");
const ocr = json("lib/integrations/fixtures/ocr-results.layla.json");

const officeIds = new Set(offices.map((o) => o.office_id));
const docIds = new Set(documents.map((d) => d.doc_id));
const ocrTypes = new Set(documents.map((d) => d.ocr_doc_type));

for (const r of rules) {
  check(officeIds.has(r.office_id), `rules ${r.legal_form}/${r.step_id}: unknown office ${r.office_id}`);
  for (const d of r.required_docs.split(";")) check(docIds.has(d), `rules ${r.legal_form}/${r.step_id}: unknown doc ${d}`);
  check(!Number.isNaN(Number(r.fee_jod)) && !Number.isNaN(Number(r.days)), `rules ${r.step_id}: fee/days not numeric`);
}
for (const d of documents) check(officeIds.has(d.issued_by) || ["landlord", "bank"].includes(d.issued_by), `documents ${d.doc_id}: unknown issuer ${d.issued_by}`);

check(questions.length === 20, `expected 20 test questions, got ${questions.length}`);
check(new Set(questions.map((q) => q.id)).size === questions.length, "duplicate test question ids");

for (const inc of incubators) {
  check(inc.applicationFields.length >= 3, `${inc.id}: fewer than 3 application fields`);
  check(new Set(inc.applicationFields.map((f) => f.key)).size === inc.applicationFields.length, `${inc.id}: duplicate field keys`);
}

const legalForms = new Set(rules.map((r) => r.legal_form));
check(legalForms.has(profile.business.legalForm), `profile legalForm ${profile.business.legalForm} has no rules`);
for (const o of ocr) {
  check(ocrTypes.has(o.docType), `ocr ${o.fileName}: unknown docType ${o.docType}`);
  check(o.confidence >= 0 && o.confidence <= 1 && o.imageQuality >= 0 && o.imageQuality <= 1, `ocr ${o.fileName}: scores must be 0..1`);
}

// Totals the assistant test questions rely on (q11, q12).
const total = (form, field) =>
  rules.filter((r) => r.legal_form === form && r.condition === "always").reduce((s, r) => s + Number(r[field]), 0);
check(total("home_business", "fee_jod") === 90, "q11 expects home_business fees to total 90 JOD");
check(total("sole_proprietorship", "days") === 14, "q12 expects sole_proprietorship to take 14 days");

if (errors.length) {
  console.error(`Step 0 check FAILED (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `Step 0 check passed: ${rules.length} rule steps across ${legalForms.size} legal forms, ${offices.length} offices, ` +
    `${documents.length} document types, ${incubators.length} incubators, ${questions.length} test questions, ${ocr.length} OCR fixtures.`,
);
