// Incubators, applications, bank file, funding and experts (features 5, 6, 19, 20).
// Matching and reasons come from M5 (through M4 when signed in); applications are saved by M4.
import { $, $$, api, bpath, confirmDialog, day, download, errorText, esc, go, needsAccount, read, ready, save, session, t, toast, tx } from "./core.js";

const TYPE = {
  incubator: ["Incubator", "حاضنة"],
  accelerator: ["Accelerator", "مسرّعة"],
  grant: ["Grant", "منحة"],
  loan: ["Loan", "قرض"],
  competition: ["Competition", "مسابقة"],
};
const APP_STATUS = {
  submitted: ["Received", "تم الاستلام", "info"],
  in_review: ["In review", "قيد المراجعة", "warning"],
  needs_documents: ["Documents requested", "مطلوب مستندات", "error"],
  approved: ["Approved", "مقبول", "done"],
  rejected: ["Not accepted", "غير مقبول", "error"],
};

let programmeCache = null;
async function programmes() {
  if (!programmeCache) {
    const res = await api("/api/ai/programmes");
    programmeCache = res.ok ? res.data.programmes : [];
  }
  return programmeCache;
}
const programmeName = (list, key) => {
  const p = list.find((x) => x.id === key);
  return p ? tx(p.name) : key === "bank-demo" ? t("Demo Bank (fictional)", "بنك تجريبي (افتراضي)") : key;
};

/** Matches for this user: M4 (ranking + M5 reasons) when signed in, else M5 directly from the SANAD profile. */
async function loadMatches() {
  if (ready()) {
    const res = await api(bpath("incubators"));
    if (res.ok) return { matches: res.data.matches, scores: Object.fromEntries(res.data.ranked.map((r) => [r.incubatorId, r.score])), source: "m4" };
  }
  if (session.sanad) {
    const p = await api("/api/profile/user-profile");
    if (p.ok) {
      const res = await api("/api/ai/incubators/match", { method: "POST", body: { profile: p.data.profile } });
      if (res.ok) return { matches: res.data.matches, scores: Object.fromEntries(res.data.matches.map((m) => [m.incubatorId, Math.min(1, m.score / 12)])), source: "m5", profile: p.data.profile };
    }
  }
  return null;
}

