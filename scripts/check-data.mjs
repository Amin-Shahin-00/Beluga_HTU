// Cross-checks M1's data and the M5 fixtures. Run: node scripts/check-data.mjs
import { readFileSync } from "node:fs";
import { readCsv } from "./csv.mjs";

const root = new URL("../", import.meta.url);
const at = (p) => new URL(p, root);
const json = (p) => JSON.parse(readFileSync(at(p), "utf8"));

const errors = [];
const check = (ok, msg) => ok || errors.push(msg);

const rules = readCsv(at("data/m1/rules.csv"));
const offices = readCsv(at("data/m1/offices.csv"));
const documents = readCsv(at("data/m1/documents.csv"));
const sources = json("data/m1/sources.json");
const facts = json("data/m1/facts.json");
const incubators = json("data/m1/incubators.json");
const questions = json("data/m1/test-questions.json");
const profile = json("lib/integrations/fixtures/user-profile.layla.json");
const ocr = json("lib/integrations/fixtures/ocr-results.layla.json");

const officeIds = new Set(offices.map((o) => o.office_id));
const docIds = new Set(documents.map((d) => d.doc_id));
const stepIds = new Set(rules.map((r) => r.step_id));
const sourceIds = new Set(sources.map((s) => s.id));
const ocrTypes = new Set(documents.map((d) => d.ocr_doc_type));
const conditions = new Set(["always", "optional", "if_food", "if_employees", "if_trade_name", "if_male_born_1989_plus"]);
const ids = (s) => (s ? s.split(";") : []);

for (const r of rules) {
  const where = `rules ${r.legal_form}/${r.step_id}`;
  check(officeIds.has(r.office_id), `${where}: unknown office ${r.office_id}`);
  check(conditions.has(r.condition), `${where}: unknown condition ${r.condition}`);
  for (const d of ids(r.required_docs)) {
    const [docId, cond = "always"] = d.split("@");
    check(docIds.has(docId), `${where}: unknown doc ${docId}`);
    check(conditions.has(cond), `${where}: unknown doc condition ${cond}`);
  }
  for (const s of ids(r.source_ids)) check(sourceIds.has(s), `${where}: unknown source ${s}`);
  for (const k of ["fee_min_jod", "fee_max_jod", "days"]) check(r[k] === "" || !Number.isNaN(Number(r[k])), `${where}: ${k} not numeric`);
  check(r.fee_note_en && r.fee_note_ar, `${where}: fee note missing in one language`);
}
for (const o of offices) for (const s of ids(o.source_ids)) check(sourceIds.has(s), `office ${o.office_id}: unknown source ${s}`);
for (const d of documents) {
  check(officeIds.has(d.issued_by) || ["landlord", "bank", "applicant", "partners"].includes(d.issued_by), `documents ${d.doc_id}: unknown issuer ${d.issued_by}`);
  for (const s of ids(d.issued_by_step)) check(stepIds.has(s), `documents ${d.doc_id}: unknown step ${s}`);
}
for (const f of facts) {
  check(f.text?.en && f.text?.ar, `fact ${f.id}: text missing in one language`);
  for (const o of f.officeIds) check(officeIds.has(o), `fact ${f.id}: unknown office ${o}`);
  for (const s of f.sourceIds) check(sourceIds.has(s), `fact ${f.id}: unknown source ${s}`);
}

check(questions.length === 20, `expected 20 test questions, got ${questions.length}`);
check(new Set(questions.map((q) => q.id)).size === questions.length, "duplicate test question ids");
for (const inc of incubators) {
  check(inc.applicationFields.length >= 3, `${inc.id}: fewer than 3 application fields`);
  check(new Set(inc.applicationFields.map((f) => f.key)).size === inc.applicationFields.length, `${inc.id}: duplicate field keys`);
}
check(new Set(rules.map((r) => r.legal_form)).has(profile.business.legalForm), `profile legalForm ${profile.business.legalForm} has no rules`);
for (const o of ocr) {
  check(ocrTypes.has(o.docType), `ocr ${o.fileName}: unknown docType ${o.docType}`);
  check(o.confidence >= 0 && o.confidence <= 1 && o.imageQuality >= 0 && o.imageQuality <= 1, `ocr ${o.fileName}: scores must be 0..1`);
}

if (errors.length) {
  console.error(`Data check FAILED (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `Data check passed: ${rules.length} rule rows, ${offices.length} offices, ${documents.length} documents, ${facts.length} facts, ` +
    `${sources.length} sources, ${incubators.length} incubators, ${questions.length} test questions, ${ocr.length} OCR fixtures.`,
);
