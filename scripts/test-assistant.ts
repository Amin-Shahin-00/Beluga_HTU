// Runs M1's 20 test questions through the assistant and writes a pass/fail list.
// Run: npm run test:assistant   (target: at least 18 of 20)
import { writeFileSync } from "node:fs";
import questions from "../data/m1/test-questions.json";
import { askAssistant } from "../lib/integrations/assistant";
import { answerFromKnowledge } from "../lib/integrations/assistant/engine";
import { normalize } from "../lib/integrations/text";
import type { TestQuestion } from "../lib/integrations/types";

const TARGET = 18;
const rows: string[] = [];
let passed = 0;

for (const q of questions as TestQuestion[]) {
  const res = await askAssistant({ message: q.question, lang: q.lang });
  const answer = normalize(res.answer);
  const missing = q.expect.mustMention.filter((group) => !group.some((word) => answer.includes(normalize(word))));
  const kindOk = res.kind === q.expect.kind;
  const ok = kindOk && missing.length === 0;
  if (ok) passed++;
  const why = [
    kindOk ? "" : `kind ${res.kind}, expected ${q.expect.kind}`,
    missing.length ? `missing ${missing.map((g) => g.join("/")).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const matched = answerFromKnowledge(q.question, q.lang).matchedId ?? "-";
  console.log(`${ok ? "PASS" : "FAIL"} ${q.id} [${matched}] ${q.question}${why ? `\n     ${why}\n     ${res.answer.replace(/\n/g, " | ")}` : ""}`);
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  rows.push(`| ${q.id} | ${ok ? "✅" : "❌"} | ${cell(q.question)} | ${res.kind} | ${cell(res.answer)} | ${cell(why)} |`);
}

const mode = process.env.LLM_PROVIDER ?? "mock";
writeFileSync(
  new URL("../docs/assistant-test-results.md", import.meta.url),
  `# Assistant test results

Mode: \`${mode}\` · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · **${passed}/${questions.length} passed** (target ${TARGET})

| # | | Question | Kind | Answer | Why it failed |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`,
);
console.log(`\n${passed}/${questions.length} passed (target ${TARGET}). Wrote docs/assistant-test-results.md`);
if (passed < TARGET) process.exit(1);
