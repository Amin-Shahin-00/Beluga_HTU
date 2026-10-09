// Shared helpers for the Bedaya site: language, API calls, toasts, dialogs and the user's session.
// Every value shown on screen goes through esc() or textContent, never raw HTML.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- storage (falls back to memory when the browser blocks it, as in Member 3's app) ----------
const memory = {};
export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(`bedaya.${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return memory[key] ?? fallback;
  }
}
export function save(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem(`bedaya.${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable: the page still works for this visit */
  }
}

// ---------- language ----------
export let lang = read("lang", "ar");
export function setLang(value) {
  lang = value;
  save("lang", value);
}
/** t("English", "العربية") */
export const t = (en, ar) => (lang === "ar" ? ar : en);
/** Text from a { en, ar } object or an [en, ar] pair. */
export const tx = (v) => (v == null ? "" : Array.isArray(v) ? v[lang === "ar" ? 1 : 0] : typeof v === "object" ? (v[lang] ?? v.en ?? "") : String(v));

export const jod = (n) => (n == null ? "—" : `${Number(n).toLocaleString("en")} ${t("JOD", "دينار")}`);
export const day = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const time = (iso) => new Date(iso).toLocaleTimeString(lang === "ar" ? "ar-JO" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Amman" });

// ---------- API ----------
/**
 * Calls a same-origin API. Returns { ok, status, data } and never throws, so screens can show
 * an honest message instead of breaking. `form` sends multipart (uploads); `body` sends JSON.
 */
export async function api(path, { method = "GET", body, form, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init = { method, credentials: "same-origin", signal: controller.signal, headers: {} };
    if (form) init.body = form;
    else if (body !== undefined || (method !== "GET" && method !== "DELETE")) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body ?? {});
    }
    const res = await fetch(path, init);
    const type = res.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await res.json().catch(() => ({})) : await res.blob();
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return { ok: false, status: 0, data: { error: timedOut ? t("The service took too long. Try again.", "استغرقت الخدمة وقتاً طويلاً. حاول مرة أخرى.") : t("Network error. Check your connection.", "خطأ في الشبكة. تحقق من الاتصال.") } };
  } finally {
    clearTimeout(timer);
  }
}
export const errorText = (res) => (res?.data && typeof res.data.error === "string" ? res.data.error : t("Something went wrong.", "حدث خطأ ما."));

/** Downloads a GET endpoint as a file (PDF, ZIP). */
export async function download(path, filename) {
  const res = await api(path, { timeoutMs: 60000 });
  if (!res.ok || !(res.data instanceof Blob)) {
    toast(res.ok ? t("The file could not be prepared.", "تعذر تجهيز الملف.") : errorText(res));
    return false;
  }
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ---------- feedback ----------
let toastTimer;
export function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.style.display = "none"), 3500);
}

/** Confirmation dialog in Member 2's style. Resolves { confirmed, note }. */
export function confirmDialog({ title, body = "", confirmLabel = t("Confirm", "تأكيد"), withNote = false, noteRequired = false, html = "" }) {
  const modal = $("#modal");
  modal.innerHTML = `<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ""}${html}
    ${withNote ? `<label class="field"><span>${t("Note", "ملاحظة")}</span><textarea id="modal-note" rows="3"></textarea></label>` : ""}
    <p id="modal-error" class="error" role="alert"></p>
    <div class="toolbar"><button id="modal-cancel">${t("Cancel", "إلغاء")}</button><button id="modal-confirm" class="primary">${esc(confirmLabel)}</button></div>`;
  modal.showModal();
  return new Promise((resolve) => {
    $("#modal-cancel").onclick = () => {
      modal.close();
      resolve({ confirmed: false });
    };
    $("#modal-confirm").onclick = () => {
      const note = withNote ? $("#modal-note").value.trim() : "";
      if (noteRequired && !note) {
        $("#modal-error").textContent = t("Please add a note.", "يرجى إضافة ملاحظة.");
        return;
      }
      modal.close();
      resolve({ confirmed: true, note });
    };
  });
}

export function go(route) {
  if (location.hash.slice(1) === route) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = route;
}

// ---------- session: one source of truth, GET /api/account/me ----------
// The account (Supabase), its role, and the SANAD identity linked to it. Nothing about the person is
// cached in the browser: when the account changes, every per-user key is wiped.
export const session = {
  backend: "unknown", // "ok" | "down" (Supabase not configured or unreachable)
  account: null, // { id, email }
  role: null, // "owner" | "bank" | "incubator" | "expert" | "admin"
  partnerKey: null,
  expert: null, // { key, name, title } for expert accounts
  identity: null, // { nationalId, verified: { field: { value, source } } } linked SANAD identity
  pendingSanad: null, // SANAD login that has no account yet: { nationalId, user }
  businesses: [],
  business: null,
  onboarding: null, // M4 bedaya_profiles row
  profile: null, // submitted UserProfile (M5 shape)
};