// ---------- incubators (feature 5) ----------
export const incubators = {
  async render() {
    const data = await loadMatches();
    if (!data) return `<h1>${t("Find the right support", "اعثر على الدعم المناسب")}</h1>${needsAccount(t("Matching", "المطابقة"))}`;
    const applied = ready() ? await api(bpath("applications")) : null;
    const appliedKeys = new Set(applied?.ok ? applied.data.data.map((a) => a.partner_key) : []);
    const cities = [...new Set(data.matches.map((m) => m.city).filter(Boolean))];
    this.data = data;
    return `<div class="eyebrow">${t("Real Jordanian programmes", "برامج أردنية حقيقية")}</div>
      <h1>${t("Find the right support", "اعثر على الدعم المناسب")}</h1>
      <p class="subtitle">${t("Each match explains why it fits your business and what you'll need to show.", "يوضح كل ترشيح سبب ملاءمته لمشروعك وما ستحتاج إلى إثباته.")}</p>
      <div class="grid-2">
        <label class="field"><span>${t("Search", "بحث")}</span><input id="search" placeholder="${t("Name, focus or city", "الاسم أو المجال أو المدينة")}"></label>
        <label class="field"><span>${t("Type", "النوع")}</span><select id="type"><option value="">${t("All", "الكل")}</option>${Object.entries(TYPE).map(([k, v]) => `<option value="${k}">${tx(v)}</option>`).join("")}</select></label>
      </div>
      <div class="list" id="matches">${data.matches
        .map((m) => {
          const score = Math.round((data.scores[m.incubatorId] ?? 0) * 100);
          const done = appliedKeys.has(m.incubatorId);
          return `<div class="item" data-match data-type="${esc(m.type)}" data-text="${esc(`${tx(m.name)} ${tx(m.organisation)} ${tx(m.reason)}`.toLowerCase())}">
            <span class="lead">${score ? `${score}%` : "—"}</span>
            <div class="details"><strong>${esc(tx(m.name))} <span class="status info">${esc(tx(TYPE[m.type] || [m.type, m.type]))}</span></strong>
              <small>${esc(tx(m.organisation))}</small><small>${esc(tx(m.reason))}</small>
              ${(m.eligibilityProblems || []).map((p) => `<small class="error">${esc(tx(p))}</small>`).join("")}
              <small><a href="${esc(m.website)}" target="_blank" rel="noopener noreferrer">${t("Official page", "الصفحة الرسمية")}</a> · ${m.applicationDeadline ? esc(day(m.applicationDeadline)) : t("check the website for dates", "مواعيد التقديم على الموقع")}</small></div>
            <div class="inline-actions"><button data-preview="${esc(m.incubatorId)}">${t("Preview form", "معاينة الطلب")}</button>
              ${done ? `<span class="status done">${t("Applied", "تم التقديم")}</span>` : `<input type="checkbox" data-select="${esc(m.incubatorId)}" aria-label="${esc(tx(m.name))}">`}</div></div>`;
        })
        .join("")}</div>
      <p id="empty" class="summary" hidden>${t("No programme matches these filters.", "لا يوجد برنامج يطابق هذه المرشحات.")}</p>
      ${data.matches.length ? "" : `<p class="summary">${t("No programme fits your profile yet. Check Funding for loans and grants.", "لا يوجد برنامج يناسب ملفك بعد. راجع صفحة التمويل للقروض والمنح.")}</p>`}
      <p class="note">${t("Application forms aren't public, so Bedaya prepares a draft for you to check. Applications are recorded in Bedaya's partner inbox; nothing is sent to outside organisations.", "نماذج التقديم غير منشورة، لذا تجهز بداية مسودة لتراجعها. تُسجل الطلبات في صندوق الشركاء في بداية ولا يُرسل شيء لجهات خارجية.")}</p>
      <div class="toolbar"><button class="primary" id="apply">${t("Apply to selected", "التقديم للجهات المحددة")}</button><button data-go="funding">${t("See funding options", "عرض خيارات التمويل")}</button></div>`;
  },
  mount() {
    const filter = () => {
      const q = $("#search").value.toLowerCase().trim();
      const type = $("#type").value;
      let shown = 0;
      $$("[data-match]").forEach((row) => {
        row.hidden = !(row.dataset.text.includes(q) && (!type || row.dataset.type === type));
        if (!row.hidden) shown++;
      });
      $("#empty").hidden = shown > 0 || !$$("[data-match]").length;
    };
    $("#search").oninput = filter;
    $("#type").onchange = filter;
    $$("[data-preview]").forEach((b) => (b.onclick = () => previewForm(b.dataset.preview, incubators.data)));
    $("#apply").onclick = async () => {
      const keys = $$("[data-select]:checked").map((c) => c.dataset.select);
      if (!keys.length) return toast(t("Select at least one programme.", "اختر برنامجاً واحداً على الأقل."));
      if (!ready()) return go(session.account ? "w1" : "account");
      const ok = await confirmShare(keys.length);
      if (!ok) return;
      const res = await api(bpath("applications"), { method: "POST", body: { partnerKeys: keys, consent: true } });
      if (!res.ok) return toast(errorText(res));
      await api("/api/platform/consents", { method: "POST", body: { purpose: "incubator_share", granted: true } });
      save("lastApplied", res.data.data.map((a) => a.id));
      go("applied");
    };
  },
};

async function confirmShare(count) {
  const res = await confirmDialog({
    title: t("Share your file?", "مشاركة ملفك؟"),
    body: t(
      `Bedaya will share your profile, business plan and documents with ${count} programme(s) through its partner inbox.`,
      `ستشارك بداية ملفك وخطة عملك ومستنداتك مع ${count} برنامج عبر صندوق الشركاء.`,
    ),
    confirmLabel: t("Agree and apply", "الموافقة والتقديم"),
  });
  return res.confirmed;
}

