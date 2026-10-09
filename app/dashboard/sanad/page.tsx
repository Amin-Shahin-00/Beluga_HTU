"use client";
// SANAD (MoDEE) dashboard: what the identity provider sees on its own side.
// In real life this is MoDEE's system and Bedaya never has it; it is simulated
// here to show the judges who controls login, consent and signatures.

import { useCallback, useEffect, useState } from "react";
import { Shell, StaffGate, api, fmt } from "../ui";

type Overview = {
  sanadMode: string;
  codes: { code: string; nationalId: string; nameAr: string; scopes: string[]; issuedAt: string; state: string }[];
  consents: { id: string; nationalId: string; nameAr: string; action: string; scopes: string[]; createdAt: string }[];
  accessByPurpose: Record<string, number>;
  signatures: { id: string; nameAr: string; nationalId: string; title: string; signatureRef: string; hash: string; signedAt: string }[];
  payments: { paymentId: string; amountJod: number; description: string; status: string }[];
};

const STATE_TAG: Record<string, string> = { used: "signed", waiting: "ready", expired: "grey" };

function SanadView({ signOut }: { signOut: () => void }) {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setD(await api<Overview>("/api/staff/sanad"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) return <div className="note bad">{error}</div>;
  if (!d) return <p className="muted">...</p>;

  const given = d.consents.filter((c) => c.action === "consent_given").length;
  const revoked = d.consents.filter((c) => c.action === "consent_revoked").length;

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>الشريك: منصة بداية · Partner: Bedaya</h2>
            <div className="en">Integration mode: {d.sanadMode} · partner status: pending MoDEE approval</div>
          </div>
          <div className="row">
            <button onClick={refresh}>تحديث · Refresh</button>
            <button onClick={signOut}>خروج · Sign out</button>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><b>{d.codes.length}</b><span>طلبات دخول · Login requests</span></div>
        <div className="stat"><b>{given}</b><span>موافقات · Consents given</span></div>
        <div className="stat"><b>{revoked}</b><span>سحب موافقة · Revoked</span></div>
        <div className="stat"><b>{d.signatures.length}</b><span>توقيعات · Signatures</span></div>
      </div>

      <div className="card">
        <h2>طلبات الدخول · Login requests</h2>
        <p className="muted">كل رمز يُستخدم مرة واحدة وينتهي خلال 5 دقائق. · Each code works once and expires in 5 minutes.</p>
        {d.codes.length ? (
          <table>
            <thead><tr><th>الوقت</th><th>المستخدم</th><th className="hide-sm">البيانات المطلوبة</th><th>الحالة</th></tr></thead>
            <tbody>
              {d.codes.map((c) => (
                <tr key={c.code + c.issuedAt}>
                  <td className="en">{fmt(c.issuedAt)}</td>
                  <td>{c.nameAr}<div className="en">{c.nationalId}</div></td>
                  <td className="hide-sm en">{c.scopes.join(", ")}</td>
                  <td><span className={`tag ${STATE_TAG[c.state]}`}>{c.state}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">لا طلبات بعد. · None yet.</div>}
      </div>

      <div className="grid">
        <div className="card">
          <h2>سجل الموافقات · Consent records</h2>
          {d.consents.length ? (
            <table>
              <tbody>
                {d.consents.slice(0, 20).map((c) => (
                  <tr key={c.id}>
                    <td className="en">{fmt(c.createdAt)}</td>
                    <td>{c.nameAr}</td>
                    <td>
                      <span className={`tag ${c.action === "consent_given" ? "signed" : "warn"}`}>
                        {c.action === "consent_given" ? "موافقة · given" : "سحب · revoked"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">لا سجلات. · None yet.</div>}
        </div>

        <div className="card">
          <h2>استخدام بداية للبيانات · Bedaya's data use</h2>
          <p className="muted">ما أبلغت عنه بداية: سبب كل وصول. · What Bedaya reported: the reason for every access.</p>
          <table>
            <tbody>
              {Object.entries(d.accessByPurpose).map(([p, n]) => (
                <tr key={p}><td className="en">{p}</td><td>{n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>التوقيعات الإلكترونية الصادرة · E-signatures issued</h2>
        {d.signatures.length ? (
          <table>
            <thead><tr><th>المرجع</th><th>الموقّع</th><th className="hide-sm">المستند</th><th className="hide-sm">البصمة</th></tr></thead>
            <tbody>
              {d.signatures.slice(0, 30).map((s) => (
                <tr key={s.id}>
                  <td className="en">{s.signatureRef}<div>{fmt(s.signedAt)}</div></td>
                  <td>{s.nameAr}<div className="en">{s.nationalId}</div></td>
                  <td className="hide-sm">{s.title.split(" | ")[1] ?? s.title}</td>
                  <td className="hide-sm en">{s.hash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">لا توقيعات بعد. · None yet.</div>}
      </div>
    </>
  );
}

export default function SanadDashboard() {
  return (
    <Shell
      title="لوحة سند · وزارة الاقتصاد الرقمي والريادة"
      sub="SANAD dashboard (MoDEE side). Simulated: in real life only MoDEE has this, not Bedaya."
      banner="محاكاة لجهة سند - في الواقع هذه اللوحة لدى الوزارة وليست لدى بداية · SIMULATED SANAD side, MOCK data"
    >
      <StaffGate roles={["sanad"]}>{(_role, signOut) => <SanadView signOut={signOut} />}</StaffGate>
    </Shell>
  );
}
