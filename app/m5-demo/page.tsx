"use client";
// M5 test console: clicks through every M5 API with dummy data.
// Not the product UI (M3 builds that from M2's designs); it proves the APIs work
// and doubles as a backup demo screen.

import { useCallback, useEffect, useState } from "react";
import { quality } from "../dashboard/ui";

type Field = { value: string; source: string };
type User = Record<string, Field | string> & { nationalId: string };
type Ocr = { fileId: string; docType: string; fields: Record<string, string>; confidence: number; imageQuality: number };
type Doc = {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  status: string;
  ocr?: Ocr;
  missingFields?: string[];
  fileUrl: string;
  signature?: { signatureRef: string; hash: string; signedAt: string } | null;
};
type Note = { id: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; read: boolean; createdAt: string };
type Einv = { titleAr: string; titleEn: string; steps: { titleAr: string; titleEn: string }[]; disclaimerEn: string };

const SOURCE_TAG: Record<string, [string, string]> = {
  verified_by_sanad: ["sanad", "موثّق من سند"],
  read_by_ocr: ["ocr", "من مسح الهوية"],
  typed_by_user: ["typed", "أدخله المستخدم"],
};

const FORM_STATUS: Record<string, string> = {
  ready_to_sign: "جاهز للتوقيع · Ready",
  signed: "موقّع · Signed",
  submitted: "قيد المراجعة · Under review",
  approved: "تمت الموافقة · Approved",
  returned: "مُعاد · Returned",
};

