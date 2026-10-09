// Bedaya website: Member 2's layout (header, sidebar, language) around screens that call the real APIs.
// Routes are hashes (#roadmap). Who you are comes from GET /api/account/me; each role has its own pages.
import { $, $$, displayName, esc, go, homeRoute, lang, loadSession, session, setLang, t, toast, tx } from "./core.js";
import * as onboarding from "./onboarding.js";
import * as owner from "./owner.js";
import * as partners from "./partners.js";
import * as staff from "./staff.js";
import * as tools from "./tools.js";
import * as studio from "./studio.js";
import * as services from "./services.js";
import { floatingChat } from "./chat.js";

const ROUTES = {
  entry: onboarding.entry,
  sanad: onboarding.sanad,
  consent: onboarding.consent,
  account: onboarding.account,
  signup: onboarding.signup,
  "signup-sanad": onboarding.signupSanad,
  "link-sanad": onboarding.linkSanad,
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
  "expert-book": partners.expertBook,
  assistant: tools.assistant,
  notifications: tools.notifications,
  appointments: tools.appointments,
  plan: tools.plan,
  compliance: tools.compliance,
  location: tools.location,
  invoicing: tools.invoicing,
  ...studio.routes,
  ...services.routes,
  partner: staff.partner,
  application: staff.application,
  expert: staff.expert,
  admin: staff.admin,
  analytics: staff.analytics,
};
const ENTRY_LAYOUT = new Set(["entry", "sanad", "consent", "account", "signup", "signup-sanad"]);
// Business-owner pages. Other parties (bank, incubator, expert, admin) are sent back to their own home.
const OWNER_ONLY = new Set(["link-sanad", ...Object.keys(onboarding.wizardScreens), "review", "roadmap", "documents", "ocr", "signing", "signed", "incubators", "applied", "bank", "bank-sent", "experts", "expert-book", "appointments", "notifications", "plan", "compliance", "location", ...Object.keys(studio.routes), ...Object.keys(services.routes)]);

// Member 2's navigation and icons, per kind of account.
const NAV = {
  owner: [], // built from GROUPS below
  bank: [["partner", ["Bank applications", "طلبات البنك"], "landmark"]],
  incubator: [["partner", ["Applications", "الطلبات"], "inbox"]],
  expert: [["expert", ["My availability", "مواعيدي"], "calendar-days"]],
  admin: [
    ["admin", ["Management", "الإدارة"], "settings"],
    ["analytics", ["Analytics", "التحليلات"], "chart-column"],
    ["partner", ["All applications", "كل الطلبات"], "inbox"],
  ],
};
// The owner's pages, combined into a few sections. The menu shows one item per section; inside a
// section, tabs lead to its pages. `also` lists pages reached from inside a section (no tab of their own).
const GROUPS = [
  { id: "roadmap", label: ["Your roadmap", "مسار مشروعك"], icon: "route", tabs: [["roadmap", ["Steps", "الخطوات"]], ["plan", ["Business plan", "خطة العمل"]], ["location", ["Location", "الموقع"]], ["compliance", ["Compliance", "الالتزامات"]]] },
  { id: "documents", label: ["Documents & signing", "المستندات والتواقيع"], icon: "files", tabs: [["documents", ["Documents", "المستندات"]], ["signing", ["Sign forms", "توقيع النماذج"]]], also: ["ocr", "signed"] },
  { id: "incubators", label: ["Funding & support", "التمويل والدعم"], icon: "sprout", tabs: [["incubators", ["Incubators", "الحاضنات"]], ["funding", ["Funding", "التمويل"]], ["bank", ["Bank file", "الملف البنكي"]], ["applied", ["My applications", "طلباتي"]], ["experts", ["Experts", "الخبراء"]], ["appointments", ["Appointments", "المواعيد"]]], also: ["bank-sent", "expert-book"] },
  { id: "studio", label: ["Launch Studio", "استوديو الإطلاق"], icon: "sparkles", tabs: [["studio", ["Overview", "نظرة عامة"]], ["studio-brand", ["Brand kit", "الهوية"]], ["studio-design", ["Designs", "التصاميم"]], ["studio-site", ["Website", "الموقع الإلكتروني"]]] },
  { id: "services", label: ["Business tools", "أدوات الأعمال"], icon: "briefcase", tabs: [["services", ["Overview", "نظرة عامة"]], ["services-hr", ["HR & payroll", "الموارد البشرية"]], ["services-domain", ["Domain & email", "النطاق والبريد"]], ["services-accounting", ["Accounting", "المحاسبة"]], ["invoicing", ["E-invoicing", "الفوترة الإلكترونية"]], ["services-presence", ["Online presence", "الحضور الرقمي"]], ["services-hiring", ["Hiring", "التوظيف"]]] },
  { id: "assistant", label: ["Assistant", "المساعد"], icon: "message-circle", tabs: [] },
  { id: "notifications", label: ["Notifications", "الإشعارات"], icon: "bell", tabs: [] },
];
NAV.owner = GROUPS.map((g) => [g.id, g.label, g.icon]);
const groupOf = (route) => GROUPS.find((g) => g.id === route || g.tabs.some(([id]) => id === route) || (g.also || []).includes(route));
/** Tabs for the section the page belongs to (owner pages only). */
function sectionTabs(route) {
  const g = session.role === "owner" ? groupOf(route) : null;
  if (!g || g.tabs.length < 2) return "";
  const current = g.tabs.find(([id]) => id === route)?.[0] ?? { ocr: "documents", signed: "signing", "bank-sent": "bank", "expert-book": "experts" }[route];
  return `<div class="section-tabs" role="navigation" aria-label="${esc(tx(g.label))}">${g.tabs.map(([id, label]) => `<a href="#${id}" ${id === current ? 'aria-current="page"' : ""}>${tx(label)}</a>`).join("")}</div>`;
}
const ROLE_LABEL = {
  owner: ["Business owner", "صاحب مشروع"],
  bank: ["Bank", "بنك"],
  incubator: ["Incubator", "حاضنة"],
  expert: ["Expert", "خبير"],
  admin: ["Admin", "الإدارة"],
};