async function previewForm(id, data) {
  const res = ready()
    ? await api(bpath("incubators/prefill"), { method: "POST", body: { incubatorIds: [id] } })
    : await api("/api/ai/incubators/prefill", { method: "POST", body: { profile: data.profile, incubatorIds: [id] } });
  const app = res.ok ? (res.data.data || res.data.applications)[0] : null;
  if (!app) return toast(errorText(res));
  const rows = app.fields
    .map((f) => `<dt>${esc(tx(f.label))}${f.required ? " *" : ""}</dt><dd>${f.value ? esc(f.value) : `<span class="error">${t("You fill this in", "تملؤه بنفسك")}</span>`}${f.origin === "derived" ? ` <span class="status info">${t("adjusted", "معدّل")}</span>` : ""}</dd>`)
    .join("");
  await confirmDialog({
    title: tx(app.name),
    html: `<dl class="kv">${rows}</dl><p class="note">${app.readyToSubmit ? t("Everything required is filled in.", "كل الحقول المطلوبة معبأة.") : t("Some required fields need your input.", "بعض الحقول المطلوبة تحتاج إدخالك.")}</p>`,
    confirmLabel: t("Close", "إغلاق"),
  });
}

// ---------- applications ----------
export const applied = {
  async render() {
    if (!ready()) return `<h1>${t("Your applications", "طلباتك")}</h1>${needsAccount(t("Applications", "الطلبات"))}`;
    const [res, list] = await Promise.all([api(bpath("applications")), programmes()]);
    const apps = res.ok ? res.data.data : [];
    const fresh = new Set(read("lastApplied", []));
    return `<div class="eyebrow">${t("Applications", "الطلبات")}</div>
      <h1>${fresh.size ? t("Your next connections are on their way", "طلباتك في طريقها") : t("Your applications", "طلباتك")}</h1>
      <p class="subtitle">${t("Follow each programme's decision here.", "تابع قرار كل برنامج هنا.")}</p>
      ${fresh.size ? `<div class="success-mark" aria-hidden="true">✓</div>` : ""}
      <div class="list">${
        apps.length
          ? apps
              .map((a) => {
                const st = APP_STATUS[a.status] || [a.status, a.status, ""];
                return `<div class="item"><span class="lead ltr">${esc(String(a.id).slice(0, 8).toUpperCase())}</span><div class="details"><strong>${esc(programmeName(list, a.partner_key))}</strong><small>${esc(day(a.created_at))}${a.kind === "bank" ? ` · ${t("Bank file", "ملف بنكي")}` : ""}</small>
                  ${a.review_note ? `<small>${t("Note", "ملاحظة")}: ${esc(a.review_note)}</small>` : ""}${(a.requested_items || []).length ? `<small class="error">${t("Requested", "مطلوب")}: ${esc(a.requested_items.join(", "))}</small>` : ""}</div><span class="status ${st[2]}">${tx(st)}</span></div>`;
              })
              .join("")
          : `<div class="item"><div class="details"><small>${t("No applications yet.", "لا توجد طلبات بعد.")}</small></div></div>`
      }</div>
      <div class="toolbar"><button class="primary" data-go="bank">${t("Prepare bank file", "تجهيز الملف البنكي")}</button><button data-go="incubators">${t("Apply to more", "التقديم لبرامج أخرى")}</button></div>`;
  },
  mount() {
    save("lastApplied", []);
  },
};

