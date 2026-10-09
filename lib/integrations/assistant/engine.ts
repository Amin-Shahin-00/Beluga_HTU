// Deterministic answerer over knowledge.json. It is the assistant in mock mode and the fallback when the
// real model is slow or down. It never says anything that isn't in the data.
import {
  conditionLabel,
  doc,
  feeText,
  knowledge,
  office,
  officeLine,
  type Step,
} from "../knowledge";
import { longestMatch, midSentence, normalize, pick, t, toKeywords, type Keyword } from "../text";
import type { Lang, LegalForm } from "../types";
import { DOC_WORDS, DOMAIN_WORDS, FORM_WORDS, INTENT_WORDS, OFFICE_WORDS, STEP_WORDS } from "./lexicon";

export type AnswerKind = "answer" | "unknown_redirect" | "out_of_scope";

export interface EngineAnswer {
  kind: AnswerKind;
  text: string;
  officeIds: string[];
  sourceIds: string[];
  /** Which knowledge entry answered, for debugging and the test report. */
  matchedId: string | null;
}

interface Rendered {
  text: string;
  officeIds: string[];
  sourceIds: string[];
}

interface Candidate {
  id: string;
  kind: "answer" | "unknown_redirect";
  groups: Keyword[][];
  forms?: LegalForm[];
  boost?: number;
  render: (lang: Lang) => Rendered;
}

const kw = toKeywords;
const intent = Object.fromEntries(Object.entries(INTENT_WORDS).map(([k, v]) => [k, kw(v)])) as Record<
  keyof typeof INTENT_WORDS,
  Keyword[]
>;
const either = (...lists: Keyword[][]) => lists.flat();
const formName = (form: LegalForm, lang: Lang) => pick(knowledge.legalForms[form].name, lang);
const officeName = (id: string, lang: Lang) => pick(office(id).name, lang);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

function feeRange(step: Step, lang: Lang): string {
  const { minJod, maxJod } = step.fee;
  // A formula-based fee (e.g. a % of the rent) has no fixed amount, so show the formula itself.
  if (minJod === null) return step.fee.verified === "yes" ? pick(step.fee.note, lang) : t(lang, "fee not published", "الرسوم غير منشورة");
  if (maxJod === null) return t(lang, `from ${minJod} JOD`, `من ${minJod} دينار`);
  return minJod === maxJod ? `${minJod} ${t(lang, "JOD", "دينار")}` : `${minJod}-${maxJod} ${t(lang, "JOD", "دينار")}`;
}

function docList(step: Step, lang: Lang): string {
  return step.requiredDocs
    .map(({ docId, condition }) => {
      const label = conditionLabel(condition, lang);
      return `- ${pick(doc(docId).name, lang)}${label ? ` (${label})` : ""}`;
    })
    .join("\n");
}

const stepRendered = (step: Step, text: string): Rendered => ({ text, officeIds: [step.officeId], sourceIds: step.sourceIds });