// Breadcrumb sections.
const SECTION = {
  documents: ["Documents & signing", "المستندات والتواقيع"], ocr: ["Documents & signing", "المستندات والتواقيع"], signing: ["Documents & signing", "المستندات والتواقيع"], signed: ["Documents & signing", "المستندات والتواقيع"],
  incubators: ["Support & funding", "الدعم والتمويل"], applied: ["Support & funding", "الدعم والتمويل"], funding: ["Support & funding", "الدعم والتمويل"],
  bank: ["Bank file", "الملف البنكي"], "bank-sent": ["Bank file", "الملف البنكي"],
  appointments: ["Appointments", "المواعيد"], experts: ["Experts", "الخبراء"], "expert-book": ["Experts", "الخبراء"],
  assistant: ["Tools", "الأدوات"], notifications: ["Tools", "الأدوات"], plan: ["Tools", "الأدوات"], compliance: ["Tools", "الأدوات"], location: ["Tools", "الأدوات"], invoicing: ["Tools", "الأدوات"],
  partner: ["Partner dashboard", "لوحة الشريك"], application: ["Partner dashboard", "لوحة الشريك"],
  expert: ["Expert dashboard", "لوحة الخبير"], admin: ["Admin", "الإدارة"], analytics: ["Admin", "الإدارة"],
  ...Object.fromEntries(Object.keys(studio.routes).map((k) => [k, ["Launch Studio", "استوديو الإطلاق"]])),
  ...Object.fromEntries(Object.keys(services.routes).map((k) => [k, ["Startup services", "خدمات الانطلاق"]])),
};

function currentRoute() {
  const hash = location.hash.slice(1);
  return ROUTES[hash] ? hash : homeRoute();
}

