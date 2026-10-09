import { z } from "zod";
export const onboardingSchema = z.object({
  activity: z.enum(["bakery", "retail", "online", "services"]),
  city: z.string().trim().min(1).max(120),
  premises: z.enum(["home", "shop", "online"]),
  legalForm: z.enum(["sole", "llc"]),
  partners: z.number().int().min(0).max(20),
  capital: z.number().min(0).max(100000000),
  employees: z.number().int().min(0).max(10000),
  stage: z.enum(["idea", "new", "operating"]),
  needsFunding: z.boolean(),
  inspectionConsent: z.boolean(),
}).strict().superRefine((data, ctx) => {
  if (data.premises === "home" && !data.inspectionConsent) ctx.addIssue({ code: "custom", path: ["inspectionConsent"], message: "Confirm consent for the demo home inspection track." });
  if (data.legalForm === "sole" && data.partners > 0) ctx.addIssue({ code: "custom", path: ["partners"], message: "Choose LLC for the demo multi-partner case." });
});
export type Answers = z.infer<typeof onboardingSchema>;
export type Step = { id?: string; step_key?: string; key?: string; dependencies: string[]; status?: string; fee: number; days: number; title_ar: string; title_en: string; office: string; documents: string[]; premises?: string; legalForm?: string; activity?: string; is_demo?: boolean };
export function selectSteps(answers: Answers, steps: Step[]) {
  return steps.filter(step => (!step.premises || step.premises === answers.premises) && (!step.legalForm || step.legalForm === answers.legalForm) && (!step.activity || step.activity === answers.activity));
}
export function roadmap(steps: Step[]) {
  const done = new Set(steps.filter(step => step.status === "done").map(step => step.step_key || step.key));
  const data = steps.map(step => ({ ...step, locked: !step.dependencies.every(key => done.has(key)) }));
  return { steps: data, progress: steps.length ? Math.round(done.size / steps.length * 100) : 0, nextAction: data.find(step => step.status !== "done" && !step.locked) || null };
}
export function estimate(steps: Step[]) {
  const map = new Map(steps.map(step => [step.step_key || step.key, step]));
  const memo = new Map<string, number>();
  function duration(key: string, visiting = new Set<string>()): number {
    if (memo.has(key)) return memo.get(key)!;
    if (visiting.has(key)) throw new Error("Rules contain a dependency cycle");
    const step = map.get(key);
    if (!step) throw new Error(`Missing prerequisite ${key}`);
    const next = new Set(visiting).add(key);
    const days = Number(step.days) + Math.max(0, ...step.dependencies.map(dep => duration(dep, next)));
    memo.set(key, days); return days;
  }
  return { currency: "JOD", totalFees: steps.reduce((sum, step) => sum + Number(step.fee), 0), estimatedDays: Math.max(0, ...steps.map(step => duration((step.step_key || step.key)!))), basis: "critical_path", isDemo: true, disclaimer: "Fictional demo values, not verified fees or guaranteed durations." };
}
export type Partner = { key: string; name_ar: string; name_en: string; kind: string; cities: string[]; activities: string[]; stages: string[]; requirements: string[]; fictional: boolean };
export function matchPartners(answers: Answers, partners: Partner[]) {
  return partners.filter(partner => partner.kind === "incubator" && partner.activities.includes(answers.activity) && partner.stages.includes(answers.stage))
    .map(partner => ({ ...partner, score: 60 + (partner.cities.length === 0 || partner.cities.includes(answers.city) ? 25 : 0) + (answers.needsFunding ? 15 : 0), reason: { ar: "تطابق تجريبي حسب النشاط والمرحلة والمدينة؛ لا يمثل قبولًا أو شريكًا حقيقيًا.", en: "Demo match by activity, stage and location; not real partner acceptance." } })).sort((a, b) => b.score - a.score);
}
export function complianceDates(start: string, items: { key: string; title_ar: string; title_en: string; months: number; office: string }[]) {
  const base = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) throw new Error("Invalid start date");
  return items.map(item => {
    const due = new Date(base);
    const originalDay = due.getUTCDate();
    due.setUTCDate(1); due.setUTCMonth(due.getUTCMonth() + item.months);
    const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
    due.setUTCDate(Math.min(originalDay, lastDay));
    return { ...item, dueDate: due.toISOString().slice(0, 10), isDemo: true };
  });
}