function buildCandidates(): Candidate[] {
  const out: Candidate[] = [];

  // Hand-written facts from the official guide.
  for (const fact of knowledge.facts) {
    out.push({
      id: `fact:${fact.id}`,
      kind: fact.kind,
      groups: fact.match.map(kw),
      boost: fact.boost,
      render: (lang) => ({ text: pick(fact.text, lang), officeIds: fact.officeIds, sourceIds: fact.sourceIds }),
    });
  }

  // One set of questions per step (fee, time, documents, office, overview).
  const steps = new Map<string, { step: Step; forms: LegalForm[] }>();
  for (const form of Object.values(knowledge.legalForms)) {
    for (const step of form.steps) {
      const entry = steps.get(step.id) ?? { step, forms: [] };
      entry.forms.push(form.id);
      steps.set(step.id, entry);
    }
  }
  for (const { step, forms } of steps.values()) {
    const words = kw(STEP_WORDS[step.id] ?? []);
    const title = (lang: Lang) => pick(step.title, lang);
    const base = { kind: "answer" as const, forms, boost: 1 };
    out.push({
      ...base,
      id: `step:${step.id}:fee`,
      groups: [words, intent.fee],
      render: (lang) =>
        stepRendered(
          step,
          `${title(lang)}: ${feeText(step, lang).replace(/\.$/, "")}. ${t(lang, "Paid at", "تُدفع لدى")} ${officeName(step.officeId, lang)}.`,
        ),
    });
    out.push({
      ...base,
      id: `step:${step.id}:time`,
      groups: [words, intent.time],
      render: (lang) => stepRendered(step, `${title(lang)}: ${pick(step.days.note, lang)}.`),
    });
    out.push({
      ...base,
      id: `step:${step.id}:docs`,
      groups: [words, intent.docs],
      render: (lang) =>
        stepRendered(step, `${t(lang, "Documents for", "الوثائق المطلوبة لـ")} ${title(lang)}:\n${docList(step, lang)}`),
    });
    out.push({
      ...base,
      id: `step:${step.id}:where`,
      groups: [words, either(intent.where, intent.obtain)],
      render: (lang) =>
        stepRendered(step, `${title(lang)}: ${officeLine(step.officeId, lang)}.\n${pick(step.notes, lang)}`),
    });
    out.push({
      ...base,
      id: `step:${step.id}:about`,
      groups: [words],
      boost: 0,
      render: (lang) =>
        stepRendered(
          step,
          [
            `${title(lang)} (${officeName(step.officeId, lang)}).`,
            `${t(lang, "Fee", "الرسوم")}: ${feeText(step, lang)}.`,
            `${t(lang, "Time", "المدة")}: ${pick(step.days.note, lang)}.`,
            pick(step.notes, lang),
          ].join("\n"),
        ),
    });
  }

  // Questions about a whole legal form.
  for (const form of Object.values(knowledge.legalForms)) {
    const words = kw(FORM_WORDS[form.id]);
    const base = { kind: "answer" as const, forms: [form.id], boost: -2 };
    const always = form.steps.filter((s) => s.condition === "always");
    const conditional = form.steps.filter((s) => s.condition !== "always");
    const sources = uniq(form.steps.flatMap((s) => s.sourceIds));
    const offices = uniq(form.steps.map((s) => s.officeId));
    const stepLine = (s: Step, lang: Lang) => {
      const label = conditionLabel(s.condition, lang);
      return `${s.order}. ${pick(s.title, lang)} - ${officeName(s.officeId, lang)} (${feeRange(s, lang)})${label ? ` [${label}]` : ""}`;
    };

    out.push({
      ...base,
      id: `form:${form.id}:steps`,
      groups: [words, intent.steps],
      render: (lang) => ({
        text: `${t(lang, "Steps for a", "خطوات تأسيس")} ${formName(form.id, lang)}:\n${form.steps.map((s) => stepLine(s, lang)).join("\n")}`,
        officeIds: offices,
        sourceIds: sources,
      }),
    });
    out.push({
      ...base,
      id: `form:${form.id}:first`,
      groups: [words, intent.first],
      render: (lang) => {
        const first = always[0];
        const optional = form.steps.filter((s) => s.order < first.order);
        const before = optional.length
          ? t(lang, `Optionally, ${midSentence(pick(optional[0].title, lang))} first. `, `يمكنك أولاً (اختيارياً) ${pick(optional[0].title, lang)}. `)
          : "";
        return {
          text: `${before}${t(lang, "The first required step for a", "أول خطوة إلزامية لـ")} ${formName(form.id, lang)}: ${pick(first.title, lang)} - ${officeLine(first.officeId, lang)}.\n${pick(first.notes, lang)}`,
          officeIds: [first.officeId],
          sourceIds: first.sourceIds,
        };
      },
    });
    out.push({
      ...base,
      id: `form:${form.id}:fee_total`,
      groups: [words, intent.fee, intent.total],
      boost: 0,
      render: (lang) => {
        const known = always.filter((s) => s.fee.minJod !== null);
        const min = known.reduce((n, s) => n + (s.fee.minJod ?? 0), 0);
        const max = known.reduce((n, s) => n + (s.fee.maxJod ?? s.fee.minJod ?? 0), 0);
        const unknown = always.filter((s) => s.fee.minJod === null).map((s) => pick(s.title, lang));
        const extra = conditional.map((s) => `${pick(s.title, lang)} (${feeRange(s, lang)}, ${conditionLabel(s.condition, lang)})`);
        return {
          text: [
            t(lang, `Known required fees for a ${formName(form.id, lang)} add up to ${min}-${max} JOD.`, `مجموع الرسوم المعروفة لـ${formName(form.id, lang)} من ${min} إلى ${max} ديناراً.`),
            unknown.length ? t(lang, `Not included (fee not published): ${unknown.join(", ")}.`, `غير مشمول (رسوم غير منشورة): ${unknown.join("، ")}.`) : "",
            extra.length ? t(lang, `Depending on your case: ${extra.join("; ")}.`, `حسب حالتك: ${extra.join("؛ ")}.`) : "",
          ]
            .filter(Boolean)
            .join("\n"),
          officeIds: offices,
          sourceIds: sources,
        };
      },
    });
    out.push({
      ...base,
      id: `form:${form.id}:time_total`,
      groups: [words, intent.time, intent.total],
      boost: 0,
      render: (lang) => ({
        text: `${t(lang, "Time per step for a", "المدة لكل خطوة لـ")} ${formName(form.id, lang)}:\n${form.steps.map((s) => `${s.order}. ${pick(s.title, lang)}: ${pick(s.days.note, lang)}`).join("\n")}`,
        officeIds: offices,
        sourceIds: sources,
      }),
    });
    out.push({
      ...base,
      id: `form:${form.id}:docs`,
      groups: [words, intent.docs],
      render: (lang) => {
        const docs = new Map<string, string>();
        for (const s of form.steps) for (const d of s.requiredDocs) if (!docs.has(d.docId)) docs.set(d.docId, conditionLabel(d.condition, lang));
        const lines = [...docs].map(([id, label]) => `- ${pick(doc(id).name, lang)}${label ? ` (${label})` : ""}`);
        return {
          text: `${t(lang, "Documents across all steps for a", "الوثائق المطلوبة في كل خطوات")} ${formName(form.id, lang)}:\n${lines.join("\n")}`,
          officeIds: offices,
          sourceIds: sources,
        };
      },
    });
    for (const docId of Object.keys(knowledge.documents)) {
      out.push({
        ...base,
        boost: 2,
        id: `form:${form.id}:needs:${docId}`,
        groups: [words, kw(DOC_WORDS[docId] ?? [])],
        render: (lang) => {
          const steps = form.steps.filter((s) => s.requiredDocs.some((d) => d.docId === docId));
          const name = pick(doc(docId).name, lang);
          const text = steps.length
            ? t(lang, `Yes. For a ${formName(form.id, lang)}, the ${midSentence(name)} is needed for: `, `نعم. في ${formName(form.id, lang)} تحتاج ${name} في: `) +
              steps.map((s) => pick(s.title, lang)).join(t(lang, "; ", "؛ ")) +
              "."
            : t(
                lang,
                `Not usually. The ${midSentence(name)} isn't in the standard steps for a ${formName(form.id, lang)}, but some activities have extra requirements, so confirm with the licensing office.`,
                `غالباً لا. ${name} ليست ضمن الخطوات المعتادة لـ${formName(form.id, lang)}، لكن بعض الأنشطة لها متطلبات إضافية، فتأكد من جهة الترخيص.`,
              );
          return { text, officeIds: uniq(steps.map((s) => s.officeId)), sourceIds: uniq(steps.flatMap((s) => s.sourceIds)) };
        },
      });
    }
  }

  // Office hours and contact details.
  for (const o of Object.values(knowledge.offices)) {
    const words = kw(OFFICE_WORDS[o.id] ?? []);
    const contact = (lang: Lang): Rendered => ({ text: officeLine(o.id, lang), officeIds: [o.id], sourceIds: o.sourceIds });
    out.push({
      id: `office:${o.id}:hours`,
      kind: "answer",
      groups: [words, intent.hours],
      render: (lang) =>
        o.hours
          ? { text: `${pick(o.name, lang)}: ${pick(o.hours, lang)}.`, officeIds: [o.id], sourceIds: o.sourceIds }
          : {
              text: t(lang, `I don't have verified working hours for ${o.name.en}. Check ${o.website}.`, `لا تتوفر لدي ساعات دوام موثقة لـ${o.name.ar}. راجع ${o.website}.`),
              officeIds: [o.id],
              sourceIds: [],
            },
    });
    out.push({ id: `office:${o.id}:contact`, kind: "answer", groups: [words, either(intent.contact, intent.where)], render: contact });
  }

  // "Do I need X?" without a business type: list every step, by business type, that asks for it.
  for (const d of Object.values(knowledge.documents)) {
    out.push({
      id: `doc:${d.id}:needed`,
      kind: "answer",
      groups: [kw(DOC_WORDS[d.id] ?? []), intent.needed],
      render: (lang) => {
        const uses = Object.values(knowledge.legalForms).flatMap((f) =>
          f.steps
            .filter((s) => s.requiredDocs.some((r) => r.docId === d.id))
            .map((s) => ({ form: f.id, step: s, condition: s.requiredDocs.find((r) => r.docId === d.id)?.condition ?? "always" })),
        );
        const name = pick(d.name, lang);
        if (!uses.length) {
          return { text: t(lang, `The ${midSentence(name)} isn't required in Bedaya's steps.`, `${name} غير مطلوبة في خطوات بداية.`), officeIds: [], sourceIds: [] };
        }
        const lines = uses.map(({ form, step, condition }) => {
          const label = conditionLabel(condition, lang);
          return `- ${formName(form, lang)}: ${pick(step.title, lang)}${label ? ` (${label})` : ""}`;
        });
        return {
          text: `${t(lang, `The ${midSentence(name)} is needed for:`, `${name} مطلوبة في:`)}\n${uniq(lines).join("\n")}${d.notes ? `\n${pick(d.notes, lang)}` : ""}`,
          officeIds: uniq(uses.map((u) => u.step.officeId)),
          sourceIds: uniq(uses.flatMap((u) => u.step.sourceIds)),
        };
      },
    });
  }

  // Where to get each document.
  for (const d of Object.values(knowledge.documents)) {
    out.push({
      id: `doc:${d.id}:where`,
      kind: "answer",
      groups: [kw(DOC_WORDS[d.id] ?? []), either(intent.where, intent.obtain)],
      render: (lang) => {
        const name = pick(d.name, lang);
        const notes = d.notes ? ` ${pick(d.notes, lang)}` : "";
        if (d.issuedByStep.length) {
          const step = Object.values(knowledge.legalForms)
            .flatMap((f) => f.steps)
            .find((s) => s.id === d.issuedByStep[0]) as Step;
          return stepRendered(step, `${t(lang, "You get the", "تحصل على")} ${name} ${t(lang, "at the step", "في خطوة")} "${pick(step.title, lang)}": ${officeLine(step.officeId, lang)}.${notes}`);
        }
        if (knowledge.offices[d.issuedBy]) {
          return { text: `${name}: ${officeLine(d.issuedBy, lang)}.${notes}`, officeIds: [d.issuedBy], sourceIds: [] };
        }
        const who: Record<string, [string, string]> = {
          landlord: ["your landlord, or the title deed if you own the home", "المؤجر، أو سند الملكية إذا كان المنزل ملكك"],
          bank: ["your bank, after depositing the capital", "البنك بعد إيداع رأس المال"],
          applicant: ["you; you sign it yourself", "أنت؛ توقعه بنفسك"],
          partners: ["the partners, usually drafted with a lawyer", "الشركاء، وعادة يُعد بمساعدة محامٍ"],
        };
        const [en, ar] = who[d.issuedBy] ?? [d.issuedBy, d.issuedBy];
        return { text: `${name}: ${t(lang, en, ar)}.${notes}`, officeIds: [], sourceIds: [] };
      },
    });
  }

  return out;
}

