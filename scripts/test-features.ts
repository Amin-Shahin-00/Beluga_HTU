// Runs features 9, 5 and 14 on Layla's demo data and checks the results. Run: npm run test:features
import { writeFileSync } from "node:fs";
import { generateBusinessPlan, type CostData } from "../lib/integrations/business-plan";
import { renderBusinessPlanPdf } from "../lib/integrations/business-plan-pdf";
import { checkDocuments } from "../lib/integrations/document-checker";
import costs from "../lib/integrations/fixtures/feature10-costs.layla.json";
import ocr from "../lib/integrations/fixtures/ocr-results.layla.json";
import layla from "../lib/integrations/fixtures/user-profile.layla.json";
import { explainMatches, prefillApplications } from "../lib/integrations/incubators";
import type { OcrResult, UserProfile } from "../lib/integrations/types";

const profile = layla as UserProfile;
const DEMO_DAY = "2026-10-09";
let failures = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${what}`);
  if (!ok) failures++;
};

console.log("\n[9] Document checker");
const check = await checkDocuments({ profile, files: ocr as OcrResult[], today: DEMO_DAY });
for (const f of check.files) {
  console.log(`  ${f.fileName}: ${f.status}`);
  for (const w of f.warnings) console.log(`     ${w.code}: ${w.message.en}\n     ${w.message.ar}`);
}
for (const m of check.missing) console.log(`  missing ${m.docId} (${m.severity}): ${m.message.en}`);
const status = Object.fromEntries(check.files.map((f) => [f.docType, f.status]));
expect(status.national_id === "ok", "valid national ID passes");
expect(check.files.find((f) => f.docType === "lease_contract")?.warnings.some((w) => w.code === "expired") === true, "lease ending 2026-08-31 is flagged expired");
expect(check.files.find((f) => f.docType === "registration_certificate")?.warnings.some((w) => w.code === "blurry") === true, "low-quality commercial register is flagged blurry");
const missingIds = check.missing.map((m) => m.docId);
const severity = (id: string) => check.missing.find((m) => m.docId === id)?.severity;
expect(severity("declaration_pledge") === "error" && severity("property_owner_approval") === "error", "missing GAM forms are flagged");
expect(severity("building_residents_consent") === "error", "residents' consent for JFDA is flagged (food business)");
expect(severity("jfda_approval") === "info" && severity("gam_rental_certificate") === "info", "papers issued by later steps are 'comes later', not errors");
expect(!missingIds.includes("service_booklet"), "service booklet not required for a woman");
expect(!missingIds.includes("memorandum_of_association"), "LLC papers not required for a home business");
expect(check.files.flatMap((f) => f.warnings).every((w) => w.message.en && w.message.ar), "every warning has English and Arabic text");

console.log("\n[5] Incubator matching");
const { matches } = await explainMatches(profile);
for (const m of matches) console.log(`  ${m.score} ${m.name.en}\n     ${m.reason.en}\n     ${m.reason.ar}`);
expect(matches[0]?.incubatorId === "jedco_hbb", "JEDCO's home-business grant ranks first for Layla");
expect(matches.some((m) => m.incubatorId === "def_hbb_loans"), "DEF home-project loans are matched");
expect(!matches.some((m) => ["oasis500", "ipark", "qrce_competition"].includes(m.incubatorId)), "tech-only programmes are not matched");
expect(!matches.some((m) => m.incubatorId === "orange_corners"), "Orange Corners is excluded (needs a business running a year)");
expect(matches.every((m) => m.reason.en && m.reason.ar), "every match has an English and Arabic reason");
const young = { ...profile, personal: { ...profile.personal, birthDate: "1970-01-01" } };
expect(!(await explainMatches(young)).matches.some((m) => m.incubatorId === "def_hbb_loans"), "DEF is excluded for a 56-year-old (ages 18-45)");

const apps = prefillApplications(profile, matches.map((m) => m.incubatorId));
for (const a of apps) {
  console.log(`  ${a.name.en}: ${a.readyToSubmit ? "ready" : `fill by hand: ${a.missingRequired.join(", ")}`}`);
  for (const f of a.fields) console.log(`     ${f.key} = ${f.value || "(empty)"} [${f.origin}${f.from ? ` <- ${f.from}` : ""}]`);
}
const jedco = apps.find((a) => a.incubatorId === "jedco_hbb");
expect(jedco?.fields.find((f) => f.key === "applicant_full_name_ar")?.value === profile.personal.fullNameAr, "Arabic name goes into the Arabic name field");
expect(jedco?.fields.find((f) => f.key === "works_from_home")?.value === "yes", "home-based maps to yes");
expect(jedco?.missingRequired.join() === "grant_use", "JEDCO form only needs 'how will you use the grant' by hand");
const def = apps.find((a) => a.incubatorId === "def_hbb_loans");
expect(def?.fields.find((f) => f.key === "loan_amount_jod")?.value === "3000", "loan request is capped at DEF's 3,000 JOD maximum");
expect(def?.missingRequired.includes("vtc_certificate_number") === true, "VTC certificate number is left for the user");

console.log("\n[14] Business plan");
const plan = await generateBusinessPlan(profile, costs as CostData, DEMO_DAY);
console.log(`  ${plan.title.en}\n  ${plan.business.en}\n  ${plan.funding.summary.en}`);
for (const t of plan.timeline) console.log(`  ${t.start} -> ${t.end}${t.durationKnown ? "" : " (est.)"} ${t.title.en}`);
expect(plan.costs.setupTotalJod === 2109, `setup total is 2,109 JOD (got ${plan.costs.setupTotalJod})`);
expect(plan.timeline.length === 9 && plan.timeline[0].stepId === "reserve_trade_name", `timeline follows Layla's 9-step roadmap (got ${plan.timeline.length})`);
expect(plan.timeline.at(-1)?.end === "2026-10-24", `roadmap ends 15 days later, on 2026-10-24 (got ${plan.timeline.at(-1)?.end})`);
for (const lang of ["en", "ar"] as const) {
  const pdf = await renderBusinessPlanPdf(plan, lang);
  const file = `docs/sample-business-plan-${lang}.pdf`;
  writeFileSync(new URL(`../${file}`, import.meta.url), pdf);
  expect(pdf.length > 1000 && Buffer.from(pdf.slice(0, 5)).toString() === "%PDF-", `${lang} PDF renders (${Math.round(pdf.length / 1024)} KB, ${file})`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll feature checks passed");
if (failures) process.exit(1);
