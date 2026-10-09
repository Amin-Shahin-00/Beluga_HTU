// Entry, SANAD consent, Bedaya account and the onboarding wizard (features 7 and 1).
// SANAD identity comes from M5's mock SANAD; the business is saved in M4's backend.
import { $, $$, api, errorText, esc, go, loadSession, read, sanadValue, save, session, t, toast, tx } from "./core.js";

// ---------- entry ----------
export const entry = {
  layout: "entry",
  async render() {
    const rows = [
      ["01", ["Answer once", "أجب مرة واحدة"], ["A profile that follows your whole journey.", "ملف يرافقك طوال رحلتك."]],
      ["02", ["Know your next step", "اعرف خطوتك التالية"], ["A clear roadmap built from official Jordanian sources.", "مسار واضح مبني على مصادر أردنية رسمية."]],
      ["03", ["Move forward together", "تقدم مع شركائك"], ["Connect with real incubators, funds and banks.", "تواصل مع حاضنات وصناديق وبنوك حقيقية."]],
    ];
    const signedIn = session.sanad;
    return `<div class="eyebrow">${t("Bedaya · start your business in Jordan", "بداية · ابدأ مشروعك في الأردن")}</div>
      <h1>${t("Your business begins here.", "مشروعك يبدأ من هنا.")}</h1>
      <p class="subtitle">${t("Bedaya connects your next step, documents, and opportunities in one workspace.", "بداية تجمع خطواتك ومستنداتك وفرصك في مساحة واحدة.")}</p>
      <div class="toolbar">
        ${signedIn
          ? `<button class="primary" data-go="consent">${t(`Continue as ${sanadValue("fullNameEn")}`, `المتابعة باسم ${sanadValue("fullNameAr")}`)}</button>`
          : `<button class="primary" id="sanad-login">${t("Login with SANAD", "تسجيل الدخول عبر سند")}</button>`}
        <button data-go="account">${t("I already have a Bedaya account", "لدي حساب في بداية")}</button>
        <button data-go="assistant">${t("Ask the assistant first", "اسأل المساعد أولاً")}</button>
      </div>
      <div class="list">${rows
        .map((r) => `<div class="item"><span class="lead">${r[0]}</span><div class="details"><strong>${tx(r[1])}</strong><small>${tx(r[2])}</small></div></div>`)
        .join("")}</div>
      <p class="note">${t("SANAD is simulated in this hackathon build (two fictional people). Fees and steps come from official Jordanian sources.", "سند محاكى في نسخة الهاكاثون (شخصان افتراضيان). الرسوم والخطوات من مصادر أردنية رسمية.")}</p>`;
  },
  mount() {
    const btn = $("#sanad-login");
    if (btn) btn.onclick = () => (location.href = `/api/sanad/login?return=${encodeURIComponent("/#consent")}`);
  },
};

// ---------- consent: what SANAD shares ----------
const SOURCE = { verified_by_sanad: ["Verified by SANAD (demo)", "موثق من سند (تجريبي)"], typed_by_user: ["Entered by you", "أدخلته بنفسك"], read_by_ocr: ["Read from a document", "مقروء من مستند"] };