function header() {
  const role = session.role;
  return `<header>
    <a class="brand" href="#entry" aria-label="${t("Bedaya home page", "الصفحة الرئيسية لبداية")}"><img src="/bedaya/logo.png" alt="بداية"><strong>Bedaya</strong><small>${t("Start your business in Jordan", "ابدأ مشروعك في الأردن")}</small></a>
    <div class="head-actions">
      <button class="mobile-menu" id="menu" aria-label="${t("Menu", "القائمة")}"><i data-lucide="menu"></i></button>
      ${role ? `<span class="status info role-chip">${tx(ROLE_LABEL[role])}</span>` : ""}
      <button id="language">${lang === "ar" ? "English" : "العربية"}</button>
      ${session.account || session.pendingSanad ? `<button id="logout" aria-label="${t("Sign out", "تسجيل الخروج")}" title="${t("Sign out", "تسجيل الخروج")}"><i data-lucide="log-out"></i></button>` : ""}
    </div></header>
    ${session.backend === "down" ? `<div class="banner">${t("Demo mode: the account service (Supabase) isn't configured on this server, so accounts can't sign in. The assistant still works.", "وضع تجريبي: خدمة الحسابات (Supabase) غير مهيأة على هذا الخادم، لذا لا يمكن تسجيل الدخول. المساعد ما زال يعمل.")}</div>` : ""}`;
}

function sidebar(route) {
  const items = NAV[session.role] || [];
  const verified = session.identity ? t("Identity verified by SANAD (demo)", "هوية موثقة من سند (تجريبي)") : session.role === "owner" ? t("SANAD not linked yet", "سند غير مرتبط بعد") : session.expert ? tx(session.expert.title) : "";
  return `<aside id="aside"><div class="profile"><b>${esc(["bank", "incubator", "admin"].includes(session.role) ? `${tx(ROLE_LABEL[session.role])}${session.partnerKey ? ` · ${session.partnerKey}` : ""}` : displayName() || t("Guest", "زائر"))}</b>${verified ? `<span>${esc(verified)}</span>` : ""}${session.account ? `<span style="display:block">${esc(session.account.email ?? "")}</span>` : ""}</div>
    <nav>${items
      .map(([id, label, icon]) => {
        const active =
          route === id ||
          (session.role === "owner" && groupOf(route)?.id === id) ||
          (id === "partner" && route === "application") ||
          (id === "experts" && route === "expert-book") ||
          (id === "bank" && route === "bank-sent");
        return `<a href="#${id}" class="${active ? "active" : ""}"><span class="nav-icon" aria-hidden="true"><i data-lucide="${icon}"></i></span>${tx(label)}${id === "notifications" ? `<span class="count" id="unread" hidden></span>` : ""}</a>`;
      })
      .join("")}
    ${session.role === "admin" ? `<a href="/dashboard/government"><span class="nav-icon" aria-hidden="true"><i data-lucide="building-2"></i></span>${t("Government office (demo)", "جهة حكومية (تجريبي)")}</a><a href="/dashboard/sanad"><span class="nav-icon" aria-hidden="true"><i data-lucide="shield-check"></i></span>${t("SANAD dashboard (demo)", "لوحة سند (تجريبي)")}</a>` : ""}
    </nav></aside>`;
}

function breadcrumb(route, title) {
  const home = homeRoute();
  const crumbs = [`<a href="#entry">${t("Home", "الرئيسية")}</a>`];
  if (session.account && route !== home) crumbs.push(`<a href="#${home}">${t("Main page", "الصفحة الرئيسية لحسابي")}</a>`);
  const group = session.role === "owner" ? groupOf(route) : null;
  const section = group ? (group.id !== route ? group.label : null) : SECTION[route];
  if (section && route !== home) crumbs.push(`<span>${tx(section)}</span>`);
  crumbs.push(`<span aria-current="page">${esc(title)}</span>`);
  const back = session.account && route !== home ? `<button class="back-main" data-go="${home}"><i data-lucide="arrow-left"></i>${t("Back to main page", "العودة للصفحة الرئيسية")}</button>` : "";
  return `<div class="crumbs"><nav aria-label="${t("Breadcrumb", "مسار التنقل")}" class="breadcrumb">${crumbs.join('<span class="sep" aria-hidden="true">›</span>')}</nav>${back}</div>`;
}