// ---------- bank file (feature 6) ----------
export const bank = {
  async render() {
    if (!ready()) return `<h1>${t("A complete file for your bank", "ملف متكامل لبنكك")}</h1>${needsAccount(t("The bank file", "الملف البنكي"))}`;
    const [catalog, vault, plan, forms] = await Promise.all([api("/api/platform/catalog"), api(bpath("documents")), api(bpath("plan")), session.sanad ? api("/api/documents") : null]);
    const banks = catalog.ok ? catalog.data.data.filter((c) => c.kind === "partner" && c.payload?.kind === "bank") : [];
    const vaultCount = vault.ok ? vault.data.data.filter((d) => d.status === "ready").length : 0;
    const signedForms = forms?.ok ? forms.data.documents.filter((d) => d.kind === "generated" && d.status !== "ready_to_sign").length : 0;
    return `<div class="eyebrow">${t("Bank-ready file", "ملف جاهز للبنك")}</div>
      <h1>${t("A complete file for your bank", "ملف متكامل لبنكك")}</h1>
      <p class="subtitle">${t("Your profile, documents and business plan in one package.", "ملفك ومستنداتك وخطة عملك في حزمة واحدة.")}</p>
      <div class="list">
        <div class="item"><span class="lead">01</span><div class="details"><strong>${t("Business profile", "ملف المشروع")}</strong></div><span class="status done">${t("Complete", "مكتمل")}</span></div>
        <div class="item"><span class="lead">02</span><div class="details"><strong>${t("Documents in your vault", "المستندات في خزنتك")}</strong><small>${t(`${signedForms} signed government form(s) in Bedaya`, `${signedForms} نموذج حكومي موقّع في بداية`)}</small></div><span class="status ${vaultCount ? "" : "warning"}">${vaultCount} ${t("file(s)", "ملف")}</span></div>
        <div class="item"><span class="lead">03</span><div class="details"><strong>${t("Business plan", "خطة العمل")}</strong></div><span class="status ${plan.ok ? "" : "warning"}">${plan.ok ? t("Draft ready", "المسودة جاهزة") : t("Not ready", "غير جاهزة")}</span></div>
      </div>
      <h2 style="margin-top:28px">${t("Send to", "الإرسال إلى")}</h2>
      <div class="options">${banks.length ? banks.map((b, i) => `<label class="option"><input type="radio" name="bank" value="${esc(b.key)}" ${i === 0 ? "checked" : ""}>${esc(tx(b.payload.name))}${b.is_demo ? ` <span class="status warning">${t("fictional", "افتراضي")}</span>` : ""}</label>`).join("") : `<p class="muted">${t("No bank partners are set up yet.", "لا يوجد شركاء بنكيون بعد.")}</p>`}</div>
      <p class="note">${t("No real bank list exists yet, so the only bank is a clearly fictional demo. Nothing leaves Bedaya.", "لا توجد قائمة بنوك حقيقية بعد، لذا البنك الوحيد تجريبي وافتراضي بوضوح. لا يخرج شيء من بداية.")}</p>
      <div class="toolbar"><button class="primary" id="send-bank" ${banks.length ? "" : "disabled"}>${t("Review and send", "المراجعة والإرسال")}</button><button id="zip">${t("Download the file (ZIP)", "تنزيل الملف (ZIP)")}</button></div>`;
  },
  mount() {
    const zip = $("#zip");
    if (zip) zip.onclick = async () => ((zip.disabled = true), await download(bpath("bank-package"), "bedaya-bank-package.zip"), (zip.disabled = false));
    const send = $("#send-bank");
    if (send)
      send.onclick = async () => {
        const key = $("input[name=bank]:checked")?.value;
        if (!key) return toast(t("Choose a bank.", "اختر بنكاً."));
              const ok = await confirmDialog({ title: t("Send your bank file?", "إرسال ملفك البنكي؟"), body: t("Your profile, plan and documents will be shared with the selected bank inside Bedaya.", "ستُشارك ملفك وخطتك ومستنداتك مع البنك المحدد داخل بداية."), confirmLabel: t("Send", "إرسال") });
        if (!ok.confirmed) return;
        const res = await api(bpath("applications"), { method: "POST", body: { partnerKeys: [key], consent: true } });
        if (!res.ok) return toast(errorText(res));
        save("bankRef", res.data.data[0]?.id || "");
        go("bank-sent");
      };
  },
};

export const bankSent = {
  async render() {
    const ref = read("bankRef", "");
    return `<div class="eyebrow">${t("Bank file", "الملف البنكي")}</div>
      <h1>${t("Bank file submitted", "تم إرسال الملف البنكي")}</h1>
      <p class="subtitle">${t("The bank reviews it in Bedaya's partner inbox. You'll see its decision under Applications.", "يراجعه البنك في صندوق الشركاء في بداية. سترى قراره في صفحة الطلبات.")}</p>
      <div class="success-mark" aria-hidden="true">✓</div>
      <div class="list"><div class="item"><span class="lead ltr">${esc(String(ref).slice(0, 8).toUpperCase() || "—")}</span><div class="details"><strong>${t("Submission reference", "مرجع الإرسال")}</strong></div></div>
        <div class="item"><span class="lead">${t("Next", "التالي")}</span><div class="details"><strong>${t("Awaiting the bank's response", "بانتظار رد البنك")}</strong></div></div></div>
      <div class="toolbar"><button class="primary" data-go="appointments">${t("Book a visit", "حجز زيارة")}</button><button data-go="applied">${t("See applications", "عرض الطلبات")}</button></div>`;
  },
};

