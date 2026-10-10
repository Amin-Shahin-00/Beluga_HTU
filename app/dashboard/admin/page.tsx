"use client";
// Bedaya admin dashboard: the team follows every applicant's progress and
// problems, and sees the message log. No access to applicants' files.

import { useCallback, useEffect, useState } from "react";
import { Shell, StaffGate, api, fmt, json } from "../ui";

type Applicant = {
  nationalId: string;
  nameAr: string;
  nameEn: string;
  stage: { key: string; ar: string; en: string };
  uploads: number;
  forms: number;
  signed: number;
  submitted: number;
  approved: number;
  returned: number;
  unread: number;
  warnings: { ar: string; en: string }[];
};
type Overview = {
  applicants: Applicant[];
  totals: { applicants: number; forms: number; waitingOnGovernment: number; approved: number; messages: number };
  outbox: { id: string; channel: string; to: string; subject?: string; body: string; status: string; createdAt: string }[];
};

const STAGE_TAG: Record<string, string> = {
  approved: "signed",
  returned: "warn",
  submitted: "blue",
  signed: "signed",
  ready: "ready",
  uploaded: "grey",
  registered: "grey",
  none: "grey",
};

function AdminView({ signOut }: { signOut: () => void }) {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setD(await api<Overview>("/api/staff/admin"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function reset() {
    if (!confirm("حذف كل البيانات التجريبية؟ · Delete all demo data?")) return;
    await api("/api/staff/admin", json({ action: "reset" })).catch((e) => setError((e as Error).message));
    await refresh();
  }

  if (error) return <div className="note bad">{error}</div>;
  if (!d) return <p className="muted">...</p>;

  return (
    <>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={refresh}>تحديث · Refresh</button>
        <button onClick={reset}>مسح البيانات التجريبية · Reset demo data</button>
        <button onClick={signOut}>خروج · Sign out</button>
      </div>

      <div className="stats">
        <div className="stat"><b>{d.totals.applicants}</b><span>متقدمون · Applicants</span></div>
        <div className="stat"><b>{d.totals.forms}</b><span>نماذج · Forms</span></div>
        <div className="stat"><b>{d.totals.waitingOnGovernment}</b><span>بانتظار الحكومة · With government</span></div>
        <div className="stat"><b>{d.totals.approved}</b><span>موافق عليها · Approved</span></div>
        <div className="stat"><b>{d.totals.messages}</b><span>رسائل · Messages logged</span></div>
      </div>

      <div className="card">
        <h2>المتقدمون · Applicants</h2>
        <p className="muted">
          نرى التقدم والمشاكل فقط، لا ملفات المتقدمين. · Progress and problems only: the team can&apos;t open applicants&apos; files.
        </p>
        <table>
          <thead>
            <tr>
              <th>المتقدم</th>
              <th>المرحلة</th>
              <th className="hide-sm">النماذج</th>
              <th>تنبيهات</th>
            </tr>
          </thead>
          <tbody>
            {d.applicants.map((a) => (
              <tr key={a.nationalId}>
                <td>{a.nameAr}<div className="en">{a.nameEn} · {a.nationalId}</div></td>
                <td>
                  <span className={`tag ${STAGE_TAG[a.stage.key]}`}>{a.stage.ar}</span>
                  <div className="en">{a.stage.en}</div>
                </td>
                <td className="hide-sm en">
                  {a.forms} forms · {a.signed} signed · {a.submitted} waiting · {a.approved} approved · {a.returned} returned
                  <div>{a.uploads} uploads · {a.unread} unread notifications</div>
                </td>
                <td>
                  {a.warnings.length ? (
                    a.warnings.map((w) => (
                      <div key={w.en} className="tag warn" style={{ display: "inline-block", margin: "0 0 4px 4px" }}>{w.ar}</div>
                    ))
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>سجل الرسائل · Message log</h2>
        {d.outbox.length ? (
          <table>
            <thead><tr><th>الوقت</th><th>القناة</th><th className="hide-sm">إلى</th><th>الرسالة</th></tr></thead>
            <tbody>
              {d.outbox.map((o) => (
                <tr key={o.id}>
                  <td className="en">{fmt(o.createdAt)}</td>
                  <td>
                    <span className={`tag ${o.channel === "email" ? "blue" : "signed"}`}>{o.channel}</span>
                    <div className="en">{o.status}</div>
                  </td>
                  <td className="hide-sm en">{o.to}</td>
                  <td style={{ whiteSpace: "pre-line" }}>{o.subject ?? o.body.split("\n")[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">لا رسائل بعد. · None yet.</div>}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  return (
    <Shell title="لوحة إدارة بداية" sub="Bedaya admin dashboard: applicants' progress, problems and messages">
      <StaffGate roles={["admin"]}>{(_role, signOut) => <AdminView signOut={signOut} />}</StaffGate>
    </Shell>
  );
}
