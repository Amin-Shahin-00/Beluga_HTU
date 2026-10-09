// Startup services (Part E): HR (E1), domain and business email (E2), accounting and invoices (E3),
// online presence (E4) and hiring (E5). Data is saved per business as versioned workspace drafts.
import { $, $$, api, confirmDialog, day, errorText, esc, go, jod, lang, needsAccount, ready, sanadValue, session, t, toast, tx } from "./core.js";
import { activeBrand, canvasesToPdf, downloadBlob, logoImage, pal, slugify, useFonts, wrap } from "./studio.js";

const bid = () => session.business.id;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Amman date
async function load(kind, empty) {
  const res = await api(`/api/workspace/${bid()}/${kind}`);
  if (!res.ok) throw new Error(errorText(res));
  return { ...empty, ...(res.data.latest?.data || {}) };
}
// Autosave: every change is kept as a new version (debounced).
const timers = {};
function autosave(kind, data) {
  const status = $("#save-status");
  if (status) status.textContent = t("Saving…", "جارٍ الحفظ…");
  clearTimeout(timers[kind]);
  timers[kind] = setTimeout(async () => {
    const res = await api(`/api/workspace/${bid()}/${kind}`, { method: "POST", body: { data } });
    const s = $("#save-status");
    if (s) s.textContent = res.ok ? t("All changes saved", "تم حفظ كل التغييرات") : errorText(res);
  }, 600);
}
const copyBtn = (id) => `<button class="inline-copy" data-copy="${id}"><i data-lucide="copy"></i>${t("Copy", "نسخ")}</button>`;
function bindCopy() {
  $$("[data-copy]").forEach(
    (b) =>
      (b.onclick = async () => {
        const el = document.getElementById(b.dataset.copy);
        const text = el.value ?? el.textContent;
        try {
          await navigator.clipboard.writeText(text);
          toast(t("Copied.", "تم النسخ."));
        } catch {
          toast(t("Select the text and copy it.", "حدد النص وانسخه."));
        }
      }),
  );
}
const head = (eyebrow, title, sub) => `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${sub}</p>`;
const errorBlock = (title, e, route) => `<h1>${title}</h1><p class="error" role="alert">${esc(e.message || e)}</p><div class="toolbar"><button data-go="${route}">${t("Try again", "حاول مرة أخرى")}</button></div>`;
const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
const downloadCsv = (rows, name) => downloadBlob(new Blob(["﻿" + csv(rows)], { type: "text/csv;charset=utf-8" }), name);

/** A4 pages (canvas) with the brand header, for contracts and invoices. blocks: { text, size, weight, gap, align } */
async function documentPages(blocks, { title, brand }) {
  const W = 1240;
  const H = 1754;
  const M = 100;
  const p = brand ? pal(brand) : { primary: "#00543f", light: "#ffffff", dark: "#202a28", accent: "#a16e19" };
  const fonts = brand?.fonts || { arabic: "Tahoma", latin: "Arial" };
  if (brand) await useFonts(fonts);
  const logo = brand?.logos?.length ? await logoImage(brand.logos[brand.logoIndex || 0], fonts).catch(() => null) : null;
  const pages = [];
  let ctx;
  let y;
  const newPage = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, W, 150);
    if (logo) ctx.drawImage(logo, M - 20, 20, 110, 110);
    ctx.fillStyle = p.light;
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.font = `700 40px "${fonts.arabic}", Tahoma, sans-serif`;
    ctx.fillText(brand ? `${brand.name.ar} · ${brand.name.en}` : title, W - M, 92);
    pages.push(c);
    y = 230;
  };
  newPage();
  for (const b of blocks) {
    const ar = /[؀-ۿ]/.test(b.text);
    const size = b.size || 26;
    ctx.font = `${b.weight || 400} ${size}px "${ar ? fonts.arabic : fonts.latin}", "${fonts.arabic}", Tahoma, Arial, sans-serif`;
    const lines = wrap(ctx, b.text, W - 2 * M);
    for (const line of lines) {
      if (y > H - 140) newPage();
      ctx.font = `${b.weight || 400} ${size}px "${ar ? fonts.arabic : fonts.latin}", "${fonts.arabic}", Tahoma, Arial, sans-serif`;
      ctx.fillStyle = b.color || p.dark;
      ctx.direction = ar ? "rtl" : "ltr";
      ctx.textAlign = b.align || (ar ? "right" : "left");
      ctx.fillText(line, ctx.textAlign === "right" ? W - M : ctx.textAlign === "center" ? W / 2 : M, y);
      y += size * 1.55;
    }
    y += b.gap ?? size * 0.6;
  }
  pages.forEach((c, i) => {
    const g = c.getContext("2d");
    g.fillStyle = "#777777";
    g.font = "20px Arial";
    g.textAlign = "center";
    g.direction = "ltr";
    g.fillText(`${title} · ${i + 1} / ${pages.length}`, W / 2, H - 50);
  });
  return pages;
}
const pdfFrom = async (blocks, opts, filename) => downloadBlob(await canvasesToPdf(await documentPages(blocks, opts), 595.28, 841.89), filename);

// ================================================================ hub
const CARDS = [
  ["services-hr", "users", ["HR and payroll", "الموارد البشرية والرواتب"], ["Employees, job roles, contracts, leave, payroll and Social Security reminders.", "الموظفون والمسميات والعقود والإجازات والرواتب وتذكيرات الضمان الاجتماعي."], [["Add your employees", "أضف موظفيك"], ["Create contracts from templates", "أنشئ العقود من القوالب"], ["Track leave and run payroll", "تابع الإجازات وجهّز الرواتب"]]],
  ["services-domain", "globe", ["Domain and business email", "النطاق والبريد المهني"], ["Pick a web address, connect it to your site and set up name@yourbusiness email.", "اختر عنواناً لموقعك واربطه وأنشئ بريداً مهنياً باسم مشروعك."], [["Get name ideas", "احصل على أفكار للعنوان"], ["Buy or connect (demo purchase)", "اشترِ أو اربط (شراء تجريبي)"], ["Set up email records", "اضبط سجلات البريد"]]],
  ["services-accounting", "calculator", ["Accounting and invoices", "المحاسبة والفواتير"], ["Track income and expenses and send branded invoices.", "تابع الإيرادات والمصاريف وأرسل فواتير بهويتك."], [["Record money in and out", "سجّل الداخل والخارج"], ["Create a branded invoice", "أنشئ فاتورة بهويتك"], ["See your monthly profit", "اعرف ربحك الشهري"]]],
  ["services-presence", "map-pin", ["Online presence", "الحضور الرقمي"], ["Get found on Google Maps and social media with ready-to-paste texts.", "اظهر على خرائط Google ومنصات التواصل بنصوص جاهزة للنسخ."], [["Generate your texts", "ولّد نصوصك"], ["Create your Google Business Profile", "أنشئ ملفك على Google"], ["Set up Instagram, Facebook and WhatsApp", "جهّز إنستغرام وفيسبوك وواتساب"]]],
  ["services-hiring", "user-plus", ["Hiring", "التوظيف"], ["Write a fair job ad, shortlist CVs and prepare interview questions.", "اكتب إعلان وظيفة عادلاً وفرز السير الذاتية وجهّز أسئلة المقابلة."], [["Describe the role", "صف الوظيفة"], ["Rank the CVs you receive", "رتّب السير الذاتية"], ["Interview with ready questions", "قابل بأسئلة جاهزة"]]],
];
const hub = {
  async render() {
    const title = t("Startup services", "خدمات الانطلاق");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    return `${head(t("Startup services", "خدمات الانطلاق"), t("Run the business side with confidence", "أدر الجانب الإداري بثقة"), t("Practical tools for the first months: each card explains what it is, the steps, and a button to start.", "أدوات عملية للأشهر الأولى: كل بطاقة تشرح الخدمة وخطواتها مع زر للبدء."))}
      <div class="grid-3">${CARDS.map(([route, icon, name, what, steps]) => `<div class="card studio-card"><div class="studio-icon"><i data-lucide="${icon}"></i></div><h2>${tx(name)}</h2><p class="muted">${tx(what)}</p><ol class="service-steps">${steps.map((s) => `<li>${tx(s)}</li>`).join("")}</ol><button class="primary" data-go="${route}">${t("Start", "ابدأ")}</button></div>`).join("")}</div>
      <p class="note">${t("Rules shown here (Labour Law, Social Security rates, minimum wage) are summaries for planning. Check the official sources before you act.", "القواعد هنا (قانون العمل ونسب الضمان والحد الأدنى للأجور) ملخصات للتخطيط. تحقق من المصادر الرسمية قبل التنفيذ.")}</p>`;
  },
};