export const consent = {
  guard: "sanad",
  async render() {
    const u = session.sanad;
    const id = String(u.nationalId || "");
    const rows = [
      [["Name", "الاسم"], tx({ en: u.fullNameEn?.value, ar: u.fullNameAr?.value }), u.fullNameEn?.source],
      [["National ID", "الرقم الوطني"], `••••••${id.slice(-4)}`, "verified_by_sanad"],
      [["Date of birth", "تاريخ الميلاد"], u.birthDate?.value, u.birthDate?.source],
      [["City", "المدينة"], u.city?.value, u.city?.source],
      [["Mobile", "الهاتف"], u.phone?.value, u.phone?.source],
      [["Email", "البريد الإلكتروني"], u.email?.value, u.email?.source],
    ];
    return `<div class="eyebrow">${t("Step 1 · identity", "الخطوة 1 · الهوية")}</div>
      <h1>${t("Connect your identity", "ربط هويتك")}</h1>
      <p class="subtitle">${t("Review what Bedaya will receive before continuing.", "راجع البيانات التي ستستقبلها بداية قبل المتابعة.")}</p>
      <div class="list">${rows
        .map((r) => `<div class="item"><div class="details"><small>${tx(r[0])}</small><strong class="ltr-auto">${esc(r[1])}</strong></div><span class="status">${tx(SOURCE[r[2]] || SOURCE.verified_by_sanad)}</span></div>`)
        .join("")}</div>
      <p class="note">${t("This hackathon uses fictional identity data from a simulated SANAD. No real SANAD connection is active.", "يستخدم هذا العرض بيانات هوية افتراضية من سند محاكى. لا يوجد اتصال فعلي بسند.")}</p>
      <label class="option"><input type="checkbox" id="consent-box">${t("I agree that Bedaya uses this identity data to prepare my business file.", "أوافق على استخدام بداية لبيانات الهوية هذه لتجهيز ملف مشروعي.")}</label>
      <div class="toolbar"><button class="primary" id="consent-next" disabled>${t("Agree and continue", "الموافقة والمتابعة")}</button><button id="switch-person">${t("Use a different person", "استخدام شخص آخر")}</button></div>`;
  },
  mount() {
    $("#consent-box").onchange = (e) => ($("#consent-next").disabled = !e.target.checked);
    $("#consent-next").onclick = async () => {
      save("identityConsent", true);
      if (session.account) await api("/api/platform/consents", { method: "POST", body: { purpose: "mock_identity", granted: true } });
      go(session.profile ? "roadmap" : session.account ? "w1" : "account");
    };
    $("#switch-person").onclick = async () => {
      await api("/api/sanad/me", { method: "POST", body: { action: "logout" } });
      location.href = `/api/sanad/login?return=${encodeURIComponent("/#consent")}`;
    };
  },
};

// ---------- Bedaya account (M4 Supabase auth) ----------
export const account = {
  async render() {
    if (session.account) {
      return `<div class="eyebrow">${t("Your account", "حسابك")}</div><h1>${t("You're signed in", "أنت مسجل الدخول")}</h1>
        <p class="subtitle">${esc(session.account.email)}</p>
        <div class="toolbar"><button class="primary" data-go="${session.profile ? "roadmap" : session.sanad ? "w1" : "entry"}">${t("Continue", "متابعة")}</button><button id="sign-out">${t("Sign out", "تسجيل الخروج")}</button></div>`;
    }
    const down = session.backend === "down";
    return `<div class="wizard"><div class="eyebrow">${t("Step 2 · your Bedaya account", "الخطوة 2 · حسابك في بداية")}</div>
      <h1>${t("Save your progress", "احفظ تقدمك")}</h1>
      <p class="subtitle">${t("Your roadmap, bookings and applications are saved to your Bedaya account.", "يُحفظ مسارك ومواعيدك وطلباتك في حسابك على بداية.")}</p>
      ${down
        ? `<p class="note">${t("The account service (Member 4's Supabase) isn't configured on this server yet, so accounts can't be created. You can still use the assistant, documents and signing.", "خدمة الحسابات (Supabase الخاص بالعضو 4) غير مهيأة على هذا الخادم بعد، لذا لا يمكن إنشاء حسابات. يمكنك استخدام المساعد والمستندات والتوقيع.")}</p>
           <div class="toolbar"><button class="primary" data-go="documents">${t("Continue to documents", "المتابعة إلى المستندات")}</button><button data-go="assistant">${t("Open the assistant", "فتح المساعد")}</button></div>`
        : `<div class="tabs" role="tablist"><button id="tab-in" aria-pressed="true">${t("Sign in", "تسجيل الدخول")}</button><button id="tab-up" aria-pressed="false">${t("Create account", "إنشاء حساب")}</button></div>
           <form id="auth-form" novalidate>
             <label class="field"><span>${t("Email", "البريد الإلكتروني")}</span><input id="email" type="email" autocomplete="email" required value="${esc(read("lastEmail", sanadValue("email")))}"></label>
             <label class="field"><span>${t("Password", "كلمة المرور")}</span><input id="password" type="password" autocomplete="current-password" required minlength="1"></label>
             <p id="auth-error" class="error" role="alert"></p>
             <div class="toolbar"><button class="primary" id="auth-submit">${t("Sign in", "تسجيل الدخول")}</button></div>
           </form>
           <p class="note">${t("New accounts must confirm their email before signing in.", "يجب تأكيد البريد الإلكتروني للحسابات الجديدة قبل تسجيل الدخول.")}</p>`}
    </div>`;
  },
  mount() {
    const out = $("#sign-out");
    if (out) out.onclick = signOut;
    const form = $("#auth-form");
    if (!form) return;
    let mode = "signin";
    const setMode = (m) => {
      mode = m;
      $("#tab-in").setAttribute("aria-pressed", String(m === "signin"));
      $("#tab-up").setAttribute("aria-pressed", String(m === "signup"));
      $("#auth-submit").textContent = m === "signin" ? t("Sign in", "تسجيل الدخول") : t("Create account", "إنشاء حساب");
      $("#password").autocomplete = m === "signin" ? "current-password" : "new-password";
      $("#auth-error").textContent = "";
    };
    $("#tab-in").onclick = (e) => (e.preventDefault(), setMode("signin"));
    $("#tab-up").onclick = (e) => (e.preventDefault(), setMode("signup"));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim();
      const password = $("#password").value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || (mode === "signup" && password.length < 8)) {
        $("#auth-error").textContent = t("Use a valid email. New passwords need at least 8 characters.", "استخدم بريداً صحيحاً. كلمة المرور الجديدة 8 أحرف على الأقل.");
        return;
      }
      $("#auth-submit").disabled = true;
      const res = await api("/api/auth", { method: "POST", body: { action: mode, email, password } });
      $("#auth-submit").disabled = false;
      save("lastEmail", email);
      if (!res.ok) {
        $("#auth-error").textContent = errorText(res);
        return;
      }
      if (mode === "signup") {
        toast(t("Account created. Confirm your email, then sign in.", "تم إنشاء الحساب. أكد بريدك الإلكتروني ثم سجّل الدخول."));
        setMode("signin");
        return;
      }
      await loadSession();
      if (read("identityConsent", false)) await api("/api/platform/consents", { method: "POST", body: { purpose: "mock_identity", granted: true } });
      go(session.profile ? "roadmap" : session.sanad ? "w1" : "entry");
    };
  },
};

