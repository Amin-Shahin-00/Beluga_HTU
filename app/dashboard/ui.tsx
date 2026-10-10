"use client";
// Shared pieces for the four party dashboards (client, government, SANAD, admin).

import { useEffect, useState, type ReactNode } from "react";
import { BLUR_THRESHOLDS } from "../../lib/integrations/types";

/** good / fair / poor from the shared OcrResult numbers. "poor" is what the document checker calls blurry. */
export function quality(o?: { confidence: number; imageQuality: number }): "good" | "fair" | "poor" | "" {
  if (!o) return "";
  if (o.confidence < BLUR_THRESHOLDS.minConfidence || o.imageQuality < BLUR_THRESHOLDS.minImageQuality) return "poor";
  return o.imageQuality >= 0.75 ? "good" : "fair";
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `HTTP ${r.status}`), { status: r.status });
  return d as T;
}

export const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fmt = (iso?: string) => (iso ? iso.replace("T", " ").slice(0, 16) : "-");

/** Labels and tag colours for every document status. */
export const STATUS: Record<string, { ar: string; en: string; tag: string }> = {
  uploaded: { ar: "مرفوع", en: "Uploaded", tag: "grey" },
  ready_to_sign: { ar: "جاهز للتوقيع", en: "Ready to sign", tag: "ready" },
  signed: { ar: "موقّع", en: "Signed", tag: "signed" },
  submitted: { ar: "قيد المراجعة", en: "Under review", tag: "blue" },
  approved: { ar: "تمت الموافقة", en: "Approved", tag: "signed" },
  returned: { ar: "مُعاد للتعديل", en: "Returned", tag: "warn" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status] ?? { ar: status, en: status, tag: "grey" };
  return (
    <span className={`tag ${s.tag}`}>
      {s.ar} · {s.en}
    </span>
  );
}

export const SOURCE_TAG: Record<string, [string, string]> = {
  verified_by_sanad: ["sanad", "موثّق من سند"],
  read_by_ocr: ["ocr", "من مسح الهوية"],
  typed_by_user: ["typed", "أدخله المستخدم"],
};

export function Shell({ title, sub, banner, children }: { title: string; sub: string; banner?: string; children: ReactNode }) {
  return (
    <>
      {banner && <div className="mock-banner">{banner}</div>}
      <div className="wrap wide">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="en">{sub}</div>
          </div>
          <a href="/dashboard">← كل اللوحات · All dashboards</a>
        </div>
        {children}
      </div>
    </>
  );
}

export const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  "gov:MIT": { ar: "وزارة الصناعة والتجارة والتموين", en: "Ministry of Industry, Trade and Supply" },
  "gov:CCD": { ar: "دائرة مراقبة الشركات", en: "Companies Control Department" },
  "gov:GAM": { ar: "أمانة عمّان الكبرى", en: "Greater Amman Municipality" },
  "gov:IRBID": { ar: "بلدية إربد الكبرى", en: "Greater Irbid Municipality" },
  "gov:ISTD": { ar: "دائرة ضريبة الدخل والمبيعات", en: "Income and Sales Tax Department" },
  "gov:JFDA": { ar: "المؤسسة العامة للغذاء والدواء", en: "Jordan Food and Drug Administration" },
  sanad: { ar: "فريق سند - وزارة الاقتصاد الرقمي", en: "SANAD team - MoDEE" },
  admin: { ar: "فريق بداية", en: "Bedaya team" },
};

/**
 * Staff sign-in for the demo: the signed-in Bedaya admin account picks which office it plays, then
 * the dashboard renders. Anyone else is asked to sign in as admin. Real life: each party's own login.
 */
export function StaffGate({ roles, children }: { roles: string[]; children: (role: string, signOut: () => void) => ReactNode }) {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [allowed, setAllowed] = useState(true);
  const [picked, setPicked] = useState(roles[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ role: string | null; allowed?: boolean }>("/api/staff/session")
      .then((d) => (setAllowed(d.allowed !== false), setRole(d.role)))
      .catch(() => setRole(null));
  }, []);

  async function signIn() {
    setError("");
    try {
      const d = await api<{ role: string }>("/api/staff/session", json({ role: picked }));
      setRole(d.role);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function signOut() {
    await api("/api/staff/session", { method: "DELETE" }).catch(() => {});
    setRole(null);
  }

  if (role === undefined) return <p className="muted">...</p>;
  if (role && roles.includes(role)) return <>{children(role, signOut)}</>;
  if (!allowed)
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>لوحات الموظفين لحساب الإدارة فقط</h2>
        <p className="en">Staff dashboards are for the Bedaya admin account, which plays each office in this demo.</p>
        <p className="muted">سجّل الدخول إلى بداية بحساب الإدارة ثم عد إلى هذه الصفحة. · Sign in to Bedaya as admin, then come back.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn primary" href="/#account">
            تسجيل الدخول · Sign in
          </a>
        </div>
      </div>
    );

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2>تسجيل دخول الموظفين</h2>
      <p className="en">Staff sign-in (demo): as the Bedaya admin, choose which office to act as. In real life each party signs in through its own system.</p>
      {roles.length > 1 &&
        roles.map((r) => (
          <label key={r} className={`choice ${picked === r ? "on" : ""}`}>
            <input type="radio" name="role" checked={picked === r} onChange={() => setPicked(r)} />
            <div>
              <div>{ROLE_LABELS[r]?.ar ?? r}</div>
              <div className="en">{ROLE_LABELS[r]?.en}</div>
            </div>
          </label>
        ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={signIn}>
          دخول باسم {ROLE_LABELS[picked]?.ar} · Sign in
        </button>
      </div>
      {error && <div className="note bad">{error}</div>}
    </div>
  );
}