// ================================================================ E1 HR
// Jordanian rules used here (Labour Law No. 8 of 1996 and the Social Security Law):
const RULES = { sscEmployee: 0.075, sscEmployer: 0.1425, minWage: 290, annualLeave: 14, annualLeaveSenior: 21, sickLeave: 14, probationMonths: 3, weeklyHours: 48 };
const CONTRACT = { full: ["Full-time, open-ended", "دوام كامل، غير محدد المدة"], part: ["Part-time", "دوام جزئي"], fixed: ["Fixed-term", "محدد المدة"] };
const LEAVE = { annual: ["Annual", "سنوية"], sick: ["Sick", "مرضية"], unpaid: ["Unpaid", "بدون راتب"], other: ["Other", "أخرى"] };
const ROLE_TEMPLATES = {
  food: [["Baker", "خباز", "Prepares daily production to recipes and hygiene rules.", "يحضّر الإنتاج اليومي وفق الوصفات وقواعد النظافة."], ["Sales assistant", "مساعد مبيعات", "Serves customers, takes orders and handles cash.", "يخدم الزبائن ويستلم الطلبات ويتعامل مع النقد."]],
  retail: [["Sales assistant", "مساعد مبيعات", "Serves customers, keeps stock tidy and handles cash.", "يخدم الزبائن ويرتب المخزون ويتعامل مع النقد."], ["Delivery driver", "سائق توصيل", "Delivers orders on time and collects payment.", "يوصل الطلبات في وقتها ويحصّل المبالغ."]],
  services: [["Customer coordinator", "منسق خدمة العملاء", "Books jobs, follows up with clients and keeps records.", "يحجز المهام ويتابع العملاء ويحفظ السجلات."], ["Technician", "فني", "Delivers the service on site to our quality standard.", "ينفذ الخدمة في الموقع وفق معايير الجودة."]],
  crafts: [["Craft maker", "حرفي", "Makes products by hand to our designs and quality.", "يصنع المنتجات يدوياً وفق تصاميمنا وجودتنا."], ["Online sales assistant", "مساعد مبيعات إلكترونية", "Answers messages, packs and ships orders.", "يرد على الرسائل ويغلف الطلبات ويشحنها."]],
  tech: [["Software developer", "مطور برمجيات", "Builds and maintains the product.", "يبني المنتج ويطوره."], ["Customer success", "نجاح العملاء", "Onboards and supports customers.", "يساعد العملاء على البدء ويدعمهم."]],
};
// Money is rounded half-up to the fils (2 decimals shown), avoiding floating-point drift (350 × 14.25% = 49.88).
const round2 = (n) => Math.round(n * 100 + 1e-7) / 100;
const yearsOfService = (start) => (Date.now() - new Date(start).getTime()) / (365.25 * 864e5);
function workDays(from, to) {
  let n = 0;
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) if (d.getDay() !== 5) n++; // Friday is the weekly rest day
  return n;
}
let hr = null;
let hrTab = "employees";

function contractBlocks(e, role, brand) {
  const biz = brand?.name || { en: session.business.name, ar: session.business.name };
  const owner = { en: sanadValue("fullNameEn"), ar: sanadValue("fullNameAr") };
  const ar = [
    { text: "عقد عمل", size: 44, weight: 700, align: "center", gap: 30 },
    { text: `الطرف الأول (صاحب العمل): ${biz.ar}، ويمثله ${owner.ar}.`, size: 26 },
    { text: `الطرف الثاني (العامل): ${e.name}${e.nationalId ? `، الرقم الوطني ${e.nationalId}` : ""}.`, size: 26 },
    { text: `المسمى الوظيفي: ${role ? role.titleAr : e.role}. ${role ? role.dutiesAr : ""}`, size: 26 },
    { text: `نوع العقد: ${CONTRACT[e.type][1]}. تاريخ المباشرة: ${e.start}${e.type === "fixed" && e.end ? `، وينتهي في ${e.end}` : ""}.`, size: 26 },
    { text: `فترة التجربة: ${RULES.probationMonths} أشهر كحد أقصى، ويجوز خلالها إنهاء العقد دون إشعار.`, size: 26 },
    { text: `الأجر: ${e.salary} دينار أردني شهرياً، يُدفع في موعد أقصاه اليوم السابع من الشهر التالي.`, size: 26 },
    { text: `ساعات العمل: لا تزيد على ${RULES.weeklyHours} ساعة أسبوعياً، ويوم الجمعة عطلة أسبوعية ما لم يُتفق على غيره.`, size: 26 },
    { text: `الإجازات: إجازة سنوية مدفوعة ${RULES.annualLeave} يوماً (${RULES.annualLeaveSenior} يوماً بعد خمس سنوات لدى صاحب العمل نفسه)، وإجازة مرضية مدفوعة ${RULES.sickLeave} يوماً في السنة بتقرير طبي.`, size: 26 },
    { text: "الضمان الاجتماعي: يلتزم صاحب العمل بتسجيل العامل لدى المؤسسة العامة للضمان الاجتماعي من تاريخ المباشرة واقتطاع الاشتراكات وتوريدها.", size: 26 },
    { text: "إنهاء العقد: يلتزم الطرف الراغب في إنهاء العقد غير محدد المدة بإشعار الطرف الآخر خطياً قبل شهر على الأقل.", size: 26 },
    { text: "يخضع هذا العقد لأحكام قانون العمل الأردني رقم 8 لسنة 1996 وتعديلاته، وما لم يرد فيه نص تطبق أحكام القانون.", size: 26, gap: 50 },
    { text: "توقيع الطرف الأول: ____________________        توقيع الطرف الثاني: ____________________", size: 24, gap: 20 },
    { text: `التاريخ: ${today()}`, size: 24, gap: 40 },
    { text: "مسودة من بداية للمراجعة: ليست استشارة قانونية. راجعها مع مختص قبل التوقيع.", size: 20, color: "#a33" },
  ];
  const en = [
    { text: "Employment contract", size: 44, weight: 700, align: "center", gap: 30 },
    { text: `Employer: ${biz.en}, represented by ${owner.en}.`, size: 26 },
    { text: `Employee: ${e.name}${e.nationalId ? `, national ID ${e.nationalId}` : ""}.`, size: 26 },
    { text: `Job title: ${role ? role.titleEn : e.role}. ${role ? role.dutiesEn : ""}`, size: 26 },
    { text: `Contract type: ${CONTRACT[e.type][0]}. Start date: ${e.start}${e.type === "fixed" && e.end ? `, ending on ${e.end}` : ""}.`, size: 26 },
    { text: `Probation: up to ${RULES.probationMonths} months, during which either party may end the contract without notice.`, size: 26 },
    { text: `Salary: JOD ${e.salary} per month, paid no later than the 7th of the following month.`, size: 26 },
    { text: `Working hours: no more than ${RULES.weeklyHours} hours a week; Friday is the weekly rest day unless agreed otherwise.`, size: 26 },
    { text: `Leave: ${RULES.annualLeave} days of paid annual leave (${RULES.annualLeaveSenior} days after five years with the same employer) and ${RULES.sickLeave} days of paid sick leave a year with a medical report.`, size: 26 },
    { text: "Social Security: the employer registers the employee with the Social Security Corporation from the start date and pays the contributions.", size: 26 },
    { text: "Ending the contract: for an open-ended contract, the party ending it gives at least one month's written notice.", size: 26 },
    { text: "This contract is governed by the Jordanian Labour Law No. 8 of 1996 and its amendments.", size: 26, gap: 50 },
    { text: "Employer signature: ____________________        Employee signature: ____________________", size: 24, gap: 20 },
    { text: `Date: ${today()}`, size: 24, gap: 40 },
    { text: "A Bedaya draft for review, not legal advice. Check it with a professional before signing.", size: 20, color: "#a33" },
  ];
  return lang === "ar" ? [...ar, { text: "", gap: 60 }, ...en] : [...en, { text: "", gap: 60 }, ...ar];
}

const hrScreen = {
  async render() {
    const title = t("HR and payroll", "الموارد البشرية والرواتب");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    try {
      if (hr?.bid !== bid()) hr = { bid: bid(), ...(await load("hr", { employees: [], roles: [], leaves: [] })) };
    } catch (e) {
      return errorBlock(title, e, "services-hr");
    }
    const tabs = [["employees", ["Employees", "الموظفون"]], ["roles", ["Job roles", "المسميات"]], ["contracts", ["Contracts", "العقود"]], ["leave", ["Leave", "الإجازات"]], ["payroll", ["Payroll", "الرواتب"]], ["ssc", ["Social Security", "الضمان الاجتماعي"]]];
    const unregistered = hr.employees.filter((e) => !e.ssc).length;
    return `${head(t("Startup services · HR", "خدمات الانطلاق · الموارد البشرية"), title, t("Everything about your team in one place. Changes save automatically as new versions.", "كل ما يخص فريقك في مكان واحد. تُحفظ التغييرات تلقائياً كنسخ جديدة."))}
      ${unregistered ? `<p class="summary"><span class="status error">${t("Reminder", "تذكير")}</span> ${t(`${unregistered} employee(s) not registered with Social Security yet. Registration is required from the first day of work.`, `${unregistered} موظف غير مسجل في الضمان الاجتماعي بعد. التسجيل مطلوب من أول يوم عمل.`)} <button class="linklike" data-hrtab="ssc">${t("See how", "اعرف الطريقة")}</button></p>` : ""}
      <div class="tabs">${tabs.map(([k, v]) => `<button data-hrtab="${k}" aria-pressed="${hrTab === k}">${tx(v)}</button>`).join("")}<span class="muted" id="save-status" aria-live="polite"></span></div>
      <div id="hr-body">${HR_TABS[hrTab]()}</div>`;
  },
  mount() {
    $$("[data-hrtab]").forEach((b) => (b.onclick = () => ((hrTab = b.dataset.hrtab), go("services-hr"))));
    HR_MOUNT[hrTab]?.();
    bindCopy();
  },
};
const save = () => autosave("hr", { employees: hr.employees, roles: hr.roles, leaves: hr.leaves });
const empName = (id) => hr.employees.find((e) => e.id === id)?.name || "—";

