"use client";
// Client (business owner) dashboard: log in, upload documents, write or fix
// business info, sign everything, submit to government, follow each form,
// and see who used their data. Prototype for M3, built on the M5 APIs.

import { useCallback, useEffect, useState } from "react";
import { SOURCE_TAG, Shell, StatusTag, api, fmt, json, quality } from "../ui";

type Field = { value: string | number | boolean; source: string };
type User = Record<string, Field | string> & { nationalId: string };
type Profile = Record<string, Field | string>;
type Doc = {
  id: string;
  kind: string;
  docType: string;
  title: string;
  fileName: string;
  status: string;
  ocr?: { fields: Record<string, string>; confidence: number; imageQuality: number };
  missingFields?: string[];
  fileUrl: string;
  officeName?: { ar: string; en: string } | null;
  review?: { decision: string; note?: string; at: string };
  signature?: { signatureRef: string; signedAt: string } | null;
  createdAt: string;
};
type Note = { id: string; titleAr: string; bodyAr: string; bodyEn: string; read: boolean; createdAt: string };
type LogRow = { action: string; scopes: string[]; purpose: string; createdAt: string };
type Bi = { ar: string; en: string };
type Check = {
  files: { fileId: string; fileName: string; docName: Bi; status: string; warnings: { id: string; severity: string; message: Bi }[] }[];
  missing: { id: string; severity: string; docName: Bi; message: Bi }[];
  summary: { files: number; ok: number; expired: number; blurry: number; missing: number; comingLater: number };
};

const USER_LABELS: Record<string, string> = {
  fullNameAr: "الاسم الكامل",
  fullNameEn: "الاسم بالإنجليزية",
  birthDate: "تاريخ الميلاد",
  gender: "الجنس",
  phone: "الهاتف",
  email: "البريد الإلكتروني",
  city: "المدينة",
};

const EDITABLE: { key: string; ar: string; en: string; type?: "number" }[] = [
  { key: "businessNameAr", ar: "الاسم التجاري", en: "Trade name (Arabic)" },
  { key: "businessNameEn", ar: "الاسم التجاري بالإنجليزية", en: "Trade name (English)" },
  { key: "activityAr", ar: "النشاط", en: "Activity (Arabic)" },
  { key: "activityEn", ar: "النشاط بالإنجليزية", en: "Activity (English)" },
  { key: "address", ar: "العنوان", en: "Address" },
  { key: "capitalJod", ar: "رأس المال (دينار)", en: "Capital (JOD)", type: "number" },
  { key: "partners", ar: "عدد الشركاء", en: "Partners", type: "number" },
];

const DOC_TYPES = [
  { key: "national_id", ar: "الهوية الوطنية", en: "National ID" },
  { key: "lease_contract", ar: "عقد الإيجار", en: "Lease contract" },
  { key: "property_ownership_document", ar: "سند ملكية العقار", en: "Title deed" },
  { key: "property_owner_approval", ar: "موافقة مالك العقار", en: "Property owner approval" },
];

const SAMPLES = [
  { file: "layla-national-id.png", label: "هوية سليمة · Good ID" },
  { file: "layla-national-id-blurry.png", label: "هوية غير واضحة · Blurry" },
  { file: "layla-national-id-expired.png", label: "هوية منتهية · Expired" },
];

function purposeLabel(p: string): [string, string] {
  if (p.startsWith("gov_review:")) return ["جهة حكومية اطّلعت على نموذجك", `Government office reviewed your form (${p.slice(11)})`];
  return (
    {
      sanad_login: ["تسجيل الدخول عبر سند", "Login with SANAD"],
      profile_view: ["عرض ملفك في بداية", "Your profile was shown to you"],
      form_autofill: ["تعبئة النماذج تلقائيًا", "Auto-filling your forms"],
      e_signature: ["التوقيع الإلكتروني", "E-signature"],
    } as Record<string, [string, string]>
  )[p] ?? [p, p];
}