const candidates = buildCandidates();
const formWords = Object.fromEntries(Object.entries(FORM_WORDS).map(([f, w]) => [f, kw(w)])) as Record<LegalForm, Keyword[]>;
const stepWords = Object.fromEntries(Object.entries(STEP_WORDS).map(([s, w]) => [s, kw(w)]));
const domainWords = kw([
  ...DOMAIN_WORDS,
  ...Object.values(FORM_WORDS).flat(),
  ...Object.values(STEP_WORDS).flat(),
  ...Object.values(OFFICE_WORDS).flat(),
  ...Object.values(DOC_WORDS).flat(),
]);

export function detectForms(normalized: string): LegalForm[] {
  return (Object.keys(formWords) as LegalForm[]).filter((f) => longestMatch(normalized, formWords[f]) > 0);
}

function score(c: Candidate, text: string, forms: LegalForm[], contextForm?: LegalForm): number {
  let total = c.boost ?? 0;
  for (const group of c.groups) {
    const best = longestMatch(text, group);
    if (!best) return 0;
    total += best + 10;
  }
  if (c.forms) {
    if (forms.length) total += c.forms.some((f) => forms.includes(f)) ? 8 : -15;
    else if (contextForm && c.forms.includes(contextForm)) total += 4;
  }
  return total;
}