export async function signOut() {
  await Promise.all([api("/api/auth", { method: "POST", body: { action: "signout" } }), api("/api/sanad/me", { method: "POST", body: { action: "logout" } })]);
  save("wizard", {});
  save("identityConsent", false);
  await loadSession();
  go("entry");
}

// ---------- the wizard (Member 2's eight questions + one for the plan) ----------
export const ACTIVITIES = [
  { en: "Home bakery or food", ar: "مخبز أو أغذية منزلية", sector: "food" },
  { en: "Retail shop", ar: "متجر تجزئة", sector: "retail" },
  { en: "Online store", ar: "متجر إلكتروني", sector: "retail" },
  { en: "Service company", ar: "شركة خدمات", sector: "services" },
  { en: "Handicrafts", ar: "حرف يدوية", sector: "crafts" },
  { en: "Tech startup", ar: "شركة تقنية ناشئة", sector: "tech" },
];
export const CITIES = [
  { en: "Amman", ar: "عمّان" },
  { en: "Irbid", ar: "إربد" },
  { en: "Zarqa", ar: "الزرقاء" },
  { en: "Aqaba", ar: "العقبة" },
  { en: "Salt", ar: "السلط" },
  { en: "Madaba", ar: "مأدبا" },
];
const PREMISES = [
  { en: "From home", ar: "من المنزل", value: "home" },
  { en: "Rented shop or office", ar: "محل أو مكتب مستأجر", value: "rented" },
  { en: "Owned shop or office", ar: "محل أو مكتب مملوك", value: "owned" },
];
const STAFF = [
  { en: "No employees yet", ar: "لا يوجد موظفون حالياً", value: 0 },
  { en: "One employee", ar: "موظف واحد", value: 1 },
  { en: "Two or more", ar: "اثنان أو أكثر", value: 2 },
];
const SUPPORT = [
  { en: "Business account", ar: "حساب تجاري", value: "bank" },
  { en: "Incubator support", ar: "دعم حاضنة", value: "incubators" },
  { en: "Funding", ar: "تمويل", value: "funding" },
];
const STAGES = [
  { en: "Just an idea", ar: "مجرد فكرة", value: "idea" },
  { en: "I've made samples / a prototype", ar: "صنعت عينات / نموذجاً أولياً", value: "prototype" },
  { en: "Already selling", ar: "أبيع بالفعل", value: "revenue" },
];

