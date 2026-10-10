"use client";
// Government office dashboard: staff of one office see only the forms sent to
// that office, check the signature, and approve or return with a note.
// Real life: each office's own system; this shows what Bedaya would hand over.

import { useCallback, useEffect, useState } from "react";
import { Shell, StaffGate, StatusTag, api, fmt, json } from "../ui";

type GovDoc = {
  id: string;
  title: string;
  status: string;
  submittedAt?: string;
  review?: { decision: string; note?: string; at: string };
  missingFields: string[];
  fileUrl: string;
  applicant: { nationalId: string; nameAr: string; nameEn: string };
  businessNameAr: string;
  signature: { signed: boolean; valid: boolean; signatureRef?: string; signedAt?: string };
};

const OFFICE_ROLES = ["gov:IRBID", "gov:MIT", "gov:JFDA", "gov:ISTD", "gov:GAM", "gov:CCD"];
const TABS = [
  { key: "submitted", ar: "بانتظار المراجعة", en: "Waiting" },
  { key: "approved", ar: "تمت الموافقة", en: "Approved" },
  { key: "returned", ar: "مُعاد", en: "Returned" },
];

function OfficeQueue({ signOut }: { signOut: () => void }) {
  const [office, setOffice] = useState<{ ar: string; en: string } | null>(null);
  const [docs, setDocs] = useState<GovDoc[]>([]);
  const [tab, setTab] = useState("submitted");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const d = await api<{ office: { ar: string; en: string }; documents: GovDoc[] }>("/api/staff/gov/documents");
      setOffice(d.office);
      setDocs(d.documents);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function decide(id: string, decision: "approved" | "returned") {
    setBusy(id);
    setError("");
    try {
      await api(`/api/staff/gov/documents/${id}/review`, json({ decision, note: notes[id] }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const count = (s: string) => docs.filter((d) => d.status === s).length;
  const shown = docs.filter((d) => d.status === tab);

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>{office?.ar}</h2>
            <div className="en">{office?.en}</div>
          </div>
          <div className="row">
            <button onClick={refresh}>تحديث · Refresh</button>
            <button onClick={signOut}>تبديل الجهة · Switch office</button>
          </div>
        </div>
      </div>

      <div className="stats">
        {TABS.map((t) => (
          <div key={t.key} className="stat">
            <b>{count(t.key)}</b>
            <span>{t.ar} · {t.en}</span>
          </div>
        ))}
      </div>

      {error && <div className="note bad" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <div className="m5-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.ar} ({count(t.key)})
            </button>
          ))}
        </div>

        {!shown.length && (
          <div className="empty">
            لا توجد طلبات هنا. ترسل الطلبات من لوحة صاحب المشروع بعد التوقيع.
            <div className="en">Nothing here. Applicants send forms from the client dashboard after signing.</div>
          </div>
        )}

        {shown.map((d) => (
          <div key={d.id} className="review-box">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{d.title.split(" | ")[1] ?? d.title}</strong>
                <div className="en">{d.title.split(" | ")[0]}</div>
              </div>
              <StatusTag status={d.status} />
            </div>
            <table style={{ marginTop: 8 }}>
              <tbody>
                <tr>
                  <td>مقدم الطلب</td>
                  <td>{d.applicant.nameAr} <span className="en">· {d.applicant.nameEn} · {d.applicant.nationalId}</span></td>
                </tr>
                <tr><td>المشروع</td><td>{d.businessNameAr}</td></tr>
                <tr><td>تاريخ الإرسال</td><td className="en">{fmt(d.submittedAt)}</td></tr>
                <tr>
                  <td>التوقيع</td>
                  <td>
                    {d.signature.valid ? (
                      <span className="tag signed">✓ توقيع صحيح، لم يُعدَّل المستند · Valid, unchanged since signing</span>
                    ) : (
                      <span className="tag warn">✗ التوقيع غير صالح أو المستند معدّل · Invalid or changed</span>
                    )}
                    <div className="en">{d.signature.signatureRef} · {fmt(d.signature.signedAt)} · SANAD</div>
                  </td>
                </tr>
                {!!d.missingFields.length && (
                  <tr><td>حقول ناقصة</td><td><span className="tag warn">{d.missingFields.join(", ")}</span></td></tr>
                )}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <a className="btn" href={d.fileUrl} target="_blank" rel="noreferrer">فتح النموذج (PDF) · Open form</a>
            </div>
            {d.review && (
              <div className={`note ${d.review.decision === "approved" ? "good" : "bad"}`}>
                {d.review.decision === "approved" ? "تمت الموافقة" : "أُعيد للتعديل"} · {fmt(d.review.at)}
                {d.review.note && <div>{d.review.note}</div>}
              </div>
            )}
            {d.status === "submitted" && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  placeholder="ملاحظة لمقدم الطلب (مطلوبة عند الإعادة) · Note to the applicant (required to return)"
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="primary" disabled={busy === d.id || !d.signature.valid} onClick={() => decide(d.id, "approved")}>
                    موافقة · Approve
                  </button>
                  <button disabled={busy === d.id || !notes[d.id]?.trim()} onClick={() => decide(d.id, "returned")}>
                    إعادة مع ملاحظة · Return with note
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="muted">
        كل فتح لنموذج يُسجَّل في سجل خصوصية مقدم الطلب. · Every time you open a form, it shows in the applicant&apos;s privacy log.
      </p>
    </>
  );
}

export default function GovernmentDashboard() {
  return (
    <Shell title="لوحة الجهة الحكومية" sub="Government office dashboard: review the signed forms sent to your office">
      <StaffGate roles={OFFICE_ROLES}>{(_role, signOut) => <OfficeQueue signOut={signOut} />}</StaffGate>
    </Shell>
  );
}