const KEEP = new Set(["bedaya.lang"]);
/** Removes every per-user value from this browser (wizard answers, selections, IDs). */
export function clearUserStorage() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bedaya.") && !KEEP.has(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
  for (const k of Object.keys(memory)) if (k !== "lang") delete memory[k];
}

export async function loadSession() {
  const me = await api("/api/account/me");
  const ctx = me.ok ? me.data : {};
  Object.assign(session, {
    backend: me.ok ? ctx.backend : "down",
    account: ctx.account ?? null,
    role: ctx.role ?? null,
    partnerKey: ctx.partnerKey ?? null,
    expert: ctx.expert ?? null,
    identity: ctx.identity ?? null,
    pendingSanad: ctx.pendingSanad ?? null,
    businesses: [],
    business: null,
    onboarding: null,
    profile: null,
  });
  // A different person (or nobody) is signed in now: forget the previous person's local data.
  if (read("accountId", null) !== (session.account?.id ?? null)) {
    clearUserStorage();
    save("accountId", session.account?.id ?? null);
  }
  if (!session.account || session.role !== "owner") return session;

  const list = await api("/api/business");
  session.businesses = list.ok ? list.data.data || [] : [];
  const wanted = read("businessId", null);
  session.business = session.businesses.find((b) => b.id === wanted) || session.businesses[0] || null;
  if (session.business) {
    save("businessId", session.business.id);
    const ob = await api(bpath("onboarding"));
    session.onboarding = ob.ok ? ob.data.data : null;
    if (session.onboarding?.submitted_at) session.profile = { ...session.onboarding.answers, userId: session.account.id };
  }
  return session;
}

/** The main page for each kind of account. */
export function homeRoute() {
  if (!session.account) return "entry";
  return { owner: session.profile ? "roadmap" : session.identity ? "w1" : "link-sanad", bank: "partner", incubator: "partner", expert: "expert", admin: "admin" }[session.role] || "entry";
}

/** Loads a script once (Leaflet, pdf-lib). */
const scripts = {};
export function loadScript(src) {
  scripts[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
  return scripts[src];
}
export function loadStyle(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.append(l);
  }
}

/** Office and document names from M1's data (cached). */
let referenceCache = null;
export async function reference() {
  if (!referenceCache) {
    const res = await api("/api/ai/reference");
    referenceCache = res.ok ? res.data : { offices: {}, documents: {}, sources: {} };
  }
  return referenceCache;
}
export const officeName = (ref, id) => (ref.offices[id] ? tx(ref.offices[id].name) : id || "");
export const docName = (ref, id) => (ref.documents[id] ? tx(ref.documents[id].name) : id || "");

/** Path under the current business, e.g. bpath("roadmap") → /api/platform/businesses/12/roadmap */
export const bpath = (sub) => `/api/platform/businesses/${session.business?.id}/${sub}`;
export const ready = () => Boolean(session.account && session.profile);

/** A SANAD-verified field of the signed-in owner (or of a SANAD login waiting for an account). */
export const sanadValue = (key) => session.identity?.verified?.[key]?.value ?? session.pendingSanad?.user?.[key]?.value ?? "";
export const displayName = () => {
  if (session.identity) return tx({ en: sanadValue("fullNameEn"), ar: sanadValue("fullNameAr") });
  if (session.expert) return tx(session.expert.name);
  if (session.profile) return tx({ en: session.profile.personal.fullNameEn, ar: session.profile.personal.fullNameAr });
  return session.account?.email ?? "";
};

/** HTML for a "needs an account / backend" placeholder inside a screen. */
export function needsAccount(feature) {
  if (session.backend === "down") {
    return `<p class="note">${t(
      `${feature} is saved in the Bedaya account service (Member 4's Supabase), which isn't configured on this server yet. Add the Supabase URL and publishable key to .env.local and restart.`,
      `${feature} تُحفظ في خدمة حسابات بداية (Supabase الخاص بالعضو 4)، وهي غير مهيأة على هذا الخادم بعد. أضف رابط Supabase والمفتاح العام إلى ملف .env.local ثم أعد التشغيل.`,
    )}</p>`;
  }
  if (!session.account) return `<p class="note">${t("Sign in to your Bedaya account to use this.", "سجّل الدخول إلى حسابك في بداية لاستخدام هذه الميزة.")}</p><div class="toolbar"><button class="primary" data-go="account">${t("Sign in", "تسجيل الدخول")}</button></div>`;
  if (session.role !== "owner") return `<p class="note">${t("This is for business owners. Your account has a different role.", "هذه الميزة لأصحاب المشاريع. لحسابك دور مختلف.")}</p>`;
  return `<p class="note">${t("Finish the onboarding questions first.", "أكمل أسئلة البداية أولاً.")}</p><div class="toolbar"><button class="primary" data-go="${session.identity ? "w1" : "link-sanad"}">${t("Start the questions", "ابدأ الأسئلة")}</button></div>`;
}
