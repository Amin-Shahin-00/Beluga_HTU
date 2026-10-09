// Ask the assistant from the terminal: npm run ask -- "question" ["another question" ...]
import { askAssistant } from "../lib/integrations/assistant";
import { answerFromKnowledge } from "../lib/integrations/assistant/engine";
import { detectLang } from "../lib/integrations/text";

for (const message of process.argv.slice(2)) {
  const res = await askAssistant({ message });
  const matched = answerFromKnowledge(message, detectLang(message)).matchedId ?? "-";
  console.log(`\n> ${message}\n[${res.kind} · ${matched} · ${res.source}]\n${res.answer}`);
}
