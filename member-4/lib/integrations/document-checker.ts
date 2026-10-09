// Document checker [9]. Plain code decides what is wrong (missing, expired, blurry);
// the LLM only rewrites each warning in friendly words.
import { conditionHolds, doc, knowledge, office, roadmapFor, type Step } from "./knowledge";
import { generate, parseJson, type LlmSource } from "./llm";
import { midSentence, pick } from "./text";
import { BLUR_THRESHOLDS, type Bilingual, type OcrResult, type UserProfile } from "./types";

export type WarningCode = "missing" | "expired" | "blurry";

export interface DocWarning {
  id: string;
  code: WarningCode;
  /** error: blocks a step. warning: fix before submitting. info: nothing to do yet. */
  severity: "error" | "warning" | "info";
  docId: string;
  fileId: string | null;
  message: Bilingual;
  details: Record<string, string | number>;
}

export interface FileCheck {
  fileId: string;
  fileName: string;
  docType: string;
  docName: Bilingual;
  status: "ok" | "warning" | "error";
  warnings: DocWarning[];
}

export interface MissingDoc extends DocWarning {
  docName: Bilingual;
  neededFor: { stepId: string; title: Bilingual }[];
  /** Set when the document is produced by a later step of the roadmap, so there is nothing to upload yet. */
  obtainedAt: { stepId: string; title: Bilingual; office: Bilingual } | null;
}

export interface CheckResult {
  files: FileCheck[];
  missing: MissingDoc[];
  summary: { files: number; ok: number; expired: number; blurry: number; missing: number; comingLater: number };
  source: LlmSource;
}

export interface CheckRequest {
  profile: UserProfile;
  files: OcrResult[];
  /** yyyy-mm-dd; defaults to today. Lets the demo pin the date. */
  today?: string;
}

const docTypeToId = new Map(Object.values(knowledge.documents).map((d) => [d.ocrDocType, d.id]));
const join = (items: string[], lang: "en" | "ar") => items.join(lang === "ar" ? "، " : ", ");

function template(w: DocWarning, missing?: MissingDoc): Bilingual {
  const name = doc(w.docId)?.name ?? { en: w.docId, ar: w.docId };
  switch (w.code) {
    case "expired":
      return {
        en: `Your ${midSentence(name.en)} expired on ${w.details.expiryDate}. Please renew it and upload the new copy; the licence steps need a valid one.`,
        ar: `انتهت صلاحية ${name.ar} بتاريخ ${w.details.expiryDate}. يرجى تجديد الوثيقة ورفع النسخة الجديدة، فخطوات الترخيص تحتاج وثيقة سارية.`,
      };
    case "blurry":
      return {
        en: `We couldn't read your ${midSentence(name.en)} clearly. Please retake the photo flat, in good light and without glare, then upload it again.`,
        ar: `لم نتمكن من قراءة ${name.ar} بوضوح. يرجى إعادة التصوير والوثيقة مسطحة وفي إضاءة جيدة ودون انعكاس، ثم رفعها مجدداً.`,
      };
    case "missing": {
      const m = missing as MissingDoc;
      if (m.obtainedAt) {
        return {
          en: `You'll get the ${midSentence(name.en)} at the step "${m.obtainedAt.title.en}" (${m.obtainedAt.office.en}). Nothing to upload yet.`,
          ar: `ستحصل على ${name.ar} في خطوة "${m.obtainedAt.title.ar}" (${m.obtainedAt.office.ar}). لا حاجة لرفعها الآن.`,
        };
      }
      const notes = doc(w.docId)?.notes;
      return {
        en: `You still need your ${midSentence(name.en)} for: ${join(m.neededFor.map((s) => s.title.en), "en")}.${notes ? ` ${notes.en}` : ""}`,
        ar: `ما زلت تحتاج ${name.ar} من أجل: ${join(m.neededFor.map((s) => s.title.ar), "ar")}.${notes ? ` ${notes.ar}` : ""}`,
      };
    }
  }
}