const HR_TABS = {
  employees: () => `
    ${hr.employees.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("Name", "الاسم")}</th><th>${t("Role", "المسمى")}</th><th>${t("Start", "المباشرة")}</th><th>${t("Salary", "الراتب")}</th><th>${t("Contract", "العقد")}</th><th>${t("SSC", "الضمان")}</th><th></th></tr></thead><tbody>${hr.employees
      .map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td>${esc(day(e.start))}</td><td class="ltr">${esc(jod(e.salary))}${e.type === "full" && Number(e.salary) < RULES.minWage ? ` <span class="status error" title="${t("Below the national minimum wage", "أقل من الحد الأدنى للأجور")}">!</span>` : ""}</td><td>${tx(CONTRACT[e.type])}</td><td><label class="option small"><input type="checkbox" data-ssc="${e.id}" ${e.ssc ? "checked" : ""}>${e.ssc ? t("Registered", "مسجل") : t("Not yet", "ليس بعد")}</label></td><td><button data-edit-emp="${e.id}">${t("Edit", "تعديل")}</button> <button data-del-emp="${e.id}">${t("Remove", "حذف")}</button></td></tr>`)
      .join("")}</tbody></table></div>` : `<p class="summary">${t("No employees yet. Add the first person who works with you.", "لا موظفين بعد. أضف أول شخص يعمل معك.")}</p>`}
    <div class="toolbar"><button class="primary" id="add-emp">${t("Add employee", "إضافة موظف")}</button></div>
    <p class="note">${t(`Full-time salaries can't be below the national minimum wage (JOD ${RULES.minWage}/month from 2025).`, `لا يجوز أن يقل راتب الدوام الكامل عن الحد الأدنى للأجور (${RULES.minWage} ديناراً شهرياً منذ 2025).`)}</p>`,
  roles: () => `
    ${hr.roles.length ? `<div class="list">${hr.roles.map((r) => `<div class="item"><div class="details"><strong>${esc(r.titleAr)} · ${esc(r.titleEn)}</strong><small>${esc(tx({ en: r.dutiesEn, ar: r.dutiesAr }))}</small></div><button data-del-role="${r.id}">${t("Remove", "حذف")}</button></div>`).join("")}</div>` : `<p class="summary">${t("No job roles yet. Start from a suggestion or write your own.", "لا مسميات بعد. ابدأ من اقتراح أو اكتب مسماك.")}</p>`}
    <h3>${t("Suggestions for your activity", "اقتراحات لنشاطك")}</h3>
    <div class="chips">${(ROLE_TEMPLATES[session.profile.business.sector] || ROLE_TEMPLATES.services).map((r, i) => `<button data-role-tpl="${i}">+ ${esc(tx({ en: r[0], ar: r[1] }))}</button>`).join("")}</div>
    <div class="card"><h3>${t("New role", "مسمى جديد")}</h3><div class="grid-2">
      <label class="field"><span>${t("Title (Arabic)", "المسمى (عربي)")}</span><input id="r-tar" dir="rtl" maxlength="80"></label>
      <label class="field"><span>${t("Title (English)", "المسمى (إنجليزي)")}</span><input id="r-ten" dir="ltr" maxlength="80"></label>
      <label class="field"><span>${t("Duties (Arabic)", "المهام (عربي)")}</span><textarea id="r-dar" dir="rtl" rows="2" maxlength="400"></textarea></label>
      <label class="field"><span>${t("Duties (English)", "المهام (إنجليزي)")}</span><textarea id="r-den" dir="ltr" rows="2" maxlength="400"></textarea></label></div>
      <div class="toolbar tight"><button class="primary" id="add-role">${t("Add role", "إضافة المسمى")}</button></div></div>`,
  contracts: () =>
    hr.employees.length
      ? `<p class="muted">${t("Each contract follows the Jordanian Labour Law basics and comes in Arabic and English. Download, review and sign on paper.", "يتبع كل عقد أساسيات قانون العمل الأردني ويأتي بالعربية والإنجليزية. نزّله وراجعه ووقّعه ورقياً.")}</p>
        <div class="list">${hr.employees.map((e) => `<div class="item"><div class="details"><strong>${esc(e.name)}</strong><small>${esc(e.role)} · ${tx(CONTRACT[e.type])} · ${esc(jod(e.salary))}</small></div><button class="primary" data-contract="${e.id}">${t("Download contract (PDF)", "تنزيل العقد (PDF)")}</button></div>`).join("")}</div>
        <p class="note">${t("Templates for review, not legal advice. Fixed-term contracts need an end date.", "قوالب للمراجعة وليست استشارة قانونية. العقود محددة المدة تحتاج تاريخ انتهاء.")}</p>`
      : `<p class="summary">${t("Add an employee first; the contract is filled from their details.", "أضف موظفاً أولاً؛ يُعبأ العقد من بياناته.")}</p><div class="toolbar"><button data-hrtab="employees">${t("Go to employees", "الذهاب إلى الموظفين")}</button></div>`,
  leave: () => {
    const year = today().slice(0, 4);
    return hr.employees.length
      ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("Employee", "الموظف")}</th><th>${t("Annual entitlement", "الاستحقاق السنوي")}</th><th>${t(`Annual used (${year})`, `السنوية المستخدمة (${year})`)}</th><th>${t("Annual left", "المتبقي")}</th><th>${t("Sick used", "المرضية المستخدمة")}</th></tr></thead><tbody>${hr.employees
          .map((e) => {
            const ent = yearsOfService(e.start) >= 5 ? RULES.annualLeaveSenior : RULES.annualLeave;
            const mine = hr.leaves.filter((l) => l.empId === e.id && l.from.startsWith(year));
            const used = mine.filter((l) => l.type === "annual").reduce((n, l) => n + l.days, 0);
            const sick = mine.filter((l) => l.type === "sick").reduce((n, l) => n + l.days, 0);
            return `<tr><td>${esc(e.name)}</td><td>${ent}</td><td>${used}</td><td><span class="status ${ent - used < 0 ? "error" : ent - used <= 3 ? "warning" : "done"}">${ent - used}</span></td><td>${sick} / ${RULES.sickLeave}</td></tr>`;
          })
          .join("")}</tbody></table></div>
        <div class="card"><h3>${t("Record leave", "تسجيل إجازة")}</h3><div class="grid-2">
          <label class="field"><span>${t("Employee", "الموظف")}</span><select id="l-emp">${hr.employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("")}</select></label>
          <label class="field"><span>${t("Type", "النوع")}</span><select id="l-type">${Object.entries(LEAVE).map(([k, v]) => `<option value="${k}">${tx(v)}</option>`).join("")}</select></label>
          <label class="field"><span>${t("From", "من")}</span><input type="date" id="l-from" value="${today()}"></label>
          <label class="field"><span>${t("To", "إلى")}</span><input type="date" id="l-to" value="${today()}"></label>
          <label class="field"><span>${t("Note", "ملاحظة")}</span><input id="l-note" maxlength="200"></label></div>
          <p class="muted">${t("Days are counted without Fridays (the weekly rest day).", "تُحسب الأيام دون أيام الجمعة (العطلة الأسبوعية).")}</p>
          <div class="toolbar tight"><button class="primary" id="add-leave">${t("Save leave", "حفظ الإجازة")}</button></div></div>
        ${hr.leaves.length ? `<h3>${t("Leave history", "سجل الإجازات")}</h3><div class="list">${[...hr.leaves].reverse().map((l) => `<div class="item"><span class="lead">${l.days}</span><div class="details"><strong>${esc(empName(l.empId))} · ${tx(LEAVE[l.type])}</strong><small>${esc(day(l.from))} → ${esc(day(l.to))}${l.note ? ` · ${esc(l.note)}` : ""}</small></div><button data-del-leave="${l.id}">${t("Remove", "حذف")}</button></div>`).join("")}</div>` : ""}`
      : `<p class="summary">${t("Add employees first.", "أضف الموظفين أولاً.")}</p>`;
  },
  payroll: () => {
    const month = hr.month || today().slice(0, 7);
    const end = `${month}-31`;
    const active = hr.employees.filter((e) => e.start <= end && (!e.end || e.end >= `${month}-01`));
    const rows = active.map((e) => {
      const g = Number(e.salary) || 0;
      return { e, g, ee: round2(g * RULES.sscEmployee), er: round2(g * RULES.sscEmployer) };
    });
    const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
    const f = (n) => n.toFixed(2);
    hr.payrollRows = rows;
    return `<label class="field compact"><span>${t("Month", "الشهر")}</span><input type="month" id="pay-month" value="${month}"></label>
      ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("Employee", "الموظف")}</th><th>${t("Gross", "الإجمالي")}</th><th>${t("SSC employee 7.5%", "ضمان العامل 7.5%")}</th><th>${t("Net pay*", "الصافي*")}</th><th>${t("SSC employer 14.25%", "ضمان صاحب العمل 14.25%")}</th><th>${t("Cost to you", "الكلفة عليك")}</th></tr></thead><tbody>${rows
        .map((r) => `<tr><td>${esc(r.e.name)}${r.e.ssc ? "" : ` <span class="status error">${t("not in SSC", "غير مسجل")}</span>`}</td><td class="ltr">${f(r.g)}</td><td class="ltr">${f(r.ee)}</td><td class="ltr"><strong>${f(r.g - r.ee)}</strong></td><td class="ltr">${f(r.er)}</td><td class="ltr">${f(r.g + r.er)}</td></tr>`)
        .join("")}<tr><th>${t("Total (JOD)", "المجموع (دينار)")}</th><th class="ltr">${f(sum("g"))}</th><th class="ltr">${f(sum("ee"))}</th><th class="ltr">${f(sum("g") - sum("ee"))}</th><th class="ltr">${f(sum("er"))}</th><th class="ltr">${f(sum("g") + sum("er"))}</th></tr></tbody></table></div>
        <p class="summary">${t(`Pay Social Security JOD ${f(sum("ee") + sum("er"))} for ${month} (21.75% of salaries), usually by the 15th of the following month.`, `ادفع للضمان الاجتماعي ${f(sum("ee") + sum("er"))} ديناراً عن ${month} (21.75% من الرواتب)، عادةً قبل اليوم الخامس عشر من الشهر التالي.`)}</p>
        <div class="toolbar"><button id="pay-csv">${t("Download payroll (CSV)", "تنزيل كشف الرواتب (CSV)")}</button></div>
        <p class="note">${t("*Net before income tax. Most small salaries are below the income-tax exemption, but check withholding with the Income and Sales Tax Department (istd.gov.jo). Rates: SSC 7.5% employee + 14.25% employer.", "*الصافي قبل ضريبة الدخل. معظم الرواتب الصغيرة ضمن الإعفاء، لكن تحقق من الاقتطاع مع دائرة ضريبة الدخل والمبيعات (istd.gov.jo). النسب: ضمان 7.5% على العامل و14.25% على صاحب العمل.")}</p>`
      : `<p class="summary">${t("No employees on payroll for this month.", "لا موظفين على الرواتب لهذا الشهر.")}</p>`}`;
  },
  ssc: () => {
    const missing = hr.employees.filter((e) => !e.ssc);
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 15);
    return `<div class="list">${
      missing.length
        ? missing.map((e) => `<div class="item"><span class="status error">${t("Register", "سجّل")}</span><div class="details"><strong>${esc(e.name)}</strong><small>${t(`Working since ${day(e.start)}: register with Social Security from the first day.`, `يعمل منذ ${day(e.start)}: يجب التسجيل في الضمان من أول يوم.`)}</small></div><button data-ssc-done="${e.id}">${t("Mark registered", "تم التسجيل")}</button></div>`).join("")
        : `<div class="item"><span class="status done">✓</span><div class="details"><strong>${t("Everyone is registered", "الجميع مسجلون")}</strong></div></div>`
    }
      <div class="item"><span class="lead">${esc(day(next.toISOString().slice(0, 10)))}</span><div class="details"><strong>${t("Next monthly contribution", "الاشتراك الشهري القادم")}</strong><small>${t("Pay this month's contributions through the SSC e-services.", "ادفع اشتراكات هذا الشهر عبر الخدمات الإلكترونية للضمان.")}</small></div></div></div>
      <h3>${t("How to register an employee", "كيف تسجل موظفاً")}</h3>
      <ol class="service-steps"><li>${t("Register your business as an employer with the Social Security Corporation (once).", "سجّل منشأتك كصاحب عمل لدى المؤسسة العامة للضمان الاجتماعي (مرة واحدة).")}</li><li>${t("Add the employee on the SSC e-services portal with their national ID, start date and salary.", "أضف الموظف عبر بوابة الخدمات الإلكترونية للضمان برقمه الوطني وتاريخ مباشرته وراتبه.")}</li><li>${t("Deduct 7.5% from the salary, add your 14.25%, and pay the total monthly.", "اقتطع 7.5% من الراتب وأضف 14.25% على حسابك وادفع المجموع شهرياً.")}</li></ol>
      <p><a href="https://www.ssc.gov.jo" target="_blank" rel="noopener noreferrer">ssc.gov.jo</a></p>`;
  },
};

