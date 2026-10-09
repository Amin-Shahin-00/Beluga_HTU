"use client";
// MOCK SANAD login + consent screen. Stands in for the real SANAD page until MoDEE approves the
// integration. Clearly labelled as a mock. Demo identities are listed in the README, not here.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

type Scopes = Record<string, { ar: string; en: string }>;

function MockSanadLogin() {
  const params = useSearchParams();
  const returnUrl = params.get("return") || "/";
  const requested = (params.get("scopes") || "identity").split(",");
  const [labels, setLabels] = useState<Scopes>({});
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [person, setPerson] = useState<{ nameAr: string; nameEn: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/sanad/demo-users")
      .then((r) => r.json())
      .then((d) => setLabels(d.scopes ?? {}))
      .catch(() => setLabels({}));
  }, []);

  async function call(action: "verify" | "authorize") {
    const r = await fetch("/api/sanad/mock/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, nationalId, password, scopes: requested, return: returnUrl }),
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await call("verify");
    setBusy(false);
    if (!res.ok) return setError(res.data.error || "Sign-in failed");
    setPerson(res.data);
  }

  async function approve() {
    setBusy(true);
    setError("");
    const res = await call("authorize");
    if (!res.ok) {
      setBusy(false);
      return setError(res.data.error || "Could not approve");
    }
    window.location.href = res.data.redirect;
  }

  return (
    <>
      <div className="mock-banner">نسخة تجريبية من سند - ليست خدمة سند الحقيقية · MOCK SANAD - demo only, not the real SANAD service</div>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <p>
          <a href="/">← العودة إلى بداية · Back to Bedaya</a>
        </p>
        <div className="card">
          <div className="sanad-head">
            <div className="sanad-logo">سند</div>
            <div>
              <h1>تسجيل الدخول عبر سند</h1>
              <div className="en">Sign in with SANAD (demo)</div>
            </div>
          </div>
        </div>

        {!person && (
          <form className="card" onSubmit={signIn}>
            <label>
              الرقم الوطني <span className="en">· National ID</span>
              <input inputMode="numeric" autoComplete="username" maxLength={10} value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))} required />
            </label>
            <label>
              كلمة مرور سند <span className="en">· SANAD password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" disabled={busy || nationalId.length !== 10 || !password}>
                دخول · Sign in
              </button>
              <button type="button" onClick={() => (window.location.href = returnUrl.split("#")[0] || "/")}>
                إلغاء · Cancel
              </button>
            </div>
          </form>
        )}

        {person && (
          <div className="card">
            <h2>منصة بداية تطلب الوصول إلى بياناتك</h2>
            <p className="en">
              {person.nameAr} · {person.nameEn}: Bedaya is asking to use this data from your SANAD account:
            </p>
            <ul>
              {requested.map((s) => (
                <li key={s}>
                  {labels[s]?.ar ?? s} <span className="en">· {labels[s]?.en}</span>
                </li>
              ))}
            </ul>
            <p className="muted">
              سيتم تسجيل كل وصول إلى بياناتك. يمكنك سحب الموافقة في أي وقت.
              <br />
              <span className="en">Every access is logged. You can withdraw consent at any time.</span>
            </p>
            <div className="row">
              <button className="primary" disabled={busy} onClick={approve}>
                أوافق · Approve
              </button>
              <button onClick={() => (setPerson(null), setPassword(""))}>رجوع · Back</button>
            </div>
          </div>
        )}

        {error && <div className="card tag warn" role="alert">{error}</div>}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MockSanadLogin />
    </Suspense>
  );
}