const STEPS = [
  { id: "w1", field: "activity", title: ["What would you like to start?", "ما المشروع الذي تريد بدءه؟"], sub: ["Choose the activity closest to your idea.", "اختر النشاط الأقرب لفكرتك."], options: ACTIVITIES },
  { id: "w2", field: "city", title: ["Where will your business be?", "أين سيكون مشروعك؟"], sub: ["Your city helps shape your launch steps.", "تساعد مدينتك في تحديد خطوات الإطلاق."], options: CITIES },
  { id: "w3", field: "premises", title: ["Where will you work?", "من أين ستعمل؟"], sub: ["Home businesses have a dedicated roadmap.", "للمشاريع المنزلية مسار مخصص."], options: PREMISES },
  { id: "w4", field: "name", title: ["What is your business name?", "ما اسم مشروعك؟"], sub: ["You can change this before submission.", "يمكنك تغييره قبل الإرسال."] },
  { id: "w5", field: "partners", title: ["Are you starting with partners?", "هل تبدأ مع شركاء؟"], sub: ["Tell us who will own the business.", "أخبرنا من سيمتلك المشروع."], options: [{ en: "Just me", ar: "أنا فقط", value: 0 }, { en: "With partners", ar: "مع شركاء", value: 1 }] },
  { id: "w6", field: "capital", title: ["What is your starting capital?", "ما رأس المال الأولي؟"], sub: ["Enter an estimate in Jordanian dinars.", "أدخل تقديراً بالدينار الأردني."], input: "number" },
  { id: "w7", field: "staff", title: ["Will anyone work with you?", "هل سيعمل أحد معك؟"], sub: ["We will flag requirements to verify before launch.", "سنوضح المتطلبات التي يجب التحقق منها قبل الإطلاق."], options: STAFF },
  { id: "w8", field: "support", title: ["What support do you need?", "ما الدعم الذي تحتاجه؟"], sub: ["Choose your first priority.", "اختر أولويتك الأولى."], options: SUPPORT },
  { id: "w9", field: "details", title: ["Tell us a little more", "أخبرنا المزيد قليلاً"], sub: ["This goes into your business plan and incubator applications.", "تدخل هذه المعلومات في خطة عملك وطلبات الحاضنات."] },
];
const total = STEPS.length;
const cityKey = (ar) => CITIES.find((c) => c.ar === ar || c.en === ar)?.en;

/** Fills empty answers from the SANAD record and M5's business info, once. */
async function prefill() {
  const a = read("wizard", {});
  if (a.prefilled || !session.sanad) return a;
  const res = await api("/api/profile");
  const p = res.ok ? res.data.profile : null;
  const nextMonth = new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 7);
  const merged = {
    city: cityKey(sanadValue("city")),
    nameEn: p?.businessNameEn?.value,
    nameAr: p?.businessNameAr?.value,
    activity: p ? (String(p.activityCode?.value || "").startsWith("10") ? 0 : p.legalForm?.value === "llc" ? 3 : undefined) : undefined,
    premises: p ? (p.homeBased?.value ? "home" : "rented") : undefined,
    homeTenure: "rented",
    partners: p ? (Number(p.partners?.value) > 0 ? 1 : 0) : undefined,
    partnerCount: p ? Number(p.partners?.value) || 1 : 1,
    capital: p?.capitalJod?.value,
    description: p?.activityEn?.value,
    descriptionAr: p?.activityAr?.value,
    descriptionSource: p?.activityEn?.value,
    launch: nextMonth,
    funding: 0,
    stage: "idea",
    ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== "")),
    prefilled: true,
  };
  save("wizard", merged);
  return merged;
}

function optionList(step, value) {
  return `<div class="options">${step.options
    .map((o, i) => {
      const v = o.value ?? (step.field === "city" ? o.en : i);
      return `<label class="option"><input name="answer" type="radio" value="${esc(v)}" ${String(value) === String(v) ? "checked" : ""}><span>${esc(tx(o))}</span></label>`;
    })
    .join("")}</div>`;
}