async function employeeDialog(e) {
  const roles = hr.roles;
  const res = await confirmDialog({
    title: e ? t("Edit employee", "تعديل موظف") : t("Add employee", "إضافة موظف"),
    html: `<div class="grid-2">
      <label class="field"><span>${t("Full name", "الاسم الكامل")}</span><input id="e-name" value="${esc(e?.name || "")}" maxlength="120"></label>
      <label class="field"><span>${t("National ID (optional)", "الرقم الوطني (اختياري)")}</span><input id="e-nid" inputmode="numeric" maxlength="10" value="${esc(e?.nationalId || "")}"></label>
      <label class="field"><span>${t("Job role", "المسمى")}</span><input id="e-role" list="e-roles" value="${esc(e?.role || "")}" maxlength="80"><datalist id="e-roles">${roles.map((r) => `<option value="${esc(tx({ en: r.titleEn, ar: r.titleAr }))}">`).join("")}</datalist></label>
      <label class="field"><span>${t("Phone", "الهاتف")}</span><input id="e-phone" value="${esc(e?.phone || "")}" maxlength="20"></label>
      <label class="field"><span>${t("Start date", "تاريخ المباشرة")}</span><input type="date" id="e-start" value="${esc(e?.start || today())}"></label>
      <label class="field"><span>${t("Monthly salary (JOD)", "الراتب الشهري (دينار)")}</span><input type="number" id="e-salary" min="0" step="1" value="${esc(e?.salary ?? RULES.minWage)}"></label>
      <label class="field"><span>${t("Contract", "العقد")}</span><select id="e-type">${Object.entries(CONTRACT).map(([k, v]) => `<option value="${k}" ${e?.type === k ? "selected" : ""}>${tx(v)}</option>`).join("")}</select></label>
      <label class="field"><span>${t("End date (fixed-term)", "تاريخ الانتهاء (محدد المدة)")}</span><input type="date" id="e-end" value="${esc(e?.end || "")}"></label></div>`,
    confirmLabel: t("Save", "حفظ"),
  });
  if (!res.confirmed) return null;
  const v = { name: $("#e-name").value.trim(), nationalId: $("#e-nid").value.replace(/\D/g, ""), role: $("#e-role").value.trim(), phone: $("#e-phone").value.trim(), start: $("#e-start").value, salary: Number($("#e-salary").value) || 0, type: $("#e-type").value, end: $("#e-end").value };
  if (!v.name || !v.start) return (toast(t("Name and start date are required.", "الاسم وتاريخ المباشرة مطلوبان.")), null);
  if (v.type === "full" && v.salary < RULES.minWage) toast(t(`Warning: below the minimum wage (JOD ${RULES.minWage}).`, `تنبيه: أقل من الحد الأدنى للأجور (${RULES.minWage} ديناراً).`));
  return v;
}
const HR_MOUNT = {
  employees() {
    $("#add-emp").onclick = async () => {
      const v = await employeeDialog(null);
      if (!v) return;
      hr.employees.push({ id: uid(), ssc: false, ...v });
      save();
      go("services-hr");
    };
    $$("[data-edit-emp]").forEach(
      (b) =>
        (b.onclick = async () => {
          const e = hr.employees.find((x) => x.id === b.dataset.editEmp);
          const v = await employeeDialog(e);
          if (!v) return;
          Object.assign(e, v);
          save();
          go("services-hr");
        }),
    );
    $$("[data-del-emp]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await confirmDialog({ title: t("Remove this employee?", "حذف هذا الموظف؟"), body: t("Their leave records are removed too. Earlier versions are kept.", "تُحذف سجلات إجازاته أيضاً. تبقى النسخ السابقة محفوظة."), confirmLabel: t("Remove", "حذف") });
          if (!ok.confirmed) return;
          hr.employees = hr.employees.filter((e) => e.id !== b.dataset.delEmp);
          hr.leaves = hr.leaves.filter((l) => l.empId !== b.dataset.delEmp);
          save();
          go("services-hr");
        }),
    );
    $$("[data-ssc]").forEach((c) => (c.onchange = () => ((hr.employees.find((e) => e.id === c.dataset.ssc).ssc = c.checked), save(), go("services-hr"))));
  },
  roles() {
    const add = (r) => (hr.roles.push({ id: uid(), ...r }), save(), go("services-hr"));
    $$("[data-role-tpl]").forEach((b) => {
      const r = (ROLE_TEMPLATES[session.profile.business.sector] || ROLE_TEMPLATES.services)[Number(b.dataset.roleTpl)];
      b.onclick = () => add({ titleEn: r[0], titleAr: r[1], dutiesEn: r[2], dutiesAr: r[3] });
    });
    $("#add-role").onclick = () => {
      const r = { titleAr: $("#r-tar").value.trim(), titleEn: $("#r-ten").value.trim(), dutiesAr: $("#r-dar").value.trim(), dutiesEn: $("#r-den").value.trim() };
      if (!r.titleAr && !r.titleEn) return toast(t("Write the role title.", "اكتب المسمى."));
      add(r);
    };
    $$("[data-del-role]").forEach((b) => (b.onclick = () => ((hr.roles = hr.roles.filter((r) => r.id !== b.dataset.delRole)), save(), go("services-hr"))));
  },
  contracts() {
    $$("[data-contract]").forEach(
      (b) =>
        (b.onclick = async () => {
          const e = hr.employees.find((x) => x.id === b.dataset.contract);
          if (e.type === "fixed" && !e.end) return toast(t("Add an end date for a fixed-term contract.", "أضف تاريخ انتهاء للعقد محدد المدة."));
          b.disabled = true;
          try {
            const brand = await activeBrand().catch(() => null);
            const role = hr.roles.find((r) => r.titleEn === e.role || r.titleAr === e.role);
            await pdfFrom(contractBlocks(e, role, brand), { title: t("Employment contract", "عقد عمل"), brand }, `contract-${slugify(e.name) || "employee"}.pdf`);
          } catch {
            toast(t("The contract couldn't be prepared.", "تعذر تجهيز العقد."));
          } finally {
            b.disabled = false;
          }
        }),
    );
  },
  leave() {
    const add = $("#add-leave");
    if (add)
      add.onclick = () => {
        const from = $("#l-from").value;
        const to = $("#l-to").value;
        if (!from || !to || to < from) return toast(t("Check the dates.", "تحقق من التواريخ."));
        hr.leaves.push({ id: uid(), empId: $("#l-emp").value, type: $("#l-type").value, from, to, days: workDays(from, to), note: $("#l-note").value.trim() });
        save();
        go("services-hr");
      };
    $$("[data-del-leave]").forEach((b) => (b.onclick = () => ((hr.leaves = hr.leaves.filter((l) => l.id !== b.dataset.delLeave)), save(), go("services-hr"))));
  },
  payroll() {
    $("#pay-month").onchange = (e) => ((hr.month = e.target.value), go("services-hr"));
    const btn = $("#pay-csv");
    if (btn)
      btn.onclick = () =>
        downloadCsv(
          [["Employee", "Gross JOD", "SSC employee 7.5%", "Net before income tax", "SSC employer 14.25%", "Employer cost"], ...hr.payrollRows.map((r) => [r.e.name, r.g.toFixed(2), r.ee.toFixed(2), (r.g - r.ee).toFixed(2), r.er.toFixed(2), (r.g + r.er).toFixed(2)])],
          `payroll-${hr.month || today().slice(0, 7)}.csv`,
        );
  },
  ssc() {
    $$("[data-ssc-done]").forEach((b) => (b.onclick = () => ((hr.employees.find((e) => e.id === b.dataset.sscDone).ssc = true), save(), go("services-hr"))));
  },
};

