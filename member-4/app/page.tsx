"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from 'next/link';
type Business = { id: number; name: string; type: string; city: string; status: string };

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  async function loadBusinesses() {
    const response = await fetch("/api/business", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setBusinesses(result.data);
  }
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        if (response.status === 401) return;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setEmail(result.user.email);
        await loadBusinesses();
      } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخادم."); }
      finally { setLoading(false); }
    }
    void load();
  }, []);
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") || "signin";
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email: values.get("email"), password: values.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      if (action === "signin") { setEmail(result.user.email); await loadBusinesses(); }
      else setMessage("راجع بريدك لتأكيد الحساب، ثم سجّل الدخول.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }
  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(values)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset(); await loadBusinesses(); setMessage("تم حفظ مشروعك بنجاح.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }
  async function signout() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signout" }) });
      if (!response.ok) throw new Error("تعذر تسجيل الخروج.");
      setEmail(null); setBusinesses([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }
  const inputClass = "w-full rounded-lg border border-slate-300 p-3 bg-white text-slate-900";
  const buttonClass = "rounded-lg bg-teal-700 px-5 py-3 text-white disabled:opacity-50";
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <header><p className="text-teal-700">بداية • Bedaya</p><h1 className="text-3xl font-bold">ابدأ مشروعك</h1><p className="mt-2">سجّل الدخول وأضف معلومات مشروعك.</p><Link href="/backend" className="mt-3 inline-block text-teal-700 underline">لوحة تجربة Member 4</Link></header>
        {message && <p role="status" className="rounded-lg border bg-white p-4">{message}</p>}
        {loading ? <p>جارٍ التحميل…</p> : !email ? (
          <form onSubmit={auth} className="space-y-4 rounded-xl border bg-white p-6">
            <label className="block">البريد الإلكتروني<input name="email" type="email" dir="ltr" required maxLength={254} autoComplete="email" className={inputClass} /></label>
            <label className="block">كلمة المرور<input name="password" type="password" dir="ltr" required maxLength={128} autoComplete="current-password" className={inputClass} /></label>
            <div className="flex gap-3"><button disabled={busy} value="signin" className={buttonClass}>تسجيل الدخول</button><button disabled={busy} value="signup" className={buttonClass}>إنشاء حساب</button></div>
          </form>
        ) : <>
          <div className="flex items-center justify-between gap-3"><span dir="ltr">{email}</span><button onClick={signout} disabled={busy} className={buttonClass}>تسجيل الخروج</button></div>
          <form onSubmit={createBusiness} className="space-y-4 rounded-xl border bg-white p-6">
            <h2 className="text-xl font-bold">إضافة مشروع</h2>
            <label className="block">اسم المشروع<input name="name" required maxLength={120} className={inputClass} /></label>
            <label className="block">نوع المشروع<input name="type" required maxLength={120} placeholder="مثل: مشروع منزلي" className={inputClass} /></label>
            <label className="block">المدينة<input name="city" required maxLength={120} className={inputClass} /></label>
            <button disabled={busy} className={buttonClass}>حفظ المشروع</button>
          </form>
          <section className="space-y-3"><h2 className="text-xl font-bold">مشاريعي</h2>{businesses.length === 0 && <p>لا توجد مشاريع حتى الآن.</p>}{businesses.map(business => <article key={business.id} className="rounded-xl border bg-white p-4"><h3 className="font-bold">{business.name}</h3><p>{business.type} • {business.city}</p><p>الحالة: {business.status}</p></article>)}</section>
        </>}
      </div>
    </main>
  );
}
