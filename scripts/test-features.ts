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
expect(missingIds.includes("inspection_undertaking") && missingIds.includes("no_disturbance_undertaking"), "missing undertakings are flagged");
expect(check.missing.find((m) => m.docId === "jfda_approval")?.severity === "info", "JFDA approval is 'comes later', not an error");
expect(!missingIds.includes("service_booklet"), "service booklet not required for a woman");
expect(check.files.flatMap((f) => f.warnings).every((w) => w.message.en && w.message.ar), "every warning has English and Arabic text");

console.log("\n[5] Incubator matching");
const { matches } = await explainMatches(profile);
for (const m of matches) console.log(`  ${m.score} ${m.name.en}\n     ${m.reason.en}\n     ${m.reason.ar}`);
expect(matches[0]?.incubatorId === "inc_women_makers", "Women Makers Jordan ranks first for Layla");
expect(!matches.some((m) => m.incubatorId === "inc_petra_ventures"), "tech-only Petra Ventures is not matched");
expect(matches.every((m) => m.reason.en && m.reason.ar), "every match has an English and Arabic reason");

const apps = prefillApplications(profile, matches.map((m) => m.incubatorId));
for (const a of apps) {
  console.log(`  ${a.name.en}: ${a.readyToSubmit ? "ready" : `missing ${a.missingRequired.join(", ")}`}`);
  for (const f of a.fields) console.log(`     ${f.key} = ${f.value || "(empty)"} [${f.origin}${f.from ? ` <- ${f.from}` : ""}]`);
}
expect(apps.every((a) => a.readyToSubmit), "all matched applications are fully pre-filled");
const wm = apps.find((a) => a.incubatorId === "inc_women_makers");
expect(wm?.fields.find((f) => f.key === "applicant_full_name_ar")?.value === profile.personal.fullNameAr, "Arabic name goes into the Arabic name field");
expect(wm?.fields.find((f) => f.key === "works_from_home")?.value === "yes", "home-based maps to yes");

console.log("\n[14] Business plan");
const plan = await generateBusinessPlan(profile, costs as CostData, DEMO_DAY);
console.log(`  ${plan.title.en}\n  ${plan.business.en}\n  ${plan.funding.summary.en}`);
for (const t of plan.timeline) console.log(`  ${t.start} -> ${t.end}${t.durationKnown ? "" : " (est.)"} ${t.title.en}`);
expect(plan.costs.setupTotalJod === 1845, `setup total is 1,845 JOD (got ${plan.costs.setupTotalJod})`);
expect(plan.timeline.length === 6 && plan.timeline[0].stepId === "reserve_trade_name", "timeline follows Layla's 6-step roadmap");
const pdf = await renderBusinessPlanPdf(plan);
writeFileSync(new URL("../docs/sample-business-plan.pdf", import.meta.url), pdf);
expect(pdf.length > 1000 && Buffer.from(pdf.slice(0, 5)).toString() === "%PDF-", `PDF renders (${pdf.length} bytes, docs/sample-business-plan.pdf)`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll feature checks passed");
if (failures) process.exit(1);