export async function checkDocuments(req: CheckRequest): Promise<CheckResult> {
  const today = req.today ?? new Date().toISOString().slice(0, 10);
  const roadmap = roadmapFor(req.profile);
  const files: FileCheck[] = [];

  for (const f of req.files) {
    const docId = docTypeToId.get(f.docType) ?? f.docType;
    const warnings: DocWarning[] = [];
    const expiry = f.fields.expiryDate;
    if (expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry) && expiry < today) {
      warnings.push({ id: `${f.fileId}:expired`, code: "expired", severity: "error", docId, fileId: f.fileId, message: { en: "", ar: "" }, details: { expiryDate: expiry, today } });
    }
    if (f.confidence < BLUR_THRESHOLDS.minConfidence || f.imageQuality < BLUR_THRESHOLDS.minImageQuality) {
      warnings.push({
        id: `${f.fileId}:blurry`,
        code: "blurry",
        severity: "warning",
        docId,
        fileId: f.fileId,
        message: { en: "", ar: "" },
        details: { confidence: f.confidence, imageQuality: f.imageQuality },
      });
    }
    files.push({
      fileId: f.fileId,
      fileName: f.fileName,
      docType: f.docType,
      docName: doc(docId)?.name ?? { en: "Unknown document", ar: "وثيقة غير معروفة" },
      status: warnings.some((w) => w.severity === "error") ? "error" : warnings.length ? "warning" : "ok",
      warnings,
    });
  }

  // Missing: documents the roadmap needs that weren't uploaded.
  const uploaded = new Set(files.map((f) => docTypeToId.get(f.docType) ?? f.docType));
  const needed = new Map<string, Step[]>();
  for (const step of roadmap) {
    for (const d of step.requiredDocs) {
      if (!conditionHolds(d.condition, req.profile)) continue;
      needed.set(d.docId, [...(needed.get(d.docId) ?? []), step]);
    }
  }
  const roadmapIds = new Set(roadmap.map((s) => s.id));
  const missing: MissingDoc[] = [];
  for (const [docId, steps] of needed) {
    if (uploaded.has(docId)) continue;
    const producer = roadmap.find((s) => doc(docId).issuedByStep.includes(s.id) && roadmapIds.has(s.id));
    missing.push({
      id: `missing:${docId}`,
      code: "missing",
      severity: producer ? "info" : "error",
      docId,
      docName: doc(docId).name,
      fileId: null,
      message: { en: "", ar: "" },
      details: {},
      neededFor: steps.map((s) => ({ stepId: s.id, title: s.title })),
      obtainedAt: producer ? { stepId: producer.id, title: producer.title, office: office(producer.officeId).name } : null,
    });
  }

  // Friendly wording: one LLM call for all warnings, templates as the fallback.
  const all: DocWarning[] = [...files.flatMap((f) => f.warnings), ...missing];
  const templates = new Map(all.map((w) => [w.id, template(w, w.code === "missing" ? (w as MissingDoc) : undefined)]));
  let source: LlmSource = "mock";
  if (all.length) {
    const result = await generate({
      task: "doc_warnings",
      cacheKey: `${req.profile.userId}:${today}:${all.map((w) => w.id).join(",")}`,
      system:
        "You rewrite document warnings for Bedaya, an app that helps people in Jordan register a business. " +
        "Be warm, short (one or two sentences) and concrete about what to do next. Keep every fact, date and document name exactly as given; add nothing. " +
        'Return only JSON: [{"id": "...", "en": "...", "ar": "..."}] with one item per warning.',
      messages: [{ role: "user", content: JSON.stringify(all.map((w) => ({ id: w.id, code: w.code, severity: w.severity, draft: templates.get(w.id) }))) }],
      maxTokens: 2000,
      fallback: () => JSON.stringify(all.map((w) => ({ id: w.id, ...templates.get(w.id) }))),
    });
    source = result.source;
    const parsed = parseJson<{ id: string; en: string; ar: string }[]>(result.text) ?? [];
    const byId = new Map(parsed.map((p) => [p.id, p]));
    for (const w of all) {
      const p = byId.get(w.id);
      w.message = p?.en && p?.ar ? { en: p.en, ar: p.ar } : (templates.get(w.id) as Bilingual);
    }
  }

  const count = (code: WarningCode) => all.filter((w) => w.code === code).length;
  return {
    files,
    missing,
    summary: {
      files: files.length,
      ok: files.filter((f) => f.status === "ok").length,
      expired: count("expired"),
      blurry: count("blurry"),
      missing: missing.filter((m) => !m.obtainedAt).length,
      comingLater: missing.filter((m) => m.obtainedAt).length,
    },
    source,
  };
}

export const warningText = (w: DocWarning, lang: "en" | "ar") => pick(w.message, lang);