function wizardScreen(step, index) {
  return {
    guard: "sanad",
    async render() {
      const a = await prefill();
      let body;
      if (step.field === "name") {
        body = `<label class="field"><span>${t("Business name (English)", "اسم المشروع (بالإنجليزية)")}</span><input id="nameEn" maxlength="120" value="${esc(a.nameEn ?? "")}"></label>
          <label class="field"><span>${t("Business name (Arabic)", "اسم المشروع (بالعربية)")}</span><input id="nameAr" dir="rtl" maxlength="120" value="${esc(a.nameAr ?? "")}"></label>`;
      } else if (step.field === "capital") {
        body = `<label class="field"><span>${t("Starting capital (JOD)", "رأس المال الأولي (دينار)")}</span><input id="answer" type="number" min="1" max="100000000" value="${esc(a.capital ?? "")}"></label>`;
      } else if (step.field === "details") {
        body = `<label class="field"><span>${t("What will you sell or offer?", "ماذا ستبيع أو تقدم؟")}</span><textarea id="description" rows="3" maxlength="500">${esc(a.description ?? "")}</textarea></label>
          <label class="field"><span>${t("Who are your customers?", "من هم عملاؤك؟")}</span><input id="customers" maxlength="300" value="${esc(a.customers ?? "")}"></label>
          <label class="field"><span>${t("Where are you now?", "أين أنت الآن؟")}</span><select id="stage">${STAGES.map((s) => `<option value="${s.value}" ${a.stage === s.value ? "selected" : ""}>${esc(tx(s))}</option>`).join("")}</select></label>
          <div class="grid-2"><label class="field"><span>${t("Planned launch month", "شهر الإطلاق المتوقع")}</span><input id="launch" type="month" value="${esc(a.launch ?? "")}"></label>
          <label class="field"><span>${t("Funding you still need (JOD)", "التمويل الذي ما زلت تحتاجه (دينار)")}</span><input id="funding" type="number" min="0" max="100000000" value="${esc(a.funding ?? 0)}"></label></div>
          <label class="option"><input type="checkbox" id="tradeName" ${a.tradeName ? "checked" : ""}>${t("I want to register a trade name", "أريد تسجيل اسم تجاري")}</label>`;
      } else {
        body = optionList(step, a[step.field]);
        if (step.field === "premises")
          body += `<label class="field" id="tenure-box" ${a.premises === "home" ? "" : "hidden"}><span>${t("The home is", "المنزل")}</span><select id="homeTenure"><option value="rented" ${a.homeTenure !== "owned" ? "selected" : ""}>${t("Rented", "مستأجر")}</option><option value="owned" ${a.homeTenure === "owned" ? "selected" : ""}>${t("Owned", "مملوك")}</option></select></label>`;
        if (step.field === "partners")
          body += `<label class="field" id="partner-box" ${String(a.partners) === "1" ? "" : "hidden"}><span>${t("Number of partners", "عدد الشركاء")}</span><input id="partnerCount" type="number" min="1" max="50" value="${esc(a.partnerCount ?? 1)}"></label>`;
      }
      return `<div class="wizard"><div class="eyebrow">${t(`STEP ${index + 1} OF ${total}`, `الخطوة ${index + 1} من ${total}`)}</div>
        <div class="progress"><span style="width:${((index + 1) / total) * 100}%"></span></div>
        <h1>${tx(step.title)}</h1><p class="subtitle">${tx(step.sub)}</p>${body}
        <p id="validation" class="error" role="alert"></p>
        <div class="toolbar"><button id="back">${t("Back", "رجوع")}</button><button id="next" class="primary">${t("Continue", "متابعة")}</button></div></div>`;
    },
    mount() {
      const a = read("wizard", {});
      $$("[name=answer]").forEach((r) => {
        r.onchange = () => {
          if (step.field === "premises") $("#tenure-box").hidden = r.value !== "home";
          if (step.field === "partners") $("#partner-box").hidden = r.value !== "1";
        };
      });
      $("#back").onclick = () => go(index === 0 ? "consent" : STEPS[index - 1].id);
      $("#next").onclick = () => {
        const fail = (msg) => ($("#validation").textContent = msg || t("Please complete the required field.", "يرجى إكمال الحقل المطلوب."));
        if (step.field === "name") {
          const en = $("#nameEn").value.trim();
          const ar = $("#nameAr").value.trim();
          if (!en && !ar) return fail();
          a.nameEn = en || ar;
          a.nameAr = ar || en;
        } else if (step.field === "capital") {
          const v = Number($("#answer").value);
          if (!$("#answer").value || !(v >= 1 && v <= 1e8)) return fail(t("Enter an amount between 1 and 100,000,000 JOD.", "أدخل مبلغاً بين 1 و100,000,000 دينار."));
          a.capital = v;
        } else if (step.field === "details") {
          const description = $("#description").value.trim();
          const customers = $("#customers").value.trim();
          const funding = Number($("#funding").value || 0);
          if (!description || !customers) return fail();
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test($("#launch").value)) return fail(t("Choose a launch month.", "اختر شهر الإطلاق."));
          if (!(funding >= 0)) return fail();
          Object.assign(a, { description, customers, stage: $("#stage").value, launch: $("#launch").value, funding, tradeName: $("#tradeName").checked });
          if (description !== a.descriptionSource) a.descriptionAr = undefined; // the Arabic text no longer matches
        } else {
          const picked = $("input[name=answer]:checked");
          if (!picked) return fail();
          a[step.field] = step.field === "city" ? picked.value : isNaN(Number(picked.value)) ? picked.value : Number(picked.value);
          if (step.field === "premises") a.homeTenure = $("#homeTenure").value;
          if (step.field === "partners") a.partnerCount = Math.max(1, Number($("#partnerCount").value) || 1);
        }
        save("wizard", a);
        go(STEPS[index + 1]?.id ?? "review");
      };
    },
  };
}
export const wizardScreens = Object.fromEntries(STEPS.map((s, i) => [s.id, wizardScreen(s, i)]));