// ================================================================ E2 domain and business email
const PROVIDERS = {
  google: {
    name: "Google Workspace",
    steps: [["Sign up at workspace.google.com with your domain.", "سجّل في workspace.google.com باستخدام نطاقك."], ["Verify the domain: add the TXT record Google gives you.", "تحقق من النطاق بإضافة سجل TXT الذي تعطيك إياه Google."], ["Add the MX and SPF records below, then turn on DKIM in the admin console and add its TXT record.", "أضف سجلات MX وSPF أدناه، ثم فعّل DKIM من لوحة الإدارة وأضف سجل TXT الخاص به."], ["Create mailboxes such as info@ and orders@.", "أنشئ صناديق بريد مثل info@ وorders@."]],
    records: (d) => [["MX", "@", "smtp.google.com", "1"], ["TXT", "@", "v=spf1 include:_spf.google.com ~all", ""], ["TXT", "google._domainkey", t("(copy from Google admin › Gmail › Authenticate email)", "(انسخه من لوحة Google › Gmail › مصادقة البريد)"), ""], ["TXT", "_dmarc", `v=DMARC1; p=none; rua=mailto:dmarc@${d}`, ""]],
  },
  microsoft: {
    name: "Microsoft 365",
    steps: [["Buy a Microsoft 365 Business plan and add your domain in the admin centre.", "اشترِ خطة Microsoft 365 للأعمال وأضف نطاقك في مركز الإدارة."], ["Verify with the TXT record Microsoft shows you.", "تحقق بسجل TXT الذي تعرضه Microsoft."], ["Add the MX, SPF and Autodiscover records below; enable DKIM in Defender.", "أضف سجلات MX وSPF وAutodiscover أدناه؛ وفعّل DKIM من Defender."], ["Create users and shared mailboxes.", "أنشئ المستخدمين وصناديق البريد المشتركة."]],
    records: (d) => [["MX", "@", `${d.replace(/\./g, "-")}.mail.protection.outlook.com`, "0"], ["TXT", "@", "v=spf1 include:spf.protection.outlook.com -all", ""], ["CNAME", "autodiscover", "autodiscover.outlook.com", ""], ["TXT", "_dmarc", `v=DMARC1; p=none; rua=mailto:dmarc@${d}`, ""]],
  },
  zoho: {
    name: "Zoho Mail",
    steps: [["Sign up at zoho.com/mail (there is a free plan for small teams).", "سجّل في zoho.com/mail (توجد خطة مجانية للفرق الصغيرة)."], ["Verify the domain with the TXT or CNAME record Zoho gives you.", "تحقق من النطاق بسجل TXT أو CNAME الذي تعطيك إياه Zoho."], ["Add the MX and SPF records below, and the DKIM record from Zoho's mail admin.", "أضف سجلات MX وSPF أدناه وسجل DKIM من لوحة Zoho."], ["Create your mailboxes.", "أنشئ صناديق البريد."]],
    records: (d) => [["MX", "@", "mx.zoho.com", "10"], ["MX", "@", "mx2.zoho.com", "20"], ["MX", "@", "mx3.zoho.com", "50"], ["TXT", "@", "v=spf1 include:zohomail.com ~all", ""], ["TXT", "_dmarc", `v=DMARC1; p=none; rua=mailto:dmarc@${d}`, ""]],
  },
};
const TLDS = [
  [".jo", 25, ["Jordan's country domain; needs proof of a Jordanian business or trademark.", "النطاق الوطني للأردن؛ يحتاج إثبات منشأة أو علامة أردنية."]],
  [".com.jo", 20, ["For registered Jordanian companies; needs your registration certificate.", "للشركات الأردنية المسجلة؛ يحتاج شهادة التسجيل."]],
  [".com", 12, ["The most familiar worldwide.", "الأكثر شهرة عالمياً."]],
  [".shop", 8, ["Clear for online stores.", "واضح للمتاجر الإلكترونية."]],
  [".store", 9, ["Another good store ending.", "خيار جيد آخر للمتاجر."]],
];
const hashStr = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11);
let dom = null;
const domainScreen = {
  async render() {
    const title = t("Domain and business email", "النطاق والبريد المهني");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    try {
      if (dom?.bid !== bid()) {
        const brand = await activeBrand().catch(() => null);
        dom = { bid: bid(), brand, ...(await load("domain", { domain: "", purchased: null, provider: "google", done: {}, connected: false })) };
      }
    } catch (e) {
      return errorBlock(title, e, "services-domain");
    }
    const base = slugify(dom.brand?.name?.en || session.profile.business.nameEn || session.business.name) || "mybusiness";
    const city = slugify(session.profile.personal.city || "amman");
    const names = [...new Set([base, base.replace(/-/g, ""), `${base}-jo`, `get-${base}`, `${base}-${city}`])].slice(0, 4);
    const ideas = names.flatMap((n, i) => TLDS.filter((_, j) => i === 0 || j >= 2).map(([tld, price, note]) => ({ domain: `${n}${tld}`, price, note, free: hashStr(`${n}${tld}`) % 4 !== 0 }))).slice(0, 12);
    const d = dom.domain;
    const prov = PROVIDERS[dom.provider];
    const step = (k, label) => `<label class="option small"><input type="checkbox" data-done="${k}" ${dom.done[k] ? "checked" : ""}>${label}</label>`;
    return `${head(t("Startup services · Domain", "خدمات الانطلاق · النطاق"), title, t("A web address and email with your business name look professional and are easy to remember.", "عنوان موقع وبريد باسم مشروعك يبدوان احترافيين ويسهل تذكرهما."))}
      <span class="muted" id="save-status" aria-live="polite"></span>
      <section class="studio-sec"><h2>1. ${t("Choose a domain", "اختر النطاق")}</h2>
        ${d ? `<p class="summary"><span class="status done">${dom.purchased ? t("Bought (demo)", "تم الشراء (تجريبي)") : t("Chosen", "مختار")}</span> <strong class="ltr">${esc(d)}</strong> <button class="linklike" id="change-domain">${t("Change", "تغيير")}</button></p>` : ""}
        <div class="list">${ideas
          .map((i) => `<div class="item"><div class="details"><strong class="ltr-text">${esc(i.domain)}</strong><small>${tx(i.note)}</small></div><span class="status ${i.free ? "done" : "error"}">${i.free ? t("Available (demo check)", "متاح (فحص تجريبي)") : t("Taken", "محجوز")}</span><span class="ltr">~${i.price} ${t("JOD/yr", "دينار/سنة")}</span>${i.free ? `<button data-pick="${esc(i.domain)}" ${d === i.domain ? "disabled" : ""}>${t("Choose", "اختيار")}</button>` : ""}</div>`)
          .join("")}</div>
        <div class="grid-2"><label class="field"><span>${t("Or type a domain you already own", "أو اكتب نطاقاً تملكه")}</span><input id="own-domain" class="ltr" placeholder="example.jo"></label><div class="toolbar"><button id="use-own">${t("Use this domain", "استخدم هذا النطاق")}</button></div></div>
        <p class="note">${t("Availability and prices here are a demo, not a live registry check. .jo and .com.jo domains are sold by accredited Jordanian registrars (see dns.jo).", "التوفر والأسعار هنا تجريبية وليست فحصاً حياً للسجل. تُباع نطاقات .jo و.com.jo عبر مسجلين أردنيين معتمدين (انظر dns.jo).")}</p></section>
      ${
        d
          ? `<section class="studio-sec"><h2>2. ${t("Buy or connect", "اشترِ أو اربط")}</h2>
        ${dom.purchased ? `<p><span class="status done">${t("Purchase recorded (demo)", "تم تسجيل الشراء (تجريبي)")}</span> ${esc(day(dom.purchased))}</p>` : `<div class="toolbar"><button class="primary" id="buy">${t(`Buy ${d} (demo)`, `شراء ${d} (تجريبي)`)}</button></div>`}
        <ol class="service-steps"><li>${step("buy", t("Buy the domain from a registrar (for .jo, an accredited Jordanian registrar).", "اشترِ النطاق من مسجل (لـ .jo مسجل أردني معتمد)."))}</li>
          <li>${step("dns", t("Open the registrar's DNS settings.", "افتح إعدادات DNS لدى المسجل."))}</li>
          <li>${step("site", t("Point the website to your Bedaya site: add the record below.", "وجّه الموقع إلى موقعك على بداية: أضف السجل أدناه."))}</li></ol>
        <div class="table-wrap"><table class="data dns"><thead><tr><th>${t("Type", "النوع")}</th><th>${t("Name", "الاسم")}</th><th>${t("Value", "القيمة")}</th></tr></thead><tbody><tr><td>CNAME</td><td>www</td><td id="cname-site">${esc(`sites.bedaya.example`)}</td></tr></tbody></table></div>
        <p class="muted">${t("Demo: in production this value is Bedaya's site host. Publish your website from the Launch Studio first.", "تجريبي: في النسخة الحقيقية تكون هذه القيمة خادم مواقع بداية. انشر موقعك من استوديو الإطلاق أولاً.")} <a href="#studio-site">${t("Website builder", "منشئ الموقع")}</a></p></section>
      <section class="studio-sec"><h2>3. ${t("Business email", "البريد المهني")}</h2>
        <div class="tabs">${Object.entries(PROVIDERS).map(([k, p]) => `<button data-provider="${k}" aria-pressed="${dom.provider === k}">${p.name}</button>`).join("")}</div>
        <ol class="service-steps">${prov.steps.map((s, i) => `<li>${step(`mail-${dom.provider}-${i}`, tx(s))}</li>`).join("")}</ol>
        <div class="table-wrap"><table class="data dns"><thead><tr><th>${t("Type", "النوع")}</th><th>${t("Name", "الاسم")}</th><th>${t("Value", "القيمة")}</th><th>${t("Priority", "الأولوية")}</th><th></th></tr></thead><tbody>${prov
          .records(d)
          .map((r, i) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td id="rec-${i}">${esc(r[2])}</td><td>${r[3]}</td><td>${copyBtn(`rec-${i}`)}</td></tr>`)
          .join("")}</tbody></table></div>
        <p class="muted">${t(`Suggested addresses: info@${d}, orders@${d}, and your name@${d}. DNS changes can take a few hours to work.`, `عناوين مقترحة: info@${d} وorders@${d} واسمك@${d}. قد تحتاج تغييرات DNS بضع ساعات لتعمل.`)}</p></section>`
          : ""
      }`;
  },
  mount() {
    const persist = () => autosave("domain", { domain: dom.domain, purchased: dom.purchased, provider: dom.provider, done: dom.done });
    $$("[data-pick]").forEach((b) => (b.onclick = () => ((dom.domain = b.dataset.pick), (dom.purchased = null), persist(), go("services-domain"))));
    $("#use-own").onclick = () => {
      const v = $("#own-domain").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v)) return toast(t("Type a domain like example.jo", "اكتب نطاقاً مثل example.jo"));
      dom.domain = v;
      dom.purchased = new Date().toISOString().slice(0, 10);
      dom.done.buy = true;
      persist();
      go("services-domain");
    };
    const change = $("#change-domain");
    if (change) change.onclick = () => ((dom.domain = ""), (dom.purchased = null), persist(), go("services-domain"));
    const buy = $("#buy");
    if (buy)
      buy.onclick = async () => {
        const ok = await confirmDialog({ title: t("Demo purchase", "شراء تجريبي"), body: t(`This records ${dom.domain} as bought for the demo. No payment is taken and nothing is registered.`, `يسجل هذا ${dom.domain} كمشترى لأغراض العرض. لا يُدفع أي مبلغ ولا يُسجل شيء فعلياً.`), confirmLabel: t("Record purchase", "تسجيل الشراء") });
        if (!ok.confirmed) return;
        dom.purchased = new Date().toISOString().slice(0, 10);
        dom.done.buy = true;
        persist();
        go("services-domain");
      };
    $$("[data-done]").forEach((c) => (c.onchange = () => ((dom.done[c.dataset.done] = c.checked), persist())));
    $$("[data-provider]").forEach((b) => (b.onclick = () => ((dom.provider = b.dataset.provider), persist(), go("services-domain"))));
    bindCopy();
  },
};

// ================================================================ E3 accounting and invoices
const CATS = { sales: ["Sales", "مبيعات"], other_income: ["Other income", "دخل آخر"], materials: ["Materials", "مواد خام"], rent: ["Rent", "إيجار"], salaries: ["Salaries", "رواتب"], marketing: ["Marketing", "تسويق"], fees: ["Government fees", "رسوم حكومية"], other: ["Other", "أخرى"] };
let acc = null;
const accountingScreen = {
  async render() {
    const title = t("Accounting and invoices", "المحاسبة والفواتير");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    try {
      if (acc?.bid !== bid()) acc = { bid: bid(), month: today().slice(0, 7), ...(await load("accounting", { entries: [], invoices: [], next: 1 })) };
    } catch (e) {
      return errorBlock(title, e, "services-accounting");
    }
    const inMonth = acc.entries.filter((e) => e.date.startsWith(acc.month));
    const income = inMonth.filter((e) => e.type === "in").reduce((n, e) => n + e.amount, 0);
    const out = inMonth.filter((e) => e.type === "out").reduce((n, e) => n + e.amount, 0);
    return `${head(t("Startup services · Accounting", "خدمات الانطلاق · المحاسبة"), title, t("A simple money tracker and branded invoices. Changes save automatically.", "متتبع بسيط للأموال وفواتير بهويتك. تُحفظ التغييرات تلقائياً."))}
      <span class="muted" id="save-status" aria-live="polite"></span>
      <label class="field compact"><span>${t("Month", "الشهر")}</span><input type="month" id="acc-month" value="${acc.month}"></label>
      <div class="metrics"><div class="metric"><b>${income.toFixed(2)}</b><small>${t("Money in (JOD)", "الداخل (دينار)")}</small></div><div class="metric"><b>${out.toFixed(2)}</b><small>${t("Money out (JOD)", "الخارج (دينار)")}</small></div><div class="metric"><b style="color:${income - out < 0 ? "var(--red)" : ""}">${(income - out).toFixed(2)}</b><small>${t("Profit (JOD)", "الربح (دينار)")}</small></div></div>
      <div class="card"><h2>${t("Add an entry", "إضافة قيد")}</h2><div class="grid-2">
        <label class="field"><span>${t("Date", "التاريخ")}</span><input type="date" id="a-date" value="${today()}"></label>
        <label class="field"><span>${t("Type", "النوع")}</span><select id="a-type"><option value="in">${t("Money in", "داخل")}</option><option value="out">${t("Money out", "خارج")}</option></select></label>
        <label class="field"><span>${t("Category", "الفئة")}</span><select id="a-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${tx(v)}</option>`).join("")}</select></label>
        <label class="field"><span>${t("Amount (JOD)", "المبلغ (دينار)")}</span><input type="number" id="a-amount" min="0" step="0.01"></label>
        <label class="field"><span>${t("Description", "الوصف")}</span><input id="a-desc" maxlength="160"></label></div>
        <div class="toolbar tight"><button class="primary" id="add-entry">${t("Add", "إضافة")}</button></div></div>
      ${inMonth.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t("Date", "التاريخ")}</th><th>${t("Description", "الوصف")}</th><th>${t("Category", "الفئة")}</th><th>${t("Amount", "المبلغ")}</th><th></th></tr></thead><tbody>${[...inMonth]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => `<tr><td>${esc(day(e.date))}</td><td>${esc(e.desc)}</td><td>${tx(CATS[e.cat] || CATS.other)}</td><td class="ltr" style="color:${e.type === "out" ? "var(--red)" : "var(--green)"}">${e.type === "out" ? "−" : "+"}${e.amount.toFixed(2)}</td><td><button data-del-entry="${e.id}">${t("Remove", "حذف")}</button></td></tr>`)
        .join("")}</tbody></table></div><div class="toolbar"><button id="acc-csv">${t("Download month (CSV)", "تنزيل الشهر (CSV)")}</button></div>` : `<p class="summary">${t("No entries this month yet.", "لا قيود هذا الشهر بعد.")}</p>`}
      <section class="studio-sec"><h2>${t("Invoices", "الفواتير")}</h2>
        <div class="card"><div class="grid-2">
          <label class="field"><span>${t("Customer name", "اسم العميل")}</span><input id="i-customer" maxlength="120"></label>
          <label class="field"><span>${t("Customer phone or email", "هاتف العميل أو بريده")}</span><input id="i-contact" maxlength="120"></label></div>
          <label class="field"><span>${t("Items (one per line: description — quantity — unit price)", "البنود (سطر لكل بند: الوصف — الكمية — سعر الوحدة)")}</span><textarea id="i-items" rows="4" dir="auto" placeholder="${t("Ma'amoul box — 2 — 6", "علبة معمول — 2 — 6")}"></textarea></label>
          <label class="option small"><input type="checkbox" id="i-tax">${t("Add 16% general sales tax (only if you're registered for sales tax)", "أضف ضريبة المبيعات العامة 16% (فقط إن كنت مسجلاً لضريبة المبيعات)")}</label>
          <div class="toolbar tight"><button class="primary" id="make-invoice">${t("Create invoice (PDF)", "إنشاء فاتورة (PDF)")}</button></div></div>
        ${acc.invoices.length ? `<div class="list">${[...acc.invoices].reverse().map((v) => `<div class="item"><span class="lead">${esc(v.no)}</span><div class="details"><strong>${esc(v.customer)}</strong><small>${esc(day(v.date))} · ${v.total.toFixed(2)} ${t("JOD", "دينار")}</small></div><span class="status ${v.paid ? "done" : "warning"}">${v.paid ? t("Paid", "مدفوعة") : t("Unpaid", "غير مدفوعة")}</span>${v.paid ? "" : `<button data-paid="${v.id}">${t("Mark paid", "تحديد كمدفوعة")}</button>`}<button data-reprint="${v.id}">PDF</button></div>`).join("")}</div>` : `<p class="muted">${t("No invoices yet.", "لا فواتير بعد.")}</p>`}
        <p class="note">${t("Registered taxpayers must issue invoices through the national e-invoicing system (JoFotara).", "على المكلفين المسجلين إصدار الفواتير عبر نظام الفوترة الوطني (جوفوترة).")} <a href="#invoicing">${t("About e-invoicing", "عن الفوترة الإلكترونية")}</a></p></section>`;
  },
  mount() {
    const persist = () => autosave("accounting", { entries: acc.entries, invoices: acc.invoices, next: acc.next });
    $("#acc-month").onchange = (e) => ((acc.month = e.target.value), go("services-accounting"));
    $("#a-type").onchange = (e) => ($("#a-cat").value = e.target.value === "in" ? "sales" : "materials");
    $("#add-entry").onclick = () => {
      const amount = Number($("#a-amount").value);
      if (!(amount > 0)) return toast(t("Enter an amount.", "أدخل المبلغ."));
      acc.entries.push({ id: uid(), date: $("#a-date").value || today(), type: $("#a-type").value, cat: $("#a-cat").value, amount, desc: $("#a-desc").value.trim() });
      persist();
      go("services-accounting");
    };
    $$("[data-del-entry]").forEach((b) => (b.onclick = () => ((acc.entries = acc.entries.filter((e) => e.id !== b.dataset.delEntry)), persist(), go("services-accounting"))));
    const c = $("#acc-csv");
    if (c) c.onclick = () => downloadCsv([["Date", "Type", "Category", "Description", "Amount JOD"], ...acc.entries.filter((e) => e.date.startsWith(acc.month)).map((e) => [e.date, e.type === "in" ? "in" : "out", e.cat, e.desc, e.amount.toFixed(2)])], `bedaya-accounts-${acc.month}.csv`);
    const print = async (v) => {
      const brand = await activeBrand().catch(() => null);
      const lines = v.items.map((i) => ({ text: `${i.desc}   ×${i.qty}   @ ${i.price.toFixed(2)}   = ${(i.qty * i.price).toFixed(2)} JOD`, size: 26 }));
      await pdfFrom(
        [
          { text: `${t("Invoice", "فاتورة")} ${v.no}`, size: 44, weight: 700, gap: 20 },
          { text: `${t("Date", "التاريخ")}: ${v.date}`, size: 24 },
          { text: `${t("Bill to", "إلى")}: ${v.customer}${v.contact ? ` · ${v.contact}` : ""}`, size: 26, gap: 30 },
          ...lines,
          { text: "", gap: 10 },
          { text: `${t("Subtotal", "المجموع الفرعي")}: ${v.subtotal.toFixed(2)} JOD`, size: 28 },
          ...(v.tax ? [{ text: `${t("General sales tax 16%", "ضريبة المبيعات العامة 16%")}: ${v.tax.toFixed(2)} JOD`, size: 28 }] : []),
          { text: `${t("Total", "الإجمالي")}: ${v.total.toFixed(2)} JOD`, size: 34, weight: 700, gap: 40 },
          { text: `${t("From", "من")}: ${brand ? tx(brand.name) : session.business.name} · ${sanadValue("phone")}`, size: 22 },
          { text: t("Thank you for your business!", "شكراً لتعاملكم معنا!"), size: 26, weight: 700 },
        ],
        { title: `${t("Invoice", "فاتورة")} ${v.no}`, brand },
        `invoice-${v.no}.pdf`,
      );
    };
    $("#make-invoice").onclick = async (e) => {
      const customer = $("#i-customer").value.trim();
      const items = $("#i-items")
        .value.split("\n")
        .map((l) => l.split(/\s*[—–-]\s*/))
        .filter((p) => p[0]?.trim())
        .map(([desc, qty, price]) => ({ desc: desc.trim(), qty: Number(qty) || 1, price: Number(price) || 0 }));
      if (!customer || !items.length) return toast(t("Add the customer and at least one item.", "أضف العميل وبنداً واحداً على الأقل."));
      const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);
      const tax = $("#i-tax").checked ? subtotal * 0.16 : 0;
      const v = { id: uid(), no: `INV-${today().slice(0, 4)}-${String(acc.next).padStart(4, "0")}`, date: today(), customer, contact: $("#i-contact").value.trim(), items, subtotal, tax, total: subtotal + tax, paid: false };
      acc.next += 1;
      acc.invoices.push(v);
      persist();
      e.target.disabled = true;
      await print(v).catch(() => toast(t("The invoice PDF couldn't be made.", "تعذر إنشاء ملف الفاتورة.")));
      go("services-accounting");
    };
    $$("[data-paid]").forEach(
      (b) =>
        (b.onclick = () => {
          const v = acc.invoices.find((x) => x.id === b.dataset.paid);
          v.paid = true;
          acc.entries.push({ id: uid(), date: today(), type: "in", cat: "sales", amount: v.total, desc: `${v.no} · ${v.customer}` });
          persist();
          toast(t("Marked paid and added to money in.", "تم التحديد كمدفوعة وإضافتها للداخل."));
          go("services-accounting");
        }),
    );
    $$("[data-reprint]").forEach((b) => (b.onclick = () => print(acc.invoices.find((x) => x.id === b.dataset.reprint))));
  },
};

