import assert from "node:assert/strict";
import { askAssistant } from "../lib/integrations/assistant";
process.env.LLM_PROVIDER = "mock";
const cases = [
 ["hello help me with my business", "what would you like"],
 ["i have 1 dollar", "total starting budget"],
 ["I want to open a bakery", "from home"],
 ["مرحبا", "أهلاً"],
 ["معي 1 دولار", "ميزانيتك"],
 ["thank you", "welcome"],
 ["Can I run a bakery from home?", "home-baked goods"],
 ["What documents do I need for a home business licence?", "documents"],
];
for (const [message, expected] of cases) {
 const result = await askAssistant({message});
 assert.equal(result.source, "mock");
 assert.ok(result.answer.toLowerCase().includes(expected.toLowerCase()), message);
 console.log("PASS", message);
}
const cost = await askAssistant({message:"and how much is it?",history:[{role:"user",content:"Can I run a bakery from home?"}]});
assert.ok(cost.answer.includes("Which cost"));
const yes = await askAssistant({message:"yes",history:[{role:"assistant",content:"Is that your total starting budget?"}]});
assert.ok(yes.answer.includes("What business"));
console.log("10/10 conversation cases passed.");
