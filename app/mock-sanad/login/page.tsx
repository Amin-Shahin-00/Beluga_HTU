"use client";
// MOCK SANAD login + consent screen. Stands in for the real SANAD page until
// MoDEE approves the integration. Clearly labeled as a mock on screen.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type DemoUser = { nationalId: string; nameAr: string; nameEn: string };
type Scopes = Record<string, { ar: string; en: string }>;

function MockSanadLogin() {
  const params = useSearchParams();
  const returnUrl = params.get("return") || "/m5-demo";
  const requested = (params.get("scopes") || "identity").split(",");
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [labels, setLabels] = useState<Scopes>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [stage, setStage] = useState<"pick" | "consent">("pick");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/sanad/demo-users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users);
        setLabels(d.scopes);
        setPicked(d.users[0]?.nationalId ?? null);
      })
      .catch(() => setError("Could not load demo users"));
  }, []);

  async function approve() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/sanad/mock/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nationalId: picked, scopes: requested, return: returnUrl }),
    });
    const d = await r.json();
    if (!r.ok) {
      setBusy(false);
      return setError(d.error);
    }
    window.location.href = d.redirect;
  }

  const user = users.find((u) => u.nationalId === picked);

  return (
    <>
      <div className="mock-banner">
        نسخة تجريبية من سند - ليست خدمة سند الحقيقية · MOCK SANAD - not the real SANAD service
      </div>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="card">
          <div className="sanad-head">
            <div className="sanad-logo">سند</div>
            <div>
              <h1>تسجيل الدخول عبر سند</h1>
              <div className="en">Sign in with SANAD (mock)</div>
            </div>
          </div>
        </div>

        {stage === "pick" && (
          <div className="card">
            <h2>اختر هوية تجريبية</h2>
            <p className="en">Choose a demo identity (dummy data)</p>
            {users.map((u) => (
              <label key={u.nationalId} className={`choice ${picked === u.nationalId ? "on" : ""}`}>
                <input type="radio" name="u" checked={picked === u.nationalId} onChange={() => setPicked(u.nationalId)} />
                <div>
                  <div>{u.nameAr}</div>
                  <div className="en">
                    {u.nameEn} · {u.nationalId}
                  </div>
                </div>
              </label>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" disabled={!picked} onClick={() => setStage("consent")}>
                متابعة · Continue
              </button>
            </div>
          </div>
        )}

        {stage === "consent" && user && (
          <div className="card">
            <h2>منصة بداية تطلب الوصول إلى بياناتك</h2>
            <p className="en">Bedaya is asking to use this data from your SANAD account:</p>
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
              <button onClick={() => (window.location.href = returnUrl)}>إلغاء · Cancel</button>
            </div>
          </div>
        )}

        {error && <div className="card tag warn">{error}</div>}
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
