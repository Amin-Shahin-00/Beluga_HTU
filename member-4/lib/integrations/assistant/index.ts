// AI assistant [8]: answers questions about starting a business in Jordan, only from knowledge.json.
import { knowledge } from "../knowledge";
import { generate, type LlmMessage, type LlmSource } from "../llm";
import { detectLang, normalize, pick } from "../text";
import type { Lang, LegalForm, UserProfile } from "../types";
import { answerFromKnowledge, detectForms, type AnswerKind } from "./engine";

export interface ChatRequest {
  message: string;
  /** Earlier turns, oldest first. Optional. */
  history?: LlmMessage[];
  /** Force the answer language; by default it follows the message. */
  lang?: Lang;
  /** The wizard answers, if the user has finished the wizard. Used for context only. */
  profile?: UserProfile;
}

export interface ChatResponse {
  answer: string;
  lang: Lang;
  kind: AnswerKind;
  offices: { id: string; name: string; website: string; phone: string | null }[];
  sources: { id: string; title: string; url: string }[];
  /** Where the text came from: demo cache, real model, mock engine, or fallback after an API failure. */
  source: LlmSource;
  latencyMs: number;
  disclaimer: string;
}

// The data the model is allowed to use. Matching keywords are left out; they only matter to the mock engine.
const DATA = JSON.stringify({
  disclaimer: knowledge.disclaimer.en,
  offices: knowledge.offices,
  documents: knowledge.documents,
  legalForms: knowledge.legalForms,
  facts: knowledge.facts.map(({ id, kind, text, officeIds }) => ({ id, kind, text, officeIds })),
});

function systemPrompt(lang: Lang, profile?: UserProfile): string {
  const who = profile
    ? `\nThe user is ${profile.personal.fullNameEn}, planning a ${profile.business.legalForm.replace("_", " ")} in the ${profile.business.sector} sector in ${profile.personal.city}. Use this only to pick the relevant steps.`
    : "";
  return `You are Bedaya's assistant for people starting a business in Jordan.

Rules:
- Answer only from the DATA below. Never invent fees, documents, offices, times or laws.
- Reply in ${lang === "ar" ? "Arabic (simple Modern Standard Arabic the user can follow)" : "English"}.
- Keep it short: two to five sentences, or a short list.
- Quote fees and times exactly as the data gives them, and say so when the data marks them as estimates or unverified.
- If the data doesn't contain the answer, say you don't know and name the right office from the data with its website.
- If the question isn't about starting, registering or licensing a business in Jordan, say politely that you can only help with that.${who}

DATA:
${DATA}`;
}

/** If this message doesn't name a legal form, carry one over from the conversation or the profile. */
function contextForm(req: ChatRequest): LegalForm | undefined {
  const userTurns = (req.history ?? []).filter((m) => m.role === "user").reverse();
  for (const turn of userTurns) {
    const forms = detectForms(normalize(turn.content));
    if (forms.length) return forms[0];
  }
  return req.profile?.business.legalForm;
}

/** Answers from the data; a follow-up like "and how much is it?" is read together with the previous question. */
function engineAnswer(req: ChatRequest, lang: Lang) {
  const form = contextForm(req);
  const direct = answerFromKnowledge(req.message, lang, form);
  const previous = (req.history ?? []).filter((m) => m.role === "user").at(-1)?.content;
  if (direct.matchedId || !previous) return direct;
  const combined = answerFromKnowledge(`${previous} ${req.message}`, lang, form);
  return combined.matchedId ? combined : direct;
}

export async function askAssistant(req: ChatRequest): Promise<ChatResponse> {
  const lang = req.lang ?? detectLang(req.message);
  const engine = engineAnswer(req, lang);

  const result = await generate({
    task: "chat",
    cacheKey: `${lang}:${normalize(req.message)}`,
    system: systemPrompt(lang, req.profile),
    messages: [...(req.history ?? []).slice(-6), { role: "user", content: req.message }],
    maxTokens: 800,
    fallback: () => engine.text,
  });

  return {
    answer: result.text,
    lang,
    kind: engine.kind,
    offices: engine.officeIds.map((id) => {
      const o = knowledge.offices[id];
      return { id, name: pick(o.name, lang), website: o.website, phone: o.phone };
    }),
    sources: engine.sourceIds.map((id) => {
      const s = knowledge.sources[id];
      return { id, title: pick(s.title, lang), url: s.url };
    }),
    source: result.source,
    latencyMs: result.latencyMs,
    disclaimer: pick(knowledge.disclaimer, lang),
  };
}
