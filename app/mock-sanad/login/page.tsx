"use client";
// MOCK SANAD login + consent screen. Stands in for the real SANAD page until MoDEE approves the
// integration, and says so on every step. Demo identities are listed in the README, not here.
// Steps: 1 sign in (national ID + SANAD password) → 2 approve what Bedaya receives → 3 back to Bedaya.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import "./sanad.css";

type Lang = "ar" | "en";
type Step = "signin" | "consent" | "redirect";
const COPY = {
  ar: {
    brand: "سند",
    tagline: "الهوية الرقمية الأردنية",
    demo: "نسخة تجريبية لأغراض العرض فقط، وليست خدمة سند الحقيقية",
    steps: ["تسجيل الدخول", "الموافقة", "العودة إلى بداية"],
    asking: "منصة بداية تطلب تسجيل دخولك",
    nid: "الرقم الوطني",
    nidHint: "10 أرقام",
    pass: "كلمة مرور سند",
    show: "إظهار",
    hide: "إخفاء",
    signin: "تسجيل الدخول",
    checking: "جارٍ التحقق…",
    cancel: "إلغاء والعودة إلى بداية",
    demoHint: "هذه نسخة تجريبية: استخدم إحدى الهويات التجريبية الموجودة في ملف README.",
    wrong: "الرقم الوطني أو كلمة مرور سند غير صحيحة.",
    invalid: "أدخل رقماً وطنياً من 10 أرقام وكلمة مرور سند.",
    network: "تعذر الاتصال. حاول مرة أخرى.",
    consentTitle: "هل توافق على مشاركة بياناتك مع بداية؟",
    receives: "ستحصل منصة بداية على:",
    logged: "يُسجَّل كل وصول إلى بياناتك، ويمكنك سحب موافقتك في أي وقت من إعدادات سند.",
    approve: "أوافق ومتابعة",
    approving: "جارٍ الإرسال…",
    decline: "لا أوافق",
    notYou: "لست أنت؟ سجّل الدخول بهوية أخرى",
    redirect: "جارٍ إعادتك إلى بداية…",
    verified: "هوية موثقة",
    switchLang: "English",
  },
  en: {
    brand: "SANAD",
    tagline: "Jordan's digital identity",
    demo: "Demo version for the prototype only, not the real SANAD service",
    steps: ["Sign in", "Approve", "Back to Bedaya"],
    asking: "Bedaya is asking you to sign in",
    nid: "National ID",
    nidHint: "10 digits",
    pass: "SANAD password",
    show: "Show",
    hide: "Hide",
    signin: "Sign in",
    checking: "Checking…",
    cancel: "Cancel and return to Bedaya",
    demoHint: "This is a demo: use one of the test identities listed in the README.",
    wrong: "The national ID or SANAD password is incorrect.",
    invalid: "Enter a 10-digit national ID and your SANAD password.",
    network: "Couldn't connect. Please try again.",
    consentTitle: "Share your details with Bedaya?",
    receives: "Bedaya will receive:",
    logged: "Every access to your data is logged. You can withdraw consent at any time in SANAD.",
    approve: "Approve and continue",
    approving: "Sending…",
    decline: "Decline",
    notYou: "Not you? Sign in with another identity",
    redirect: "Taking you back to Bedaya…",
    verified: "Verified identity",
    switchLang: "العربية",
  },
} as const;
const SCOPE_INFO: Record<string, { icon: "id" | "phone" | "home"; ar: [string, string]; en: [string, string] }> = {
  identity: { icon: "id", ar: ["الهوية", "الاسم الكامل، الرقم الوطني، تاريخ الميلاد"], en: ["Identity", "Full name, national ID, date of birth"] },
  contact: { icon: "phone", ar: ["التواصل", "رقم الهاتف والبريد الإلكتروني"], en: ["Contact", "Mobile number and email"] },
  address: { icon: "home", ar: ["العنوان", "عنوان السكن والمدينة"], en: ["Address", "Home address and city"] },
};