/** Page access by the account's real role. Returns HTML to show instead of the screen, or null. */
function gate(screen, route) {
  const need = screen.guard || (OWNER_ONLY.has(route) && session.account ? "owner" : null);
  if (!need) return null;
  if (session.backend === "down") return `<h1>${t("Accounts are unavailable", "الحسابات غير متاحة")}</h1><p class="note">${t("The account service isn't configured on this server yet.", "خدمة الحسابات غير مهيأة على هذا الخادم بعد.")}</p>`;
  if (!session.account)
    return `<div class="eyebrow">${t("Sign in needed", "مطلوب تسجيل الدخول")}</div><h1>${t("Please sign in first", "يرجى تسجيل الدخول أولاً")}</h1>
      <div class="toolbar"><button class="primary" id="gate-sanad" data-return="${esc(route)}">${t("Login with SANAD", "تسجيل الدخول عبر سند")}</button><button data-go="account">${t("Sign in with email", "تسجيل الدخول بالبريد")}</button></div>`;
  const roles = { owner: ["owner"], identity: ["owner"], partner: ["bank", "incubator", "admin"], expert: ["expert"], admin: ["admin"] }[need] || [];
  if (!roles.includes(session.role))
    return `<h1>${t("This page isn't for your account", "هذه الصفحة ليست لحسابك")}</h1><p class="subtitle">${t("You're signed in as", "أنت مسجل الدخول كـ")} ${tx(ROLE_LABEL[session.role])}.</p><div class="toolbar"><button class="primary" data-go="${homeRoute()}">${t("Go to my main page", "الذهاب إلى صفحتي الرئيسية")}</button></div>`;
  return null;
}

let rendering = 0;
async function render() {
  const ticket = ++rendering;
  let route = currentRoute();
  let screen = ROUTES[route];
  // Owners without a linked SANAD identity are sent to link it before identity-based pages.
  if (screen.guard === "identity" && session.role === "owner" && !session.identity) {
    route = "link-sanad";
    screen = ROUTES[route];
  }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const entryLayout = ENTRY_LAYOUT.has(route);
  const app = $("#app");
  app.innerHTML = `${header()}<div class="${entryLayout ? "entry" : "shell"}">${entryLayout ? "" : sidebar(route)}<main id="main"><p class="skeleton">${t("Preparing your workspace…", "جارٍ إعداد مساحة العمل…")}</p></main></div>`;
  bindChrome();
  let html;
  const blocked = gate(screen, route);
  try {
    html = blocked ?? (await screen.render());
  } catch (error) {
    console.error(error);
    html = `<h1>${t("Something went wrong", "حدث خطأ ما")}</h1><p class="error">${esc(error?.message || "")}</p><div class="toolbar"><button data-go="${homeRoute()}">${t("Back to main page", "العودة للصفحة الرئيسية")}</button></div>`;
  }
  if (ticket !== rendering) return; // a newer navigation started
  const main = $("#main");
  main.innerHTML = html;
  const title = main.querySelector("h1")?.textContent?.trim() || "Bedaya";
  if (!entryLayout) main.insertAdjacentHTML("afterbegin", breadcrumb(route, title) + sectionTabs(route));
  main.insertAdjacentHTML("beforeend", `<footer>${t("Bedaya hackathon build · SANAD, OCR and signatures are simulated · fees and steps from official Jordanian sources", "نسخة هاكاثون بداية · سند والقراءة الآلية والتواقيع محاكاة · الرسوم والخطوات من مصادر أردنية رسمية")}</footer>`);
  document.title = `${title} | ${t("Bedaya", "بداية")}`;
  $$("[data-go]", main).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  const gateSanad = $("#gate-sanad");
  if (gateSanad) gateSanad.onclick = () => (location.href = `/api/sanad/login?return=${encodeURIComponent("/#sanad")}`);
  if (!blocked) {
    try {
      await screen.mount?.();
    } catch (error) {
      console.error(error);
      toast(error?.message || t("Something went wrong.", "حدث خطأ ما."));
    }
  }
  floatingChat(route);
  paintIcons();
  updateUnread();
}

function bindChrome() {
  $("#language").onclick = () => {
    setLang(lang === "ar" ? "en" : "ar");
    render();
  };
  const menu = $("#menu");
  if (menu) menu.onclick = () => $("#aside")?.classList.toggle("open");
  const logout = $("#logout");
  if (logout)
    logout.onclick = async () => {
      await onboarding.signOut();
      toast(t("Signed out.", "تم تسجيل الخروج."));
    };
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

// Another tab signed in or out: re-read the session so this tab never shows the previous person.
window.addEventListener("storage", async (e) => {
  if (e.key === "bedaya.accountId") {
    await loadSession();
    render();
  }
});

(async function boot() {
  await loadSession();
  render();
})();