// ================================================================ E4 online presence
let pres = null;
const presenceScreen = {
  async render() {
    const title = t("Online presence", "الحضور الرقمي");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    try {
      if (pres?.bid !== bid()) pres = { bid: bid(), ...(await load("presence", { texts: null, done: {} })) };
    } catch (e) {
      return errorBlock(title, e, "services-presence");
    }
    const p = pres.texts;
    const box = (id, label, v, max) => `<div class="card"><h3>${label}</h3><div class="grid-2">${["ar", "en"].map((l) => `<label class="field"><span>${l === "ar" ? "العربية" : "English"}${max ? ` · <span class="ltr" data-count="${id}-${l}">${(v[l] || "").length}</span>/${max}` : ""}</span><textarea id="${id}-${l}" data-ptext="${id}.${l}" dir="${l === "ar" ? "rtl" : "ltr"}" rows="4" ${max ? `maxlength="${max}"` : ""}>${esc(v[l] || "")}</textarea>${copyBtn(`${id}-${l}`)}</label>`).join("")}</div></div>`;
    const step = (k, label) => `<li><label class="option small"><input type="checkbox" data-pdone="${k}" ${pres.done[k] ? "checked" : ""}>${label}</label></li>`;
    return `${head(t("Startup services · Online presence", "خدمات الانطلاق · الحضور الرقمي"), title, t("Ready-to-paste texts in your brand's voice, and the steps to get found on Google Maps and social media.", "نصوص جاهزة للنسخ بنبرة هويتك، وخطوات الظهور على خرائط Google ومنصات التواصل."))}
      <span class="muted" id="save-status" aria-live="polite"></span>
      <div class="toolbar"><button class="primary" id="gen-presence">${p ? t("Write them again", "اكتبها من جديد") : t("Write my texts", "اكتب نصوصي")}</button></div>
      ${
        p
          ? `${box("google", t("Google Business Profile description", "وصف الملف التجاري على Google"), p.google, 750)}${box("instagram", t("Instagram bio", "نبذة إنستغرام"), p.instagram, 150)}${box("facebook", t("Facebook page About", "قسم حول في فيسبوك"), p.facebook)}${box("wag", t("WhatsApp Business greeting", "رسالة الترحيب في واتساب للأعمال"), p.whatsappGreeting)}${box("waa", t("WhatsApp Business away message", "رسالة الغياب في واتساب للأعمال"), p.whatsappAway)}
             ${p.posts.map((x, i) => box(`post${i}`, t(`Starter post ${i + 1}`, `منشور البداية ${i + 1}`), x)).join("")}
             <div class="card"><h3>${t("Hashtags", "الوسوم")}</h3><p id="tags" class="ltr-text">${esc(p.hashtags.join(" "))}</p>${copyBtn("tags")}</div>`
          : `<p class="summary">${t("Bedaya writes a Google description, social bios, WhatsApp messages and three starter posts from your profile and brand.", "تكتب بداية وصف Google ونبذات التواصل ورسائل واتساب وثلاثة منشورات بداية من ملفك وهويتك.")}</p>`
      }
      <section class="studio-sec"><h2>${t("Get on Google Maps", "اظهر على خرائط Google")}</h2><ol class="service-steps">
        ${step("g1", t("Go to business.google.com and choose “Add your business”.", "ادخل business.google.com واختر \"إضافة نشاطك التجاري\"."))}
        ${step("g2", t("Enter your business name exactly as on your registration, and pick the closest category.", "أدخل اسم مشروعك كما في التسجيل واختر أقرب فئة."))}
        ${step("g3", t("Add your location (use the pin you saved on the Location page) or your delivery area if you work from home.", "أضف موقعك (استخدم الدبوس المحفوظ في صفحة الموقع) أو منطقة التوصيل إن كنت تعمل من المنزل."))}
        ${step("g4", t("Add your phone, WhatsApp and website (your Bedaya site).", "أضف الهاتف وواتساب والموقع (موقعك على بداية)."))}
        ${step("g5", t("Verify the business with the method Google offers (phone, email, video or postcard).", "وثّق النشاط بالطريقة التي تعرضها Google (هاتف أو بريد أو فيديو أو بطاقة بريدية)."))}
        ${step("g6", t("Paste the description above, add opening hours and at least 5 photos.", "الصق الوصف أعلاه وأضف ساعات العمل و5 صور على الأقل."))}</ol>
        <p><a href="#location">${t("Your saved location", "موقعك المحفوظ")}</a> · <a href="#studio-site">${t("Your website", "موقعك")}</a> · <a href="#studio-design">${t("Profile and cover images", "صور الحساب والغلاف")}</a></p></section>
      <section class="studio-sec"><h2>${t("Social media", "منصات التواصل")}</h2><ol class="service-steps">
        ${step("s1", t("Create an Instagram business account and a Facebook page with the same name and profile picture.", "أنشئ حساب أعمال على إنستغرام وصفحة فيسبوك بنفس الاسم وصورة الحساب."))}
        ${step("s2", t("Install WhatsApp Business, add your hours, and set the greeting and away messages above.", "ثبّت واتساب للأعمال وأضف ساعات العمل واضبط رسائل الترحيب والغياب أعلاه."))}
        ${step("s3", t("Post the three starter posts over your first week.", "انشر منشورات البداية الثلاثة خلال أسبوعك الأول."))}</ol></section>`;
  },
  mount() {
    const persist = () => autosave("presence", { texts: pres.texts, done: pres.done });
    $("#gen-presence").onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = t("Writing…", "جارٍ الكتابة…");
      const res = await api("/api/services/presence", { method: "POST", body: { businessId: bid() }, timeoutMs: 45000 });
      e.target.disabled = false;
      if (!res.ok) return toast(errorText(res));
      pres.texts = res.data.presence;
      persist();
      go("services-presence");
    };
    const map = { google: "google", instagram: "instagram", facebook: "facebook", wag: "whatsappGreeting", waa: "whatsappAway" };
    $$("[data-ptext]").forEach(
      (ta) =>
        (ta.oninput = () => {
          const [id, l] = ta.dataset.ptext.split(".");
          const target = id.startsWith("post") ? pres.texts.posts[Number(id.slice(4))] : pres.texts[map[id]];
          target[l] = ta.value;
          const n = $(`[data-count="${id}-${l}"]`);
          if (n) n.textContent = ta.value.length;
          persist();
        }),
    );
    $$("[data-pdone]").forEach((c) => (c.onchange = () => ((pres.done[c.dataset.pdone] = c.checked), persist())));
    bindCopy();
  },
};

