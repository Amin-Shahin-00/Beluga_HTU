"use client";
// Contact form on a published site. Messages go to the owner's Website builder inbox in Bedaya.
import { useState, type FormEvent } from "react";

export default function ContactForm({ slug, lang, preview = false }: { slug: string; lang: "ar" | "en"; preview?: boolean }) {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("website")) return; // bots fill the hidden field
    if (preview) return setState("sent"); // the builder preview never sends
    setState("sending");
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(slug)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), contact: form.get("contact"), message: form.get("message") }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : L("Couldn't send. Try again.", "تعذر الإرسال. حاول مرة أخرى."));
      setState("error");
    }
  }

  if (state === "sent") return <p className="ps-sent" role="status">{L("Thank you! We'll get back to you soon.", "شكراً لك! سنعود إليك قريباً.")}</p>;
  return (
    <form className="ps-form" onSubmit={submit}>
      <label>
        {L("Your name", "اسمك")}
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        {L("Phone or email", "الهاتف أو البريد")}
        <input name="contact" required minLength={3} maxLength={160} />
      </label>
      <label>
        {L("Message", "الرسالة")}
        <textarea name="message" required maxLength={2000} rows={4} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="ps-hp" aria-hidden="true" />
      {state === "error" && <p className="ps-err" role="alert">{error}</p>}
      <button className="ps-btn" disabled={state === "sending"}>{state === "sending" ? L("Sending…", "جارٍ الإرسال…") : L("Send", "إرسال")}</button>
    </form>
  );
}
