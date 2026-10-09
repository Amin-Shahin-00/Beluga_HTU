// Bedaya website: Member 2's layout (header, sidebar, role switch, language) around screens that call
// the real APIs. Routes are hashes (#roadmap), as in Member 2's prototype.
import { $, $$, displayName, esc, go, lang, loadSession, session, setLang, t, toast, tx } from "./core.js";
import * as onboarding from "./onboarding.js";
import * as owner from "./owner.js";
import * as partners from "./partners.js";
import * as staff from "./staff.js";
import * as tools from "./tools.js";

const ROUTES = {
  entry: onboarding.entry,
  consent: onboarding.consent,
  account: onboarding.account,
  ...onboarding.wizardScreens,
  review: onboarding.review,
  roadmap: owner.roadmap,
  documents: owner.documents,
  ocr: owner.ocr,
  signing: owner.signing,
  signed: owner.signed,
  incubators: partners.incubators,
  applied: partners.applied,
  bank: partners.bank,
  "bank-sent": partners.bankSent,
  funding: partners.funding,
  experts: partners.experts,
  assistant: tools.assistant,
  notifications: tools.notifications,
  appointments: tools.appointments,
  plan: tools.plan,
  compliance: tools.compliance,
  location: tools.location,
  invoicing: tools.invoicing,
  partner: staff.partner,
  application: staff.application,
  admin: staff.admin,
  analytics: staff.analytics,
};
const ENTRY_LAYOUT = new Set(["entry", "consent", "account"]);

// Member 2's navigation and icons.
const OWNER_NAV = [
  ["roadmap", ["Your roadmap", "مسار مشروعك"], "route"],
  ["documents", ["Documents", "المستندات"], "files"],
  ["signing", ["Signatures", "التواقيع"], "signature"],
  ["incubators", ["Incubators", "الحاضنات"], "sprout"],
  ["bank", ["Bank file", "الملف البنكي"], "landmark"],
  ["assistant", ["Assistant", "المساعد"], "message-circle"],
  ["notifications", ["Notifications", "الإشعارات"], "bell"],
  ["appointments", ["Appointments", "المواعيد"], "calendar-days"],
  ["plan", ["Business plan", "خطة العمل"], "notebook-pen"],
  ["compliance", ["Compliance", "الالتزامات"], "calendar-check"],
  ["location", ["Location", "الموقع"], "map-pin"],
  ["funding", ["Funding", "التمويل"], "wallet"],
  ["experts", ["Experts", "الخبراء"], "users"],
  ["invoicing", ["E-invoicing", "الفوترة الإلكترونية"], "receipt"],
];
const PARTNER_NAV = [["partner", ["Applications", "الطلبات"], "inbox"]];
const ADMIN_NAV = [
  ["admin", ["Management", "الإدارة"], "settings"],
  ["analytics", ["Analytics", "التحليلات"], "chart-column"],
];
const ROLE_SCREENS = { partner: ["partner", "application"], admin: ["admin", "analytics"] };
const roleOf = (route) => (ROLE_SCREENS.partner.includes(route) ? "partner" : ROLE_SCREENS.admin.includes(route) ? "admin" : "owner");

function currentRoute() {
  const hash = location.hash.slice(1);
  if (ROUTES[hash]) return hash;
  return session.profile ? "roadmap" : "entry";
}

function header(route) {
  const role = roleOf(route);
  return `<header>
    <a class="brand" href="#${session.profile ? "roadmap" : "entry"}"><img src="/bedaya/logo.png" alt="بداية"><strong>Bedaya</strong><small>${t("Start your business in Jordan", "ابدأ مشروعك في الأردن")}</small></a>
    <div class="head-actions">
      <button class="mobile-menu" id="menu" aria-label="${t("Menu", "القائمة")}"><i data-lucide="menu"></i></button>
      <select class="role" id="role" aria-label="${t("View as", "العرض كـ")}">
        ${[["owner", ["Business owner", "صاحب المشروع"]], ["partner", ["Partner", "الشريك"]], ["admin", ["Admin", "الإدارة"]], ["gov", ["Government office (demo)", "جهة حكومية (تجريبي)"]], ["sanad", ["SANAD (demo)", "سند (تجريبي)"]]]
          .map(([v, l]) => `<option value="${v}" ${role === v ? "selected" : ""}>${tx(l)}</option>`)
          .join("")}
      </select>
      <button id="language">${lang === "ar" ? "English" : "العربية"}</button>
      ${session.account || session.sanad ? `<button id="logout" aria-label="${t("Sign out", "تسجيل الخروج")}"><i data-lucide="log-out"></i></button>` : ""}
    </div></header>
    ${session.backend === "down" ? `<div class="banner">${t("Demo mode: the account service (Member 4's Supabase) isn't configured on this server, so roadmaps and bookings can't be saved. Assistant, documents and signing work.", "وضع تجريبي: خدمة الحسابات (Supabase الخاص بالعضو 4) غير مهيأة على هذا الخادم، لذا لا يمكن حفظ المسارات والمواعيد. المساعد والمستندات والتوقيع تعمل.")}</div>` : ""}`;
}

