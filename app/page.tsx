"use client";

// M5 test bench: every AI feature against Layla's demo data. M3 builds the real screens; this page
// exists so the team and judges can try the APIs end to end.
import { useState } from "react";
import type { ChatResponse } from "@/lib/integrations/assistant";
import type { BusinessPlan } from "@/lib/integrations/business-plan";
import type { CheckResult, DocWarning } from "@/lib/integrations/document-checker";
import costs from "@/lib/integrations/fixtures/feature10-costs.layla.json";
import ocr from "@/lib/integrations/fixtures/ocr-results.layla.json";
import layla from "@/lib/integrations/fixtures/user-profile.layla.json";
import type { IncubatorMatch, PrefilledApplication } from "@/lib/integrations/incubators";
import type { Bilingual, Lang } from "@/lib/integrations/types";

const DEMO_DAY = "2026-10-09";
const SAMPLE_QUESTIONS = [
  "What documents do I need to get a home business license?",
  "Can I run a bakery from home?",
  "كم رسوم رخصة المهن للمشروع المنزلي؟",
  "هل لازم أسجل بالضمان إذا ما عندي موظفين؟",
  "What is the minimum capital for an LLC?",
  "What is the income tax rate for small businesses?",
];

type Tab = "chat" | "docs" | "incubators" | "plan";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("chat");
  const [lang, setLang] = useState<Lang>("en");
  const tx = (b: Bilingual) => b[lang];

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"}>
      <header>
        <div>
          <h1>{lang === "ar" ? "بداية · ميزات الذكاء الاصطناعي" : "Bedaya · AI features (M5)"}</h1>
          <div className="muted">
            {lang === "ar" ? "بيانات تجريبية لليلى، حلويات ليلى" : "Demo data: Layla, Layla's Sweets (home-based, Amman)"}
          </div>
        </div>
        <button className="ghost" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
          {lang === "en" ? "العربية" : "English"}
        </button>
      </header>

      <nav className="tabs" role="tablist">
        {(
          [
            ["chat", "AI assistant [8]", "المساعد [8]"],
            ["docs", "Document checker [9]", "فحص الوثائق [9]"],
            ["incubators", "Incubators [5]", "الحاضنات [5]"],
            ["plan", "Business plan [14]", "خطة العمل [14]"],
          ] as const
        ).map(([id, en, ar]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {lang === "ar" ? ar : en}
          </button>
        ))}
      </nav>

      {tab === "chat" && <Chat lang={lang} />}
      {tab === "docs" && <Docs lang={lang} tx={tx} />}
      {tab === "incubators" && <Incubators lang={lang} tx={tx} />}
      {tab === "plan" && <Plan lang={lang} tx={tx} />}
    </main>
  );
}