function Icon({ name }: { name: "id" | "phone" | "home" | "lock" | "alert" | "check" | "shield" }) {
  const d = {
    id: "M3 5h18v14H3zM7 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0M6 16c.6-1.6 2-2.4 3-2.4s2.4.8 3 2.4M14 9h4M14 13h4",
    phone: "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2",
    home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
    lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
    alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
    check: "M5 12l5 5L20 7",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  }[name];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function readLang(): Lang {
  try {
    return JSON.parse(localStorage.getItem("bedaya.lang") || '"ar"') === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function MockSanadLogin() {
  const params = useSearchParams();
  const returnUrl = params.get("return") || "/";
  const requested = (params.get("scopes") || "identity").split(",").filter((s) => SCOPE_INFO[s]);
  const [lang, setLang] = useState<Lang>("ar");
  const [step, setStep] = useState<Step>("signin");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [person, setPerson] = useState<{ nameAr: string; nameEn: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nidRef = useRef<HTMLInputElement>(null);
  const c = COPY[lang];
  const cancelUrl = returnUrl.split("#")[0] || "/";

  useEffect(() => {
    setLang(readLang());
    nidRef.current?.focus();
  }, []);
  const toggleLang = () => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setLang(next);
    try {
      localStorage.setItem("bedaya.lang", JSON.stringify(next));
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
  };

  async function call(action: "verify" | "authorize") {
    try {
      const r = await fetch("/api/sanad/mock/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, nationalId, password, scopes: requested, return: returnUrl }),
      });
      return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
    } catch {
      return { ok: false, status: 0, data: {} };
    }
  }
  const failure = (status: number) => (status === 401 ? c.wrong : status === 400 ? c.invalid : c.network);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (nationalId.length !== 10 || !password) return setError(c.invalid);
    setBusy(true);
    setError("");
    const res = await call("verify");
    setBusy(false);
    if (!res.ok) return setError(failure(res.status));
    setPerson(res.data);
    setStep("consent");
  }

  async function approve() {
    setBusy(true);
    setError("");
    const res = await call("authorize");
    if (!res.ok) {
      setBusy(false);
      return setError(failure(res.status));
    }
    setStep("redirect");
    window.location.href = res.data.redirect;
  }

  const restart = () => {
    setPerson(null);
    setPassword("");
    setError("");
    setStep("signin");
    setTimeout(() => nidRef.current?.focus(), 0);
  };
  const stepIndex = { signin: 0, consent: 1, redirect: 2 }[step];
  const initials = person ? (lang === "ar" ? person.nameAr : person.nameEn).split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "";

  return (
    <div className="sn" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="sn-top">
        <div className="sn-brand">
          <span className="sn-mark" aria-hidden="true">سند</span>
          <div>
            <strong>{c.brand}</strong>
            <small>{c.tagline}</small>
          </div>
        </div>
        <button type="button" className="sn-lang" onClick={toggleLang} lang={lang === "ar" ? "en" : "ar"}>
          {c.switchLang}
        </button>
      </header>
      <div className="sn-demo" role="note">
        <Icon name="alert" />
        <span>{c.demo}</span>
      </div>

      <main className="sn-main">
        <ol className="sn-steps" aria-label={lang === "ar" ? "الخطوات" : "Steps"}>
          {c.steps.map((s, i) => (
            <li key={s} className={i < stepIndex ? "done" : i === stepIndex ? "now" : ""} aria-current={i === stepIndex ? "step" : undefined}>
              <span className="sn-dot">{i < stepIndex ? <Icon name="check" /> : i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <section className="sn-card">
          {step === "signin" && (
            <>
              <div className="sn-request">
                <img src="/bedaya/logo.png" alt="" width={54} height={30} />
                <span>{c.asking}</span>
              </div>
              <form onSubmit={signIn} noValidate>
                <label className="sn-field">
                  <span className="sn-label">
                    {c.nid}
                    <small className="sn-count" aria-live="polite">
                      {nationalId.length}/10
                    </small>
                  </span>
                  <span className="sn-input">
                    <Icon name="id" />
                    <input
                      ref={nidRef}
                      inputMode="numeric"
                      autoComplete="username"
                      dir="ltr"
                      maxLength={10}
                      placeholder={c.nidHint}
                      value={nationalId}
                      onChange={(e) => (setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10)), setError(""))}
                      aria-invalid={Boolean(error)}
                      required
                    />
                  </span>
                </label>
                <label className="sn-field">
                  <span className="sn-label">{c.pass}</span>
                  <span className="sn-input">
                    <Icon name="lock" />
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      dir="ltr"
                      value={password}
                      onChange={(e) => (setPassword(e.target.value), setError(""))}
                      aria-invalid={Boolean(error)}
                      required
                    />
                    <button type="button" className="sn-show" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}>
                      {showPass ? c.hide : c.show}
                    </button>
                  </span>
                </label>
                {error && (
                  <div className="sn-error" role="alert">
                    <Icon name="alert" />
                    <span>{error}</span>
                  </div>
                )}
                <button className="sn-btn sn-primary" disabled={busy}>
                  {busy && <span className="sn-spin" aria-hidden="true" />}
                  {busy ? c.checking : c.signin}
                </button>
                <a className="sn-link" href={cancelUrl}>
                  {c.cancel}
                </a>
              </form>
              <p className="sn-hint">{c.demoHint}</p>
            </>
          )}

          {step === "consent" && person && (
            <>
              <div className="sn-person">
                <span className="sn-avatar" aria-hidden="true">{initials}</span>
                <div>
                  <strong>{lang === "ar" ? person.nameAr : person.nameEn}</strong>
                  <small className="sn-verified">
                    <Icon name="shield" /> {c.verified} · <span dir="ltr">••••••{nationalId.slice(-4)}</span>
                  </small>
                </div>
              </div>
              <h1 className="sn-title">{c.consentTitle}</h1>
              <p className="sn-sub">{c.receives}</p>
              <ul className="sn-scopes">
                {requested.map((s) => (
                  <li key={s}>
                    <span className="sn-scope-icon">
                      <Icon name={SCOPE_INFO[s].icon} />
                    </span>
                    <div>
                      <strong>{SCOPE_INFO[s][lang][0]}</strong>
                      <small>{SCOPE_INFO[s][lang][1]}</small>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="sn-hint">{c.logged}</p>
              {error && (
                <div className="sn-error" role="alert">
                  <Icon name="alert" />
                  <span>{error}</span>
                </div>
              )}
              <div className="sn-actions">
                <button type="button" className="sn-btn sn-primary" disabled={busy} onClick={approve}>
                  {busy && <span className="sn-spin" aria-hidden="true" />}
                  {busy ? c.approving : c.approve}
                </button>
                <a className="sn-btn sn-secondary" href={cancelUrl}>
                  {c.decline}
                </a>
              </div>
              <button type="button" className="sn-link" onClick={restart}>
                {c.notYou}
              </button>
            </>
          )}

          {step === "redirect" && (
            <div className="sn-redirect" role="status">
              <span className="sn-spin big" aria-hidden="true" />
              <p>{c.redirect}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 32, textAlign: "center" }}>…</p>}>
      <MockSanadLogin />
    </Suspense>
  );
}