export default function ClientDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [log, setLog] = useState<LogRow[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [docType, setDocType] = useState("national_id");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/api/sanad/me");
      setUser(me.user);
      const [p, d, n, c] = await Promise.all([
        api<{ profile: Profile }>("/api/profile"),
        api<{ documents: Doc[] }>("/api/documents"),
        api<{ notifications: Note[]; unread: number }>("/api/notifications"),
        api<{ log: LogRow[] }>("/api/consent"),
      ]);
      setProfile(p.profile);
      setDocs(d.documents);
      setNotes(n.notifications);
      setUnread(n.unread);
      setLog(c.log);
      // Ameen's document checker on this user's files. Optional: the page works without it.
      setCheck(await api<Check>("/api/documents/check").catch(() => null));
    } catch {
      setUser(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fill the edit form whenever a fresh profile arrives.
  useEffect(() => {
    if (!profile) return;
    const next: Record<string, string> = {};
    for (const f of EDITABLE) next[f.key] = String((profile[f.key] as Field | undefined)?.value ?? "");
    setDraft(next);
  }, [profile]);

  async function run(label: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(label);
    setError("");
    setInfo("");
    try {
      await fn();
      await refresh();
      if (done) setInfo(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("docType", docType);
    await api("/api/documents/upload", { method: "POST", body: fd });
  }

  async function uploadSample(name: string) {
    const blob = await (await fetch(`/samples/${name}`)).blob();
    setDocType("national_id");
    const fd = new FormData();
    fd.append("file", new File([blob], name, { type: "image/png" }));
    fd.append("docType", "national_id");
    await api("/api/documents/upload", { method: "POST", body: fd });
  }

  if (!checked) return <Shell title="لوحة صاحب المشروع" sub="Client dashboard"><p className="muted">...</p></Shell>;

  if (!user) {
    return (
      <Shell title="لوحة صاحب المشروع" sub="Client dashboard">
        <div className="card" style={{ maxWidth: 560 }}>
          <h2>ابدأ مشروعك بخطوة واحدة</h2>
          <p className="en">Log in with SANAD. You choose what data Bedaya may use, and every access is logged.</p>
          <a className="btn primary" href="/api/sanad/login?return=/dashboard/client">
            الدخول عبر سند · Login with SANAD (mock)
          </a>
        </div>
      </Shell>
    );
  }

  const uploads = docs.filter((d) => d.kind === "upload");
  const forms = docs.filter((d) => d.kind === "generated");
  const count = (s: string) => forms.filter((d) => d.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const lastId = uploads.filter((d) => d.docType === "national_id").at(-1);
  const idProblem = lastId && (quality(lastId.ocr) === "poor" || (lastId.ocr?.fields.expiryDate ?? "9999") < today);

  const steps = [
    { ar: "الدخول عبر سند", en: "SANAD login", done: true, bad: false },
    { ar: "رفع الهوية", en: "Upload ID", done: !!lastId && !idProblem, bad: !!idProblem },
    { ar: "تعبئة النماذج", en: "Forms filled", done: forms.length > 0, bad: forms.some((d) => d.missingFields?.length) },
    { ar: "التوقيع", en: "Signed", done: forms.length > 0 && !count("ready_to_sign"), bad: false },
    { ar: "الإرسال للجهات", en: "Submitted", done: forms.length > 0 && forms.every((d) => ["submitted", "approved", "returned"].includes(d.status)), bad: count("returned") > 0 },
    { ar: "الموافقة", en: "Approved", done: forms.length > 0 && forms.every((d) => d.status === "approved"), bad: false },
  ];
  const nowIdx = steps.findIndex((s) => !s.done);

  const accessed = log.filter((r) => r.action === "data_accessed");
  const byPurpose = new Map<string, { n: number; last: string }>();
  for (const r of accessed) {
    const cur = byPurpose.get(r.purpose);
    byPurpose.set(r.purpose, { n: (cur?.n ?? 0) + 1, last: cur && cur.last > r.createdAt ? cur.last : r.createdAt });
  }

  const nameAr = (user.fullNameAr as Field).value as string;

  return (
    <Shell title={`أهلًا ${nameAr.split(" ")[0]}`} sub="Client dashboard: your documents, forms and signatures in one place">
      {error && <div className="note bad" style={{ marginBottom: 12 }}>{error}</div>}
      {info && <div className="note good" style={{ marginBottom: 12 }}>{info}</div>}

      {/* Progress */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>مسار مشروعك · Your progress</h2>
          <div className="row">
            <span className="muted">الرقم الوطني: {user.nationalId}</span>
            <button onClick={() => run("logout", () => api("/api/sanad/me", json({ action: "logout" })))}>خروج · Logout</button>
          </div>
        </div>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.en} className={s.bad ? "bad" : s.done ? "done" : i === nowIdx ? "now" : ""}>
              {s.done && !s.bad ? "✓ " : ""}
              {s.ar}
              <div className="en" style={{ color: "inherit" }}>{s.en}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid">
        {/* SANAD data (read-only) */}
        <div className="card">
          <h2>بياناتي من سند · From SANAD</h2>
          <p className="muted">لا يمكن تعديلها هنا: سند هو المصدر. · Read-only: SANAD is the source.</p>
          <table>
            <tbody>
              {Object.entries(user).map(([k, v]) =>
                typeof v === "object" && v ? (
                  <tr key={k}>
                    <td>{USER_LABELS[k] ?? k}</td>
                    <td><bdi>{String(v.value)}</bdi></td>
                    <td><span className={`tag ${SOURCE_TAG[v.source]?.[0]}`}>{SOURCE_TAG[v.source]?.[1]}</span></td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>

        {/* Business info (editable) */}
        <div className="card">
          <h2>معلومات المشروع · Business info</h2>
          <p className="muted">صحّح أو أكمل المعلومات، ثم أعد تعبئة النماذج. · Fix or complete, then generate forms again.</p>
          <div className="form-grid">
            {EDITABLE.map((f) => {
              const src = (profile?.[f.key] as Field | undefined)?.source;
              return (
                <label key={f.key}>
                  <span>
                    {f.ar} {src && <span className={`tag ${SOURCE_TAG[src]?.[0]}`}>{SOURCE_TAG[src]?.[1]}</span>}
                  </span>
                  <input
                    type={f.type ?? "text"}
                    min={f.type ? 0 : undefined}
                    value={draft[f.key] ?? ""}
                    dir={f.key.endsWith("En") ? "ltr" : undefined}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                </label>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() => run("profile", () => api("/api/profile", json(draft)), "تم الحفظ. اضغط \"تعبئة النماذج\" لتحديث النماذج غير الموقّعة. · Saved.")}
            >
              {busy === "profile" ? "..." : "حفظ · Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>مستنداتي · My documents</h2>
        <div className="row">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ width: "auto" }}>
            {DOC_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.ar} · {t.en}</option>
            ))}
          </select>
          <label className="btn primary">
            رفع ملف · Upload file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) run("upload", () => upload(f));
              }}
            />
          </label>
          <span className="muted">أو جرّب نموذجًا: · or try a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.file} disabled={!!busy} onClick={() => run("upload", () => uploadSample(s.file))}>{s.label}</button>
          ))}
        </div>
        {idProblem && (
          <div className="note bad">
            {quality(lastId?.ocr) === "poor" ? "صورة الهوية غير واضحة، يرجى رفع صورة أوضح. " : "الهوية منتهية، يرجى تجديدها ورفعها مرة أخرى. "}
            <span className="en" style={{ color: "inherit" }}>
              {quality(lastId?.ocr) === "poor" ? "Your ID photo is blurry: upload a clearer one." : "Your ID is expired: renew it and upload again."}
            </span>
          </div>
        )}
        {uploads.length ? (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>المستند</th><th>الجودة</th><th className="hide-sm">ينتهي</th><th className="hide-sm">التاريخ</th></tr>
            </thead>
            <tbody>
              {[...uploads].reverse().map((d) => {
                const exp = d.ocr?.fields.expiryDate;
                return (
                  <tr key={d.id}>
                    <td>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.title}</a>
                      <div className="en">{d.fileName}</div>
                    </td>
                    <td><span className={`tag ${quality(d.ocr) === "poor" ? "warn" : "sanad"}`}>{quality(d.ocr)}</span></td>
                    <td className="hide-sm">{exp ? <span className={`tag ${exp < today ? "warn" : "grey"}`}>{exp}</span> : "-"}</td>
                    <td className="hide-sm en">{fmt(d.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">لم ترفع أي مستند بعد. · No documents yet.</div>
        )}
      </div>

      {/* Document checker (Ameen's feature 9) on this user's files */}
      {check && (
        <div className="card">
          <h2>فحص المستندات · Document check</h2>
          <p className="muted">
            ما ينقصك، وما انتهى، وما هو غير واضح، حسب خطوات مشروعك. · What's missing, expired or blurry for your roadmap (AI document checker).
          </p>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="tag sanad">سليم {check.summary.ok}</span>
            <span className="tag warn">منتهي {check.summary.expired}</span>
            <span className="tag warn">غير واضح {check.summary.blurry}</span>
            <span className="tag ready">ناقص {check.summary.missing}</span>
            <span className="tag grey">لاحقًا {check.summary.comingLater}</span>
          </div>
          {check.files
            .filter((f) => f.warnings.length)
            .map((f) => (
              <div key={f.fileId} className={`note ${f.status === "error" ? "bad" : ""}`}>
                <strong>{f.docName.ar}</strong> <span className="en" style={{ color: "inherit" }}>{f.fileName}</span>
                {f.warnings.map((w) => (
                  <div key={w.id}>
                    {w.message.ar}
                    <div className="en" style={{ color: "inherit" }}>{w.message.en}</div>
                  </div>
                ))}
              </div>
            ))}
          {!!check.missing.length && (
            <table style={{ marginTop: 10 }}>
              <tbody>
                {check.missing.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`tag ${m.severity === "error" ? "ready" : "grey"}`}>{m.severity === "error" ? "مطلوب" : "لاحقًا"}</span>
                    </td>
                    <td>
                      <strong>{m.docName.ar}</strong> · {m.message.ar}
                      <div className="en">{m.message.en}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Forms: generate, sign, submit, follow */}
      <div className="card">
        <h2>نماذجي الحكومية · My government forms</h2>
        <div className="row">
          <button className="primary" disabled={!!busy} onClick={() => run("generate", () => api("/api/documents/generate", { method: "POST" }))}>
            {busy === "generate" ? "..." : "تعبئة النماذج · Generate forms"}
          </button>
          <button className="primary" disabled={!!busy || !count("ready_to_sign")} onClick={() => run("sign", () => api("/api/documents/sign-all", json({})))}>
            {busy === "sign" ? "..." : `وقّع الكل (${count("ready_to_sign")}) · Sign all`}
          </button>
          <button className="primary" disabled={!!busy || !count("signed")} onClick={() => run("submit", () => api("/api/documents/submit", { method: "POST" }))}>
            {busy === "submit" ? "..." : `أرسل للجهات (${count("signed")}) · Submit`}
          </button>
        </div>
        {forms.length ? (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>النموذج</th><th className="hide-sm">الجهة</th><th>الحالة</th></tr>
            </thead>
            <tbody>
              {forms.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.title.split(" | ")[1] ?? d.title}</a>
                    <div className="en">{d.title.split(" | ")[0]}</div>
                    {!!d.missingFields?.length && <div className="tag warn">ناقص: {d.missingFields.join(", ")}</div>}
                    {d.review?.decision === "returned" && (
                      <div className="note bad">
                        ملاحظة الجهة: {d.review.note}
                        <div className="en" style={{ color: "inherit" }}>Fix your info above, then Generate, Sign and Submit again.</div>
                      </div>
                    )}
                  </td>
                  <td className="hide-sm">
                    {d.officeName?.ar}
                    <div className="en">{d.officeName?.en}</div>
                  </td>
                  <td><StatusTag status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">اضغط "تعبئة النماذج" لتجهيز نماذجك تلقائيًا. · Press Generate to fill your forms.</div>
        )}
      </div>

      <div className="grid">
        {/* Notifications */}
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>الإشعارات ({unread}) · Notifications</h2>
            <button disabled={!unread || !!busy} onClick={() => run("read", () => api("/api/notifications", json({})))}>تعليم الكل كمقروء</button>
          </div>
          {notes.length ? (
            notes.slice(0, 12).map((n) => (
              <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", opacity: n.read ? 0.55 : 1 }}>
                <strong>{n.titleAr}</strong> · {n.bodyAr}
                <div className="en">{n.bodyEn} · {fmt(n.createdAt)}</div>
              </div>
            ))
          ) : (
            <div className="empty">لا إشعارات. · No notifications.</div>
          )}
        </div>

        {/* Privacy */}
        <div className="card">
          <h2>خصوصيتي · Who used my data</h2>
          <table>
            <thead><tr><th>السبب</th><th>المرات</th><th className="hide-sm">آخر مرة</th></tr></thead>
            <tbody>
              {[...byPurpose.entries()].map(([p, v]) => {
                const [ar, en] = purposeLabel(p);
                return (
                  <tr key={p}>
                    <td>{ar}<div className="en">{en}</div></td>
                    <td>{v.n}</td>
                    <td className="hide-sm en">{fmt(v.last)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">
            يمكنك سحب موافقتك في أي وقت. سيتم تسجيل خروجك، وسيُطلب منك الموافقة مجددًا عند الدخول.
            <span className="en">Withdraw consent any time. You'll be logged out and asked again at the next login.</span>
          </p>
          <button
            disabled={!!busy}
            onClick={() => confirm("سحب الموافقة وتسجيل الخروج؟ · Withdraw consent and log out?") && run("revoke", () => api("/api/consent", json({ action: "revoke" })))}
          >
            سحب الموافقة · Withdraw consent
          </button>
        </div>
      </div>
    </Shell>
  );
}