/** Turns the answers + SANAD identity into the shared M5 UserProfile that M4 validates. */
export function buildProfile(a) {
  const withPartners = Number(a.partners) === 1;
  const home = a.premises === "home";
  const legalForm = withPartners ? "llc" : home ? "home_business" : "sole_proprietorship";
  const gender = sanadValue("gender") === "M" ? "male" : "female";
  const nationalId = /^\d{10}$/.test(String(session.sanad?.nationalId)) ? String(session.sanad.nationalId) : "";
  return {
    language: document.documentElement.lang === "ar" ? "ar" : "en",
    personal: {
      fullNameAr: sanadValue("fullNameAr"),
      fullNameEn: sanadValue("fullNameEn"),
      nationalId,
      birthDate: sanadValue("birthDate"),
      gender,
      phone: sanadValue("phone"),
      email: sanadValue("email") || session.account?.email,
      city: a.city || "Amman",
    },
    business: {
      nameAr: a.nameAr,
      nameEn: a.nameEn,
      sector: ACTIVITIES[Number(a.activity) || 0].sector,
      description: a.description,
      ...(a.descriptionAr ? { descriptionAr: a.descriptionAr } : {}),
      legalForm,
      homeBased: legalForm === "home_business",
      premises: home ? (a.homeTenure === "owned" ? "owned" : "rented") : a.premises === "owned" ? "owned" : "rented",
      stage: a.stage || "idea",
      employeesPlanned: Number(a.staff) || 0,
      wantsTradeName: Boolean(a.tradeName),
      startupCapitalJod: Number(a.capital) || 0,
      fundingNeededJod: Number(a.funding) || 0,
      targetCustomers: a.customers,
      plannedLaunch: a.launch,
    },
  };
}