const SAMPLES = [
  { file: "layla-national-id.png", label: "هوية سليمة · Good ID" },
  { file: "layla-national-id-blurry.png", label: "هوية غير واضحة · Blurry ID" },
  { file: "layla-national-id-expired.png", label: "هوية منتهية · Expired ID" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export default function M5Demo() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [outbox, setOutbox] = useState<unknown[]>([]);
  const [consent, setConsent] = useState<unknown[]>([]);
  const [einv, setEinv] = useState<Einv | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/api/sanad/me");
      setUser(me.user);
      const [d, n, o, c] = await Promise.all([
        api<{ documents: Doc[] }>("/api/documents"),
        api<{ notifications: Note[]; unread: number }>("/api/notifications"),
        api<{ outbox: unknown[] }>("/api/notifications/send"),
        api<{ log: unknown[] }>("/api/consent"),
      ]);
      setDocs(d.documents);
      setNotes(n.notifications);
      setUnread(n.unread);
      setOutbox(o.outbox);
      setConsent(c.log);
    } catch {
      setUser(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    api<Einv>("/api/einvoicing").then(setEinv).catch(() => {});
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function uploadSample(file: string) {
    const blob = await (await fetch(`/samples/${file}`)).blob();
    await uploadFile(new File([blob], file, { type: "image/png" }));
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("docType", "national_id");
    await api("/api/documents/upload", { method: "POST", body: fd });
  }

  const uploads = docs.filter((d) => d.kind === "upload");
  const forms = docs.filter((d) => d.kind === "generated");
  const readyCount = forms.filter((d) => d.status === "ready_to_sign").length;

  return (
    <>
      <div className="mock-banner">بيانات تجريبية · سند تجريبي · Dummy data, SANAD is a MOCK</div>
      <div className="wrap">
        <div className="card">
          <h1>بداية · وحدة الهوية والمستندات (M5)</h1>
          <div className="en">Bedaya M5 test console: SANAD login, document vault, auto-fill, sign all, notifications</div>
          <a href="/dashboard" style={{ fontSize: 14 }}>لوحات الأطراف · Party dashboards →</a>
        </div>

        {error && <div className="card tag warn" style={{ fontSize: 14 }}>{error}</div>}

        {/* 1. Login */}
        <div className="card">
          <h2>1 · تسجيل الدخول عبر سند [7]</h2>
          {!checked ? (
            <p className="muted">...</p>
          ) : !user ? (
            <a className="btn primary" href="/api/sanad/login?return=/m5-demo">
              الدخول عبر سند · Login with SANAD (mock)
            </a>
          ) : (
            <>
              <table>
                <tbody>
                  {Object.entries(user).map(([k, v]) =>
                    typeof v === "object" && v ? (
                      <tr key={k}>
                        <td className="en">{k}</td>
                        <td>
                          <bdi>{String(v.value)}</bdi>
                        </td>
                        <td>
                          <span className={`tag ${SOURCE_TAG[v.source]?.[0]}`}>{SOURCE_TAG[v.source]?.[1] ?? v.source}</span>
                        </td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="muted">الرقم الوطني: {user.nationalId}</span>
                <button onClick={() => run("logout", () => api("/api/sanad/me", json({ action: "logout" })))}>خروج · Logout</button>
              </div>
            </>
          )}
        </div>

        {user && (
          <>
            {/* 2. Upload + OCR */}
            <div className="card">
              <h2>2 · رفع الهوية وقراءتها آليًا [3]</h2>
              <p className="en">Upload once; mock OCR reads it. Blurry and expired samples are for Ameen&apos;s document checker.</p>
              <div className="row">
                {SAMPLES.map((s) => (
                  <button key={s.file} disabled={!!busy} onClick={() => run("upload", () => uploadSample(s.file))}>
                    {s.label}
                  </button>
                ))}
                <label className="btn">
                  ملف من جهازك · Your file
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    hidden
                    onChange={(e) => e.target.files?.[0] && run("upload", () => uploadFile(e.target.files![0]))}
                  />
                </label>
              </div>
              {uploads.length > 0 && (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>الملف</th>
                      <th>الجودة</th>
                      <th>الثقة</th>
                      <th>انتهاء الهوية</th>
                      <th className="hide-sm">الحقول المقروءة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((d) => {
                      const o = d.ocr!;
                      const expired = o.fields.expiryDate && o.fields.expiryDate < new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={d.id}>
                          <td className="en">
                            <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.fileName}</a>
                          </td>
                          <td><span className={`tag ${quality(o) === "poor" ? "warn" : "sanad"}`}>{quality(o)} · {o.imageQuality}</span></td>
                          <td>{o.confidence}</td>
                          <td>{o.fields.expiryDate ? <span className={`tag ${expired ? "warn" : "typed"}`}>{o.fields.expiryDate}</span> : "-"}</td>
                          <td className="en hide-sm">{Object.keys(o.fields).join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 3. Auto-fill + 4. Sign all */}
            <div className="card">
              <h2>3 · تعبئة النماذج تلقائيًا [3] · 4 · التوقيع مرة واحدة [4]</h2>
              <div className="row">
                <button className="primary" disabled={!!busy} onClick={() => run("generate", () => api("/api/documents/generate", { method: "POST" }))}>
                  {busy === "generate" ? "..." : "تعبئة النماذج · Generate forms"}
                </button>
                <button className="primary" disabled={!!busy || !readyCount} onClick={() => run("sign", () => api("/api/documents/sign-all", json({})))}>
                  {busy === "sign" ? "..." : `وقّع الكل (${readyCount}) · Sign all`}
                </button>
              </div>
              {forms.length > 0 && (
                <table style={{ marginTop: 12 }}>
                  <tbody>
                    {forms.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.title}</a>
                          {!!d.missingFields?.length && <div className="tag warn">ناقص: {d.missingFields.join(", ")}</div>}
                        </td>
                        <td>
                          <span className={`tag ${d.status === "ready_to_sign" ? "ready" : d.status === "returned" ? "warn" : "signed"}`}>
                            {FORM_STATUS[d.status] ?? d.status}
                          </span>
                        </td>
                        <td className="en hide-sm">{d.signature?.signatureRef ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 5. Notifications */}
            <div className="card">
              <h2>5 · الإشعارات [11] · غير مقروءة: {unread}</h2>
              <div className="row" style={{ marginBottom: 10 }}>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run("n", () =>
                      api(
                        "/api/notifications/send",
                        json({ event: "visit_soon", vars: { placeAr: "بلدية إربد الكبرى", placeEn: "Greater Irbid Municipality", date: "2026-10-14", time: "10:00" } }),
                      ),
                    )
                  }
                >
                  موعد قريب · Visit soon
                </button>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run("n", () =>
                      api(
                        "/api/notifications/send",
                        json({ event: "document_needed", vars: { docAr: "إثبات ملكية المنزل", docEn: "home ownership proof", stepAr: "رخصة المهن", stepEn: "Vocational license" } }),
                      ),
                    )
                  }
                >
                  مستند مطلوب · Document needed
                </button>
                <button disabled={!unread || !!busy} onClick={() => run("read", () => api("/api/notifications", json({})))}>
                  تعليم الكل كمقروء · Mark all read
                </button>
              </div>
              {notes.map((n) => (
                <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", opacity: n.read ? 0.55 : 1 }}>
                  <strong>{n.titleAr}</strong> · {n.bodyAr}
                  <div className="en">{n.bodyEn}</div>
                </div>
              ))}
              <details style={{ marginTop: 10 }}>
                <summary className="muted">صندوق الإرسال التجريبي (بريد / واتساب) · Demo outbox</summary>
                <pre>{JSON.stringify(outbox, null, 2)}</pre>
              </details>
            </div>

            {/* Consent log */}
            <div className="card">
              <h2>سجل الموافقة والوصول للبيانات · Consent and access log</h2>
              <pre>{JSON.stringify(consent, null, 2)}</pre>
            </div>
          </>
        )}

        {/* 6. E-invoicing (screens only) */}
        {einv && (
          <div className="card">
            <h2>6 · {einv.titleAr} [21]</h2>
            <div className="en">{einv.titleEn}</div>
            <ol>
              {einv.steps.map((s) => (
                <li key={s.titleEn}>
                  {s.titleAr} <span className="en">· {s.titleEn}</span>
                </li>
              ))}
            </ol>
            <p className="muted en">{einv.disclaimerEn}</p>
          </div>
        )}
      </div>
    </>
  );
}