function sidebar(route) {
  const role = roleOf(route);
  const items = role === "partner" ? PARTNER_NAV : role === "admin" ? ADMIN_NAV : OWNER_NAV;
  const verified = session.sanad ? t("Identity verified by SANAD (demo)", "هوية موثقة من سند (تجريبي)") : t("Not connected to SANAD", "غير متصل بسند");
  return `<aside id="aside"><div class="profile"><b>${esc(displayName() || session.account?.email || t("Guest", "زائر"))}</b><span>${verified}</span>${session.account ? `<span style="display:block">${esc(session.account.email)}</span>` : ""}</div>
    <nav>${items
      .map(([id, label, icon]) => `<a href="#${id}" class="${route === id || (id === "partner" && route === "application") ? "active" : ""}"><span class="nav-icon" aria-hidden="true"><i data-lucide="${icon}"></i></span>${tx(label)}${id === "notifications" ? `<span class="count" id="unread" hidden></span>` : ""}</a>`)
      .join("")}</nav></aside>`;
}

function gate(route) {
  return `<div class="eyebrow">${t("Identity needed", "مطلوب التحقق من الهوية")}</div><h1>${t("Log in with SANAD first", "سجّل الدخول عبر سند أولاً")}</h1>
    <p class="subtitle">${t("Your documents and forms are tied to your verified identity.", "مستنداتك ونماذجك مرتبطة بهويتك الموثقة.")}</p>
    <div class="toolbar"><button class="primary" id="gate-login" data-return="${esc(route)}">${t("Login with SANAD", "تسجيل الدخول عبر سند")}</button></div>`;
}

let rendering = 0;
async function render() {
  const ticket = ++rendering;
  const route = currentRoute();
  const screen = ROUTES[route];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const entryLayout = ENTRY_LAYOUT.has(route);
  const app = $("#app");
  app.innerHTML = `${header(route)}<div class="${entryLayout ? "entry" : "shell"}">${entryLayout ? "" : sidebar(route)}<main id="main"><p class="skeleton">${t("Preparing your workspace…", "جارٍ إعداد مساحة العمل…")}</p></main></div>`;
  bindChrome(route);
  let html;
  try {
    html = screen.guard === "sanad" && !session.sanad ? gate(route) : await screen.render();
  } catch (error) {
    console.error(error);
    html = `<h1>${t("Something went wrong", "حدث خطأ ما")}</h1><p class="error">${esc(error?.message || "")}</p>`;
  }
  if (ticket !== rendering) return; // a newer navigation started
  const main = $("#main");
  main.innerHTML = `${html}<footer>${t("Bedaya hackathon build · SANAD, OCR and signatures are simulated · fees and steps from official Jordanian sources", "نسخة هاكاثون بداية · سند والقراءة الآلية والتواقيع محاكاة · الرسوم والخطوات من مصادر أردنية رسمية")}</footer>`;
  document.title = `${main.querySelector("h1")?.textContent || "Bedaya"} | ${t("Bedaya", "بداية")}`;
  $$("[data-go]", main).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  const gateLogin = $("#gate-login");
  if (gateLogin) gateLogin.onclick = () => (location.href = `/api/sanad/login?return=${encodeURIComponent(`/#${gateLogin.dataset.return}`)}`);
  else screen.mount?.();
  paintIcons();
  updateUnread();
}

function bindChrome(route) {
  $("#language").onclick = () => {
    setLang(lang === "ar" ? "en" : "ar");
    render();
  };
  $("#role").onchange = (e) => {
    const v = e.target.value;
    if (v === "gov") location.href = "/dashboard/government";
    else if (v === "sanad") location.href = "/dashboard/sanad";
    else go({ owner: session.profile ? "roadmap" : "entry", partner: "partner", admin: "admin" }[v]);
  };
  const menu = $("#menu");
  if (menu) menu.onclick = () => $("#aside")?.classList.toggle("open");
  const logout = $("#logout");
  if (logout)
    logout.onclick = async () => {
      await onboarding.signOut();
      toast(t("Signed out.", "تم تسجيل الخروج."));
    };
  $$("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  paintIcons();
}

function paintIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { width: 18, height: 18, "aria-hidden": "true" } });
  else setTimeout(paintIcons, 150);
}

async function updateUnread() {
  const badge = $("#unread");
  if (!badge) return;
  const items = await tools.loadNotifications();
  const unread = items.filter((n) => !n.read).length;
  if ($("#unread") === badge) {
    badge.textContent = String(unread);
    badge.hidden = unread === 0;
  }
}

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});

(async function boot() {
  await loadSession();
  render();
})();
