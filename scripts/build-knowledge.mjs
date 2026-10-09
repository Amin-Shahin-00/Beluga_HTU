// Turns M1's spreadsheet (data/m1/*.csv + facts.json) into lib/integrations/knowledge.json.
// Run after M1 changes any rule: node scripts/build-knowledge.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { readCsv } from "./csv.mjs";

const root = new URL("../", import.meta.url);
const at = (p) => new URL(p, root);
const json = (p) => JSON.parse(readFileSync(at(p), "utf8"));

const list = (s) => (s ? s.split(";").map((x) => x.trim()).filter(Boolean) : []);
const num = (s) => (s === "" ? null : Number(s));
const bi = (row, key) => ({ en: row[`${key}_en`], ar: row[`${key}_ar`] });

const sources = json("data/m1/sources.json");
const facts = json("data/m1/facts.json");

const offices = Object.fromEntries(
  readCsv(at("data/m1/offices.csv")).map((o) => [
    o.office_id,
    {
      id: o.office_id,
      name: bi(o, "name"),
      city: o.city,
      address: bi(o, "address"),
      hours: o.hours_en ? bi(o, "hours") : null,
      phone: o.phone || null,
      website: o.website,
      sourceIds: list(o.source_ids),
    },
  ]),
);

const documents = Object.fromEntries(
  readCsv(at("data/m1/documents.csv")).map((d) => [
    d.doc_id,
    {
      id: d.doc_id,
      name: bi(d, "name"),
      issuedBy: d.issued_by,
      issuedByStep: list(d.issued_by_step),
      hasExpiry: d.has_expiry === "yes",
      ocrDocType: d.ocr_doc_type,
      notes: d.notes_en ? bi(d, "notes") : null,
    },
  ]),
);

const formNames = {
  home_business: { en: "home-based business", ar: "مشروع منزلي" },
  sole_proprietorship: { en: "sole proprietorship", ar: "مؤسسة فردية" },
  llc: { en: "limited liability company (LLC)", ar: "شركة ذات مسؤولية محدودة" },
};

const legalForms = {};
for (const r of readCsv(at("data/m1/rules.csv"))) {
  legalForms[r.legal_form] ??= { id: r.legal_form, name: formNames[r.legal_form], steps: [] };
  legalForms[r.legal_form].steps.push({
    order: Number(r.step_order),
    id: r.step_id,
    title: bi(r, "title"),
    officeId: r.office_id,
    // "doc@condition" means the document is only needed when the condition holds.
    requiredDocs: list(r.required_docs).map((d) => {
      const [docId, condition] = d.split("@");
      return { docId, condition: condition ?? "always" };
    }),
    fee: { minJod: num(r.fee_min_jod), maxJod: num(r.fee_max_jod), note: bi(r, "fee_note"), verified: r.fee_verified },
    days: { value: num(r.days), note: bi(r, "days_note"), verified: r.days_verified },
    condition: r.condition,
    notes: bi(r, "notes"),
    sourceIds: list(r.source_ids),
  });
}
for (const form of Object.values(legalForms)) form.steps.sort((a, b) => a.order - b.order);

const knowledge = {
  version: new Date().toISOString().slice(0, 10),
  disclaimer: {
    en: "Built from official Jordanian sources accessed on 2026-10-09. Fees can change; confirm with the office before paying.",
    ar: "مبنية على مصادر أردنية رسمية تم الاطلاع عليها في 2026-10-09. قد تتغير الرسوم؛ تأكد من الجهة قبل الدفع.",
  },
  sources: Object.fromEntries(sources.map((s) => [s.id, s])),
  offices,
  documents,
  legalForms,
  facts,
};

writeFileSync(at("lib/integrations/knowledge.json"), `${JSON.stringify(knowledge, null, 2)}\n`);
const steps = Object.values(legalForms).reduce((n, f) => n + f.steps.length, 0);
console.log(
  `knowledge.json: ${Object.keys(legalForms).length} legal forms, ${steps} steps, ${Object.keys(offices).length} offices, ` +
    `${Object.keys(documents).length} documents, ${facts.length} facts, ${sources.length} sources`,
);