// ---------- funding (feature 19) ----------
export const funding = {
  async render() {
    const list = await programmes();
    return `<div class="eyebrow">${t("Funding", "التمويل")}</div>
      <h1>${t("Funding that fits your stage", "تمويل يناسب مرحلتك")}</h1>
      <p class="subtitle">${t("Real grants, loans and investors in Jordan. Check eligibility and dates on each official page.", "منح وقروض ومستثمرون حقيقيون في الأردن. تحقق من الأهلية والمواعيد في كل صفحة رسمية.")}</p>
      <label class="field"><span>${t("Offer type", "نوع العرض")}</span><select id="funding-filter"><option value="">${t("All", "الكل")}</option><option value="grant">${t("Grants", "منح")}</option><option value="loan">${t("Loans", "قروض")}</option><option value="accelerator">${t("Investment", "استثمار")}</option></select></label>
      <div class="list">${list
        .filter((p) => p.fundingNote || p.maxFundingJod)
        .map(
          (p) => `<div class="item" data-kind="${esc(p.type)}"><span class="lead">${esc(tx(TYPE[p.type] || [p.type, p.type]))}</span>
            <div class="details"><strong>${esc(tx(p.name))}</strong><small>${esc(p.fundingNote ? tx(p.fundingNote) : "")}</small>
            <small>${esc(p.requirements.map((r) => tx(r)).join(" · "))}</small>
            <small><a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${t("Official page", "الصفحة الرسمية")}</a></small></div></div>`,
        )
        .join("")}</div>
      <div class="toolbar"><button class="primary" data-go="incubators">${t("See my matches and apply", "عرض ترشيحاتي والتقديم")}</button></div>`;
  },
  mount() {
    $("#funding-filter").onchange = (e) => $$("[data-kind]").forEach((row) => (row.hidden = Boolean(e.target.value) && row.dataset.kind !== e.target.value));
  },
};

// ---------- experts (feature 20, screens only) ----------
const EXPERTS = [
  ["SA", ["Sara Ali", "سارة علي"], ["Accountant · tax registration · sample session 25 JOD", "محاسبة · التسجيل الضريبي · جلسة نموذجية 25 ديناراً"]],
  ["OK", ["Omar Khalil", "عمر خليل"], ["Legal advisor · company registration · sample session 35 JOD", "مستشار قانوني · تسجيل الشركات · جلسة نموذجية 35 ديناراً"]],
  ["RM", ["Rana Masri", "رنا المصري"], ["Food-safety consultant · JFDA preparation · sample session 30 JOD", "مستشارة سلامة غذاء · التحضير للغذاء والدواء · جلسة نموذجية 30 ديناراً"]],
];
export const experts = {
  async render() {
    return `<div class="eyebrow">${t("Experts", "الخبراء")}</div>
      <h1>${t("Get help with the hard part", "احصل على مساعدة عند الحاجة")}</h1>
      <p class="subtitle">${t("Fictional expert profiles for the hackathon prototype.", "ملفات خبراء افتراضية لنموذج الهاكاثون.")}</p>
      <div class="list">${EXPERTS.map((e, i) => `<div class="item"><span class="lead">${e[0]}</span><div class="details"><strong>${tx(e[1])}</strong><small>${tx(e[2])}</small></div><button data-expert="${i}">${t("Book", "حجز")}</button></div>`).join("")}</div>
      <p class="note">${t("Expert booking isn't connected yet; this opens the appointments screen.", "حجز الخبراء غير مربوط بعد؛ يفتح هذا صفحة المواعيد.")}</p>`;
  },
  mount() {
    $$("[data-expert]").forEach((b) => (b.onclick = () => (toast(t("Pick a time on the appointments screen.", "اختر وقتاً في صفحة المواعيد.")), go("appointments"))));
  },
};