export function answerFromKnowledge(question: string, lang: Lang, contextForm?: LegalForm): EngineAnswer {
  const text = normalize(question);
  const forms = detectForms(text);
  const ranked = candidates
    .map((c) => ({ c, s: score(c, text, forms, contextForm) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);

  if (ranked.length) {
    const best = ranked[0].c;
    return { kind: best.kind, ...best.render(lang), matchedId: best.id };
  }

  if (longestMatch(text, domainWords) === 0) {
    return {
      kind: "out_of_scope",
      text: t(
        lang,
        'I can only help with registering and licensing a business in Jordan: steps, offices, documents, fees and timing. For example, ask "What documents do I need for a home business licence?"',
        'أستطيع المساعدة فقط في تسجيل وترخيص المشاريع في الأردن: الخطوات والجهات والوثائق والرسوم والمدة. مثلاً اسأل: "شو الوثائق المطلوبة لرخصة المهن المنزلية؟"',
      ),
      officeIds: [],
      sourceIds: [],
      matchedId: null,
    };
  }

  // About business, but not in our data: say so and point at the most relevant office.
  const step = Object.keys(stepWords).find((s) => longestMatch(text, stepWords[s]) > 0);
  const officeId =
    (step && Object.values(knowledge.legalForms).flatMap((f) => f.steps).find((s) => s.id === step)?.officeId) || "MIT";
  return {
    kind: "unknown_redirect",
    text: t(
      lang,
      `I don't have verified information about that in Bedaya's data. The right office to ask is: ${officeLine(officeId, lang)}.`,
      `لا تتوفر لدي معلومات موثقة عن ذلك في بيانات بداية. الجهة المناسبة للسؤال: ${officeLine(officeId, lang)}.`,
    ),
    officeIds: [officeId],
    sourceIds: [],
    matchedId: null,
  };
}