// ---------- review and submit ----------
export const review = {
  guard: "sanad",
  async render() {
    const a = read("wizard", {});
    const missing = ["activity", "city", "premises", "nameEn", "partners", "capital", "staff", "support", "description"].filter((k) => a[k] === undefined || a[k] === "");
    const row = (stepId, label, value) =>
      `<div class="item"><div class="details"><small>${tx(label)}</small><strong>${esc(value)}</strong></div><button data-go="${stepId}">${t("Review", "مراجعة")}</button></div>`;
    const opt = (list, v) => tx(list.find((o, i) => String(o.value ?? i) === String(v)) || {});
    const withPartners = Number(a.partners) === 1;
    return `<div class="eyebrow">${t("Almost there", "اقتربت")}</div>
      <h1>${t("Ready for your next chapter?", "هل أنت جاهز للخطوة التالية؟")}</h1>
      <p class="subtitle">${t("Review your answers before creating your roadmap.", "راجع إجاباتك قبل إنشاء مسار مشروعك.")}</p>
      <div class="list">
        ${row("w1", ["Business", "النشاط"], opt(ACTIVITIES, a.activity))}
        ${row("w2", ["City", "المدينة"], tx(CITIES.find((c) => c.en === a.city) || { en: a.city, ar: a.city }))}
        ${row("w3", ["Premises", "مكان العمل"], `${opt(PREMISES, a.premises)}${a.premises === "home" ? ` · ${a.homeTenure === "owned" ? t("owned", "مملوك") : t("rented", "مستأجر")}` : ""}`)}
        ${row("w4", ["Name", "الاسم"], tx({ en: a.nameEn, ar: a.nameAr }))}
        ${row("w5", ["Ownership", "الملكية"], withPartners ? t(`With ${a.partnerCount} partner(s) · company (LLC)`, `مع ${a.partnerCount} شريك · شركة ذات مسؤولية محدودة`) : t("Sole owner", "مالك واحد"))}
        ${row("w6", ["Capital", "رأس المال"], `${Number(a.capital || 0).toLocaleString("en")} ${t("JOD", "دينار")}`)}
        ${row("w7", ["Team", "الفريق"], opt(STAFF, a.staff))}
        ${row("w8", ["First priority", "الأولوية"], opt(SUPPORT, a.support))}
        ${row("w9", ["About the business", "عن المشروع"], `${a.description ?? ""} · ${opt(STAGES, a.stage)} · ${a.launch ?? ""}`)}
      </div>
      ${withPartners && a.premises === "home" ? `<p class="note">${t("Businesses with partners register as a company; the home-business track is for sole owners.", "المشاريع مع شركاء تسجل كشركة؛ مسار المشروع المنزلي للمالك الواحد.")}</p>` : ""}
      <p id="submit-error" class="error" role="alert">${missing.length ? t("Some answers are missing. Use Review to complete them.", "بعض الإجابات ناقصة. استخدم مراجعة لإكمالها.") : ""}</p>
      <div class="toolbar"><button class="primary" id="create" ${missing.length ? "disabled" : ""}>${t("Create my roadmap", "إنشاء مسار مشروعي")}</button></div>`;
  },
  mount() {
    const btn = $("#create");
    if (!btn) return;
    btn.onclick = async () => {
      if (!session.account) {
        if (session.backend === "down") {
          $("#submit-error").textContent = t("The account service isn't configured, so the roadmap can't be saved yet.", "خدمة الحسابات غير مهيأة، لذا لا يمكن حفظ المسار بعد.");
          return;
        }
        go("account");
        return;
      }
      btn.disabled = true;
      $("#submit-error").textContent = "";
      const a = read("wizard", {});
      const profile = buildProfile(a);
      // 1. The business row (M4), unless this account already has one waiting for onboarding.
      let business = session.business && !session.profile ? session.business : null;
      if (!business) {
        const created = await api("/api/business", {
          method: "POST",
          body: { name: profile.business.nameEn.slice(0, 120), type: ACTIVITIES[Number(a.activity) || 0].en, city: profile.personal.city },
        });
        if (!created.ok) return fail(created);
        business = created.data.data;
      }
      save("businessId", business.id);
      // 2. The onboarding answers (M4 validates the M5 UserProfile and builds the sourced roadmap).
      const submitted = await api(`/api/platform/businesses/${business.id}/onboarding/submit`, { method: "POST", body: profile });
      if (!submitted.ok && submitted.status !== 409) return fail(submitted);
      // 3. Keep M5's form filler in step with the same names and capital.
      if (session.sanad)
        await api("/api/profile", {
          method: "POST",
          body: { businessNameAr: profile.business.nameAr, businessNameEn: profile.business.nameEn, capitalJod: profile.business.startupCapitalJod, partners: Number(a.partners) === 1 ? Number(a.partnerCount) || 1 : 0 },
        });
      await loadSession();
      toast(t("Your roadmap is ready.", "مسارك جاهز."));
      go("roadmap");
    };
    function fail(res) {
      btn.disabled = false;
      $("#submit-error").textContent = errorText(res);
    }
  },
};