// ================================================================ E5 hiring
let hire = null;
const hiringScreen = {
  async render() {
    const title = t("Hiring", "التوظيف");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(title)}`;
    try {
      if (hire?.bid !== bid()) hire = { bid: bid(), ...(await load("hiring", { title: "", hours: "", salary: "", ad: null, questions: [], cvs: [], ranked: null })) };
    } catch (e) {
      return errorBlock(title, e, "services-hiring");
    }
    const ad = hire.ad;
    const adText = (l) => (ad ? [ad.title[l], "", ad.summary[l], "", l === "ar" ? "المهام:" : "What you'll do:", ...ad.duties.map((d) => `• ${d[l]}`), "", l === "ar" ? "المتطلبات:" : "What we're looking for:", ...ad.requirements.map((d) => `• ${d[l]}`), "", ad.offer[l], ad.apply[l]].join("\n") : "");
    return `${head(t("Startup services · Hiring", "خدمات الانطلاق · التوظيف"), title, t("Write a fair job ad, shortlist the CVs you receive and prepare the interview.", "اكتب إعلان وظيفة عادلاً، وفرز السير الذاتية، وجهّز المقابلة."))}
      <span class="muted" id="save-status" aria-live="polite"></span>
      <section class="studio-sec"><h2>1. ${t("Job ad", "إعلان الوظيفة")}</h2><div class="grid-2">
        <label class="field"><span>${t("Job title", "المسمى الوظيفي")}</span><input id="h-title" value="${esc(hire.title)}" maxlength="80" placeholder="${t("e.g. Sales assistant", "مثال: مساعد مبيعات")}"></label>
        <label class="field"><span>${t("Hours", "الدوام")}</span><input id="h-hours" value="${esc(hire.hours)}" maxlength="60" placeholder="${t("Full time, Sat–Thu", "دوام كامل، السبت–الخميس")}"></label>
        <label class="field"><span>${t("Monthly salary (JOD, optional)", "الراتب الشهري (دينار، اختياري)")}</span><input id="h-salary" type="number" min="0" value="${esc(hire.salary)}"></label></div>
        <div class="toolbar tight"><button class="primary" id="gen-ad">${ad ? t("Write it again", "اكتبه من جديد") : t("Write the job ad", "اكتب الإعلان")}</button></div>
        ${ad ? `<div class="grid-2"><label class="field"><span>العربية</span><textarea id="ad-ar" dir="rtl" rows="14">${esc(adText("ar"))}</textarea>${copyBtn("ad-ar")}</label><label class="field"><span>English</span><textarea id="ad-en" dir="ltr" rows="14">${esc(adText("en"))}</textarea>${copyBtn("ad-en")}</label></div>
          <p class="note">${t("Fair hiring: don't ask for age, gender, religion, nationality or marital status unless the law requires it.", "توظيف عادل: لا تطلب العمر أو الجنس أو الدين أو الجنسية أو الحالة الاجتماعية ما لم يشترطه القانون.")}</p>` : ""}</section>
      ${
        ad
          ? `<section class="studio-sec"><h2>2. ${t("Rank CVs", "ترتيب السير الذاتية")}</h2>
        <label class="field"><span>${t("Skills to look for (comma separated)", "المهارات المطلوبة (مفصولة بفواصل)")}</span><input id="h-keywords" value="${esc(ad.keywords.join(", "))}"></label>
        <div id="cv-list">${hire.cvs.map((c, i) => `<div class="card product-row"><div class="inline-actions"><strong>${esc(c.name)}</strong><button data-del-cv="${i}">${t("Remove", "حذف")}</button></div><small class="muted">${esc(c.text.slice(0, 160))}…</small></div>`).join("")}</div>
        <div class="card"><div class="grid-2"><label class="field"><span>${t("Candidate name", "اسم المرشح")}</span><input id="cv-name" maxlength="120"></label><label class="field"><span>${t("Or upload .txt CVs", "أو ارفع سيراً بصيغة .txt")}</span><input type="file" id="cv-files" accept=".txt,text/plain" multiple></label></div>
          <label class="field"><span>${t("Paste the CV text", "الصق نص السيرة الذاتية")}</span><textarea id="cv-text" rows="5" dir="auto"></textarea></label>
          <div class="toolbar tight"><button id="add-cv">${t("Add CV", "إضافة السيرة")}</button><button class="primary" id="rank" ${hire.cvs.length ? "" : "disabled"}>${t(`Rank ${hire.cvs.length} CV(s)`, `ترتيب ${hire.cvs.length} سيرة`)}</button></div></div>
        ${hire.ranked ? `<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>${t("Candidate", "المرشح")}</th><th>${t("Match", "التطابق")}</th><th>${t("Has", "يمتلك")}</th><th>${t("Not mentioned", "غير مذكور")}</th></tr></thead><tbody>${hire.ranked.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td><span class="status ${r.score >= 60 ? "done" : r.score >= 35 ? "warning" : ""}">${r.score}%</span></td><td>${esc(r.matched.join(", ") || "—")}</td><td class="muted">${esc(r.missing.join(", ") || "—")}</td></tr>`).join("")}</tbody></table></div><p class="note">${t("A shortlisting aid only: it counts the skills a CV mentions. Read every CV yourself before deciding.", "أداة مساعدة للفرز فقط: تحسب المهارات المذكورة في السيرة. اقرأ كل سيرة بنفسك قبل القرار.")}</p>` : ""}</section>
      <section class="studio-sec"><h2>3. ${t("Interview questions", "أسئلة المقابلة")}</h2><div class="list">${hire.questions.map((q, i) => `<div class="item"><span class="lead">${i + 1}</span><div class="details"><strong>${esc(tx(q.q))}</strong><small>${t("Listen for", "انتبه إلى")}: ${esc(tx(q.listenFor))}</small></div></div>`).join("")}</div></section>`
          : ""
      }`;
  },
  mount() {
    const persist = () => autosave("hiring", { title: hire.title, hours: hire.hours, salary: hire.salary, ad: hire.ad, questions: hire.questions, cvs: hire.cvs, ranked: hire.ranked });
    $("#gen-ad").onclick = async (e) => {
      hire.title = $("#h-title").value.trim();
      hire.hours = $("#h-hours").value.trim();
      hire.salary = $("#h-salary").value.trim();
      if (hire.title.length < 2) return toast(t("Write the job title.", "اكتب المسمى الوظيفي."));
      e.target.disabled = true;
      const res = await api("/api/services/job-ad", { method: "POST", body: { businessId: bid(), title: hire.title, hours: hire.hours, salary: hire.salary }, timeoutMs: 45000 });
      e.target.disabled = false;
      if (!res.ok) return toast(errorText(res));
      hire.ad = res.data.ad;
      hire.questions = res.data.questions;
      hire.ranked = null;
      persist();
      go("services-hiring");
    };
    const addCv = $("#add-cv");
    if (!addCv) return bindCopy();
    addCv.onclick = async () => {
      const files = [...$("#cv-files").files];
      for (const f of files.slice(0, 20)) if (f.size < 200000) hire.cvs.push({ name: f.name.replace(/\.txt$/i, ""), text: await f.text() });
      const text = $("#cv-text").value.trim();
      if (text) hire.cvs.push({ name: $("#cv-name").value.trim() || t(`Candidate ${hire.cvs.length + 1}`, `مرشح ${hire.cvs.length + 1}`), text });
      if (!files.length && !text) return toast(t("Paste a CV or upload .txt files.", "الصق سيرة أو ارفع ملفات .txt."));
      hire.cvs = hire.cvs.slice(0, 30);
      persist();
      go("services-hiring");
    };
    $$("[data-del-cv]").forEach((b) => (b.onclick = () => (hire.cvs.splice(Number(b.dataset.delCv), 1), (hire.ranked = null), persist(), go("services-hiring"))));
    $("#rank").onclick = async () => {
      const keywords = $("#h-keywords").value.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await api("/api/services/rank-cvs", { method: "POST", body: { keywords, cvs: hire.cvs } });
      if (!res.ok) return toast(errorText(res));
      hire.ad.keywords = keywords;
      hire.ranked = res.data.ranked;
      persist();
      go("services-hiring");
    };
    bindCopy();
  },
};

export const routes = {
  services: hub,
  "services-hr": hrScreen,
  "services-domain": domainScreen,
  "services-accounting": accountingScreen,
  "services-presence": presenceScreen,
  "services-hiring": hiringScreen,
};