function Chat({ lang }: { lang: Lang }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<{ q: string; a?: ChatResponse; error?: string }[]>([]);

  async function ask(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setInput("");
    const history = turns.flatMap((t) => (t.a ? [{ role: "user", content: t.q }, { role: "assistant", content: t.a.answer }] : []));
    setTurns((ts) => [...ts, { q: message }]);
    try {
      const a = await post<ChatResponse>("/api/ai/chat", { message, history });
      setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, a } : t)));
    } catch (e) {
      setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, error: String(e) } : t)));
    }
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="messages">
        {turns.length === 0 && (
          <div className="muted">
            {lang === "ar" ? "اسأل عن تسجيل وترخيص مشروعك في الأردن." : "Ask about registering and licensing a business in Jordan."}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className="bubble user" dir="auto">
              {t.q}
            </div>
            {t.a && (
              <div className="bubble bot" dir={t.a.lang === "ar" ? "rtl" : "ltr"}>
                {t.a.answer}
                <div className="meta">
                  <span className={`badge ${t.a.kind === "answer" ? "ok" : t.a.kind === "unknown_redirect" ? "info" : "warning"}`}>{t.a.kind}</span>{" "}
                  {t.a.source} · {t.a.latencyMs} ms
                  {t.a.sources.map((s) => (
                    <span key={s.id}>
                      {" · "}
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {t.error && <div className="bubble bot">{t.error}</div>}
          </div>
        ))}
      </div>
      <div className="chips">
        {SAMPLE_QUESTIONS.map((q) => (
          <button key={q} onClick={() => ask(q)} disabled={busy} dir="auto">
            {q}
          </button>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "ar" ? "اكتب سؤالك…" : "Type a question…"} dir="auto" />
        <button className="primary" disabled={busy}>
          {lang === "ar" ? "إرسال" : "Send"}
        </button>
      </form>
    </section>
  );
}

function WarningLine({ w, tx }: { w: DocWarning; tx: (b: Bilingual) => string }) {
  return (
    <p>
      <span className={`badge ${w.severity}`}>{w.code}</span> {tx(w.message)}
    </p>
  );
}

function Docs({ lang, tx }: { lang: Lang; tx: (b: Bilingual) => string }) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult(await post<CheckResult>("/api/ai/documents/check", { profile: layla, files: ocr, today: DEMO_DAY }));
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="muted">
          {lang === "ar"
            ? `3 ملفات من مسار OCR الخاص بالشريك، بتاريخ ${DEMO_DAY}`
            : `3 files from the partner's OCR route, checked as of ${DEMO_DAY}`}
        </div>
        <button className="primary" onClick={run} disabled={busy}>
          {lang === "ar" ? "افحص الوثائق" : "Check documents"}
        </button>
      </div>
      {result && (
        <div className="list" style={{ marginTop: 12 }}>
          {result.files.map((f) => (
            <div key={f.fileId} className="item">
              <strong>{tx(f.docName)}</strong> <span className="muted">{f.fileName}</span>{" "}
              <span className={`badge ${f.status}`}>{f.status}</span>
              {f.warnings.map((w) => (
                <WarningLine key={w.id} w={w} tx={tx} />
              ))}
            </div>
          ))}
          <h2 style={{ marginTop: 8 }}>{lang === "ar" ? "وثائق ناقصة" : "Not uploaded yet"}</h2>
          {result.missing.map((m) => (
            <div key={m.id} className="item">
              <strong>{tx(m.docName)}</strong>
              <WarningLine w={m} tx={tx} />
            </div>
          ))}
          <div className="muted">source: {result.source}</div>
        </div>
      )}
    </section>
  );
}

function Incubators({ lang, tx }: { lang: Lang; tx: (b: Bilingual) => string }) {
  const [matches, setMatches] = useState<IncubatorMatch[] | null>(null);
  const [apps, setApps] = useState<PrefilledApplication[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function match() {
    setBusy(true);
    setApps(null);
    const res = await post<{ matches: IncubatorMatch[] }>("/api/ai/incubators/match", { profile: layla });
    setMatches(res.matches);
    setBusy(false);
  }

  async function applyAll() {
    if (!matches) return;
    setBusy(true);
    const res = await post<{ applications: PrefilledApplication[] }>("/api/ai/incubators/prefill", {
      profile: layla,
      incubatorIds: matches.map((m) => m.incubatorId),
    });
    setApps(res.applications);
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="muted">{lang === "ar" ? "الترتيب من M4 (هنا ترتيب بديل مؤقت)" : "Ranking comes from M4 (a stand-in ranker here)"}</div>
        <div className="row">
          <button className="primary" onClick={match} disabled={busy}>
            {lang === "ar" ? "اعرض الحاضنات" : "Find matches"}
          </button>
          {matches && (
            <button className="ghost" onClick={applyAll} disabled={busy}>
              {lang === "ar" ? "قدّم للكل بنقرة" : "Apply to all in one click"}
            </button>
          )}
        </div>
      </div>
      {matches && (
        <div className="list" style={{ marginTop: 12 }}>
          {matches.map((m) => (
            <div key={m.incubatorId} className="item">
              <strong>{tx(m.name)}</strong> <span className="muted">score {m.score}</span>
              <p>{tx(m.reason)}</p>
            </div>
          ))}
        </div>
      )}
      {apps && (
        <div className="grid2" style={{ marginTop: 12 }}>
          {apps.map((a) => (
            <div key={a.incubatorId} className="item scroll">
              <strong>{tx(a.name)}</strong>{" "}
              <span className={`badge ${a.readyToSubmit ? "ok" : "warning"}`}>{a.readyToSubmit ? "ready" : `${a.missingRequired.length} missing`}</span>
              <table>
                <tbody>
                  {a.fields.map((f) => (
                    <tr key={f.key}>
                      <td>{tx(f.label)}</td>
                      <td dir="auto">
                        {f.value || "—"} {f.origin === "derived" && <span className="badge info">derived</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Plan({ lang, tx }: { lang: Lang; tx: (b: Bilingual) => string }) {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setPlan(await post<BusinessPlan>("/api/ai/business-plan", { profile: layla, costs }));
    setBusy(false);
  }

  async function download() {
    const res = await fetch("/api/ai/business-plan/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "Laylas-Sweets-business-plan.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="muted">{lang === "ar" ? "إجابات المعالج + تكاليف الميزة 10" : "Wizard answers + feature 10's costs"}</div>
        <div className="row">
          <button className="primary" onClick={generate} disabled={busy}>
            {lang === "ar" ? "أنشئ الخطة" : "Generate plan"}
          </button>
          {plan && (
            <button className="ghost" onClick={download}>
              {lang === "ar" ? "تنزيل PDF (إنجليزي)" : "Download PDF"}
            </button>
          )}
        </div>
      </div>
      {plan && (
        <div style={{ marginTop: 12 }}>
          <h2>{tx(plan.title)}</h2>
          <h2>{lang === "ar" ? "المشروع" : "Business"}</h2>
          <p>{tx(plan.business)}</p>
          <h2>{lang === "ar" ? "السوق" : "Market"}</h2>
          <p>{tx(plan.market)}</p>
          <h2>{lang === "ar" ? "التكاليف" : "Costs"}</h2>
          <div className="scroll">
            <table>
              <tbody>
                {plan.costs.setup.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {tx(l.item)} {l.kind === "official" && <span className="badge ok">{lang === "ar" ? "رسمي" : "official"}</span>}
                    </td>
                    <td className="num">{l.amountJod} JOD</td>
                  </tr>
                ))}
                <tr>
                  <th>{lang === "ar" ? "مجموع التجهيز" : "Setup total"}</th>
                  <th className="num">{plan.costs.setupTotalJod} JOD</th>
                </tr>
                <tr>
                  <th>{lang === "ar" ? "التكاليف الشهرية" : "Monthly running costs"}</th>
                  <th className="num">{plan.costs.monthlyTotalJod} JOD</th>
                </tr>
              </tbody>
            </table>
          </div>
          <h2 style={{ marginTop: 12 }}>{lang === "ar" ? "التمويل" : "Funding"}</h2>
          <p>{tx(plan.funding.summary)}</p>
          <h2>{lang === "ar" ? "الجدول الزمني" : "Timeline"}</h2>
          <div className="scroll">
            <table>
              <tbody>
                {plan.timeline.map((t) => (
                  <tr key={t.stepId}>
                    <td className="num">
                      {t.start} → {t.end}
                    </td>
                    <td>
                      {tx(t.title)} {!t.durationKnown && <span className="badge warning">{lang === "ar" ? "تقدير" : "est."}</span>}
                      <div className="muted">{tx(t.office)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            source: {plan.source}
          </div>
        </div>
      )}
    </section>
  );
}
