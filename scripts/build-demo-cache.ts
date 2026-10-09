// Runs the exact demo script once and saves every AI answer to lib/integrations/demo-cache.json.
// During the demo, generate() serves these instantly, so it works if the API is slow or Wi-Fi drops.
// Run with the real key set (LLM_PROVIDER=anthropic) the night before: npm run demo:cache
import { writeFileSync } from "node:fs";
import { askAssistant } from "../lib/integrations/assistant";
import { generateBusinessPlan, type CostData } from "../lib/integrations/business-plan";
import { checkDocuments } from "../lib/integrations/document-checker";
import costs from "../lib/integrations/fixtures/feature10-costs.layla.json";
import questions from "../lib/integrations/fixtures/demo-questions.json";
import ocr from "../lib/integrations/fixtures/ocr-results.layla.json";
import layla from "../lib/integrations/fixtures/user-profile.layla.json";
import { explainMatches } from "../lib/integrations/incubators";
import { llmConfig, startRecording } from "../lib/integrations/llm";
import type { Lang, OcrResult, UserProfile } from "../lib/integrations/types";

process.env.DEMO_CACHE = "off"; // always ask fresh while building
const DEMO_DAY = "2026-10-09";
const profile = layla as UserProfile;
const recorded = startRecording();
const sources: string[] = [];

for (const q of questions as { lang: Lang; question: string }[]) {
  const res = await askAssistant({ message: q.question, lang: q.lang });
  sources.push(`chat "${q.question}": ${res.source}`);
}
sources.push(`doc check: ${(await checkDocuments({ profile, files: ocr as OcrResult[], today: DEMO_DAY })).source}`);
sources.push(`matches: ${(await explainMatches(profile)).source}`);
sources.push(`business plan: ${(await generateBusinessPlan(profile, costs as CostData, DEMO_DAY)).source}`);

writeFileSync(new URL("../lib/integrations/demo-cache.json", import.meta.url), `${JSON.stringify(recorded, null, 2)}\n`);
console.log(sources.join("\n"));
console.log(`\nSaved ${Object.keys(recorded).length} answers to lib/integrations/demo-cache.json`);
if (llmConfig().provider === "mock") {
  console.log(
    "Note: LLM_PROVIDER=mock, so these are the mock engine's answers (mock mode never reads the cache).\n" +
      "Re-run with LLM_PROVIDER=anthropic and LLM_API_KEY set to cache the model's answers for the demo.",
  );
}
