// Incubators, applications, bank file, funding and experts (features 5, 6, 19, 20).
// Matching and reasons come from M5 (through M4 when signed in); applications are saved by M4.
import { $, $$, api, bpath, confirmDialog, day, download, errorText, esc, go, jod, needsAccount, read, ready, save, session, t, time, toast, tx } from "./core.js";

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
  return p ? tx(p.name) : key === "bank-demo" ? t("Partner Bank", "البنك الشريك") : key;
};

/** Matches for this user: M4 (ranking + M5 reasons) when signed in, else M5 directly from the SANAD profile. */
async function loadMatches() {
  if (ready()) {
    const res = await api(bpath("incubators"));
    if (res.ok) return { matches: res.data.matches, scores: Object.fromEntries(res.data.ranked.map((r) => [r.incubatorId, r.score])), source: "m4" };
  }
  if (session.identity) {
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
      <p class="note">${t("Bedaya prepares each application from your profile for you to check before it is sent.", "تجهز بداية كل طلب من ملفك لتراجعه قبل إرساله.")}</p>
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
// The owner picks exactly which documents go to the bank. Signed documents start selected.
const DOC_KIND = {
  identity: ["ID", "هوية"],
  address: ["Address proof", "إثبات عنوان"],
  registration: ["Registration", "تسجيل"],
  license: ["Licence", "رخصة"],
  signed: ["Signed", "موقّع"],
  other: ["Other", "أخرى"],
};
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const bank = {
  async render() {
    if (!ready()) return `<h1>${t("A complete file for your bank", "ملف متكامل لبنكك")}</h1>${needsAccount(t("The bank file", "الملف البنكي"))}`;
    const [catalog, vault, plan] = await Promise.all([api("/api/platform/catalog"), api(bpath("documents")), api(bpath("plan"))]);
    if (!vault.ok) return `<h1>${t("A complete file for your bank", "ملف متكامل لبنكك")}</h1><p class="error" role="alert">${esc(errorText(vault))}</p><div class="toolbar"><button data-go="bank">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    const banks = catalog.ok ? catalog.data.data.filter((c) => c.kind === "partner" && c.payload?.kind === "bank") : [];
    const docs = vault.data.data.filter((d) => d.status === "ready");
    this.total = docs.length;
    return `<div class="eyebrow">${t("Bank-ready file", "ملف جاهز للبنك")}</div>
      <h1>${t("A complete file for your bank", "ملف متكامل لبنكك")}</h1>
      <p class="subtitle">${t("Your profile and business plan, plus only the documents you choose.", "ملفك وخطة عملك، مع المستندات التي تختارها فقط.")}</p>
      <div class="list">
        <div class="item"><span class="lead">01</span><div class="details"><strong>${t("Business profile", "ملف المشروع")}</strong></div><span class="status done">${t("Complete", "مكتمل")}</span></div>
        <div class="item"><span class="lead">02</span><div class="details"><strong>${t("Business plan", "خطة العمل")}</strong></div><span class="status ${plan.ok ? "" : "warning"}">${plan.ok ? t("Draft ready", "المسودة جاهزة") : t("Not ready", "غير جاهزة")}</span></div>
      </div>
      <h2 style="margin-top:28px">${t("Documents to include", "المستندات المرفقة")}</h2>
      ${
        docs.length
          ? `<div class="doc-picker">
          <label class="option select-all"><input type="checkbox" id="select-all"> <strong>${t("Select all", "تحديد الكل")}</strong> <span class="status info" id="doc-count" aria-live="polite"></span></label>
          <div class="list">${docs
            .map(
              (d) => `<label class="item doc-row"><input type="checkbox" data-doc="${esc(d.id)}" ${d.kind === "signed" ? "checked" : ""} aria-label="${esc(d.filename)}">
              <div class="details"><strong class="ltr-text">${esc(d.filename)}</strong><small>${esc(day(d.created_at))} · ${esc(kb(Number(d.size_bytes) || 0))}</small></div>
              <span class="status ${d.kind === "signed" ? "done" : ""}">${esc(tx(DOC_KIND[d.kind] || DOC_KIND.other))}</span></label>`,
            )
            .join("")}</div></div>`
          : `<div class="list"><div class="item"><div class="details"><strong>${t("No documents in your vault yet", "لا توجد مستندات في خزنتك بعد")}</strong><small>${t("Upload or sign documents first; the bank file can still be sent with your profile and plan only.", "ارفع المستندات أو وقّعها أولاً؛ يمكن إرسال الملف البنكي بملفك وخطتك فقط.")}</small></div><button data-go="documents">${t("Open documents", "فتح المستندات")}</button></div></div>`
      }
      <h2 style="margin-top:28px">${t("Send to", "الإرسال إلى")}</h2>
      <div class="options">${banks.length ? banks.map((b, i) => `<label class="option"><input type="radio" name="bank" value="${esc(b.key)}" ${i === 0 ? "checked" : ""}>${esc(tx(b.payload.name))}</label>`).join("") : `<p class="muted">${t("No bank partners are set up yet.", "لا يوجد شركاء بنكيون بعد.")}</p>`}</div>
      <div class="toolbar"><button class="primary" id="send-bank" ${banks.length ? "" : "disabled"}>${t("Review and send", "المراجعة والإرسال")}</button><button id="zip">${t("Download selected (ZIP)", "تنزيل المحدد (ZIP)")}</button></div>`;
  },
  mount() {
    const boxes = $$("[data-doc]");
    const all = $("#select-all");
    const selected = () => boxes.filter((b) => b.checked).map((b) => b.dataset.doc);
    const sync = () => {
      const n = selected().length;
      if (all) {
        all.checked = n === boxes.length && n > 0;
        all.indeterminate = n > 0 && n < boxes.length;
        $("#doc-count").textContent = t(`${n} of ${boxes.length} selected`, `${n} من ${boxes.length} محدد`);
      }
    };
    boxes.forEach((b) => (b.onchange = sync));
    if (all)
      all.onchange = () => {
        boxes.forEach((b) => (b.checked = all.checked));
        sync();
      };
    sync();
    const zip = $("#zip");
    if (zip)
      zip.onclick = async () => {
        zip.disabled = true;
        await download(`${bpath("bank-package")}?documents=${encodeURIComponent(selected().join(","))}`, "bedaya-bank-package.zip");
        zip.disabled = false;
      };
    const send = $("#send-bank");
    if (send)
      send.onclick = async () => {
        const key = $("input[name=bank]:checked")?.value;
        if (!key) return toast(t("Choose a bank.", "اختر بنكاً."));
        const ids = selected();
        const names = boxes.filter((b) => b.checked).map((b) => `<li class="ltr-text">${esc(b.getAttribute("aria-label"))}</li>`).join("");
        const ok = await confirmDialog({
          title: t("Send your bank file?", "إرسال ملفك البنكي؟"),
          body: t(`Your profile, plan and ${ids.length} selected document(s) will be shared with the bank inside Bedaya. Nothing else is sent.`, `سيُشارك ملفك وخطتك و${ids.length} مستند محدد مع البنك داخل بداية. لا يُرسل شيء آخر.`),
          html: names ? `<ul>${names}</ul>` : "",
          confirmLabel: t("Send", "إرسال"),
        });
        if (!ok.confirmed) return;
        send.disabled = true;
        const res = await api(bpath("applications"), { method: "POST", body: { partnerKeys: [key], consent: true, documentIds: ids } });
        send.disabled = false;
        if (!res.ok) return toast(errorText(res));
        save("bankRef", res.data.data[0]?.id || "");
        save("bankDocs", ids.length);
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


// ---------- experts (feature 20) ----------
// Each expert publishes their own availability (expert dashboard). Owners see only that expert's
// free slots; the database refuses a slot that was booked a moment earlier (no double booking).
// These are separate from the funding/partner appointment slots on the Appointments page.
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const expertName = (e) => tx({ en: e.name_en, ar: e.name_ar });
const whenText = (iso, minutes) => `${day(iso)} · ${time(iso)} · ${minutes} ${t("min", "دقيقة")}`;

export const experts = {
  async render() {
    if (!session.account) return `<h1>${t("Get help with the hard part", "احصل على مساعدة عند الحاجة")}</h1>${needsAccount(t("Expert booking", "حجز الخبراء"))}`;
    const [list, mine] = await Promise.all([api("/api/experts"), api("/api/experts/bookings")]);
    if (!list.ok) return `<h1>${t("Get help with the hard part", "احصل على مساعدة عند الحاجة")}</h1><p class="error" role="alert">${esc(errorText(list))}</p><div class="toolbar"><button data-go="experts">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    const all = list.data.data;
    const byKey = Object.fromEntries(all.map((e) => [e.key, e]));
    const bookings = (mine.ok ? mine.data.data : []).filter((b) => new Date(b.starts_at) > new Date());
    return `<div class="eyebrow">${t("Experts", "الخبراء")}</div>
      <h1>${t("Get help with the hard part", "احصل على مساعدة عند الحاجة")}</h1>
      <p class="subtitle">${t("Each expert sets their own hours. Pick an expert to see only their free times.", "يحدد كل خبير أوقاته بنفسه. اختر خبيراً لترى أوقاته المتاحة فقط.")}</p>
      ${
        bookings.length
          ? `<h2>${t("Your expert sessions", "جلساتك مع الخبراء")}</h2><div class="list">${bookings
              .map((b) => {
                const e = byKey[b.expert_key];
                return `<div class="item"><span class="lead">${esc(initials(e?.name_en || b.expert_key))}</span><div class="details"><strong>${esc(e ? expertName(e) : b.expert_key)}</strong><small>${esc(whenText(b.starts_at, b.duration_minutes))}</small></div><button data-cancel="${esc(b.id)}">${t("Cancel", "إلغاء")}</button></div>`;
              })
              .join("")}</div><h2 style="margin-top:28px">${t("All experts", "كل الخبراء")}</h2>`
          : ""
      }
      <div class="list">${
        all.length
          ? all
              .map(
                (e) => `<div class="item"><span class="lead">${esc(initials(e.name_en))}</span><div class="details"><strong>${esc(expertName(e))}</strong><small>${esc(tx({ en: e.title_en, ar: e.title_ar }))} · ${esc(jod(e.fee_jod))}</small>
                <small>${e.freeSlots ? t(`${e.freeSlots} free time(s)`, `${e.freeSlots} وقت متاح`) : t("No free times right now", "لا أوقات متاحة حالياً")}</small></div>
                <button class="${e.freeSlots ? "primary" : ""}" data-expert="${esc(e.key)}" ${e.freeSlots ? "" : "disabled"}>${t("See times", "عرض الأوقات")}</button></div>`,
              )
              .join("")
          : `<div class="item"><div class="details"><small>${t("No experts have joined yet.", "لم ينضم خبراء بعد.")}</small></div></div>`
      }</div>`;
  },
  mount() {
    $$("[data-expert]").forEach((b) => (b.onclick = () => (save("expertKey", b.dataset.expert), go("expert-book"))));
    $$("[data-cancel]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await confirmDialog({ title: t("Cancel this session?", "إلغاء هذه الجلسة؟"), body: t("The time becomes free for others again.", "سيصبح الوقت متاحاً للآخرين مجدداً."), confirmLabel: t("Cancel session", "إلغاء الجلسة") });
          if (!ok.confirmed) return;
          const res = await api(`/api/experts/bookings/${encodeURIComponent(b.dataset.cancel)}/cancel`, { method: "POST" });
          toast(res.ok ? t("Session cancelled.", "تم إلغاء الجلسة.") : errorText(res));
          if (res.ok) go("experts");
        }),
    );
  },
};

export const expertBook = {
  async render() {
    const key = read("expertKey", "");
    const head = `<div class="eyebrow">${t("Book an expert", "حجز خبير")}</div>`;
    if (!key) return `${head}<h1>${t("Choose an expert first", "اختر خبيراً أولاً")}</h1><div class="toolbar"><button class="primary" data-go="experts">${t("See experts", "عرض الخبراء")}</button></div>`;
    if (!ready()) return `${head}<h1>${t("Book an expert", "حجز خبير")}</h1>${needsAccount(t("Expert booking", "حجز الخبراء"))}`;
    const [list, slots] = await Promise.all([api("/api/experts"), api(`/api/experts/${encodeURIComponent(key)}/slots`)]);
    const e = list.ok ? list.data.data.find((x) => x.key === key) : null;
    if (!e || !slots.ok) return `${head}<h1>${t("Couldn't load this expert", "تعذر تحميل هذا الخبير")}</h1><p class="error" role="alert">${esc(slots.ok ? t("Expert not found.", "الخبير غير موجود.") : errorText(slots))}</p><div class="toolbar"><button data-go="experts">${t("Back to experts", "العودة للخبراء")}</button></div>`;
    const free = slots.data.data;
    // Group by day so the list is easy to scan.
    const groups = {};
    for (const s of free) (groups[day(s.starts_at)] ??= []).push(s);
    return `${head}<h1>${esc(expertName(e))}</h1>
      <p class="subtitle">${esc(tx({ en: e.title_en, ar: e.title_ar }))} · ${esc(jod(e.fee_jod))}</p>
      ${
        free.length
          ? Object.entries(groups)
              .map(([d, list]) => `<h3>${esc(d)}</h3><div class="options slot-grid">${list.map((s) => `<label class="option"><input type="radio" name="slot" value="${esc(s.id)}"><span class="ltr-text">${esc(time(s.starts_at))}</span> · ${s.duration_minutes} ${t("min", "دقيقة")}</label>`).join("")}</div>`)
              .join("")
          : `<p class="summary">${t("This expert has no free times right now. Try another expert or check back later.", "لا توجد أوقات متاحة لهذا الخبير حالياً. جرّب خبيراً آخر أو عد لاحقاً.")}</p>`
      }
      <p class="note">${t("Times are shown in Amman time. Only this expert's own availability is listed.", "الأوقات بتوقيت عمّان. تظهر أوقات هذا الخبير فقط.")}</p>
      <div class="toolbar">${free.length ? `<button class="primary" id="book">${t("Book this time", "حجز هذا الوقت")}</button>` : ""}<button data-go="experts">${t("Back to experts", "العودة للخبراء")}</button></div>`;
  },
  mount() {
    const book = $("#book");
    if (!book) return;
    book.onclick = async () => {
      const slotId = $("input[name=slot]:checked")?.value;
      if (!slotId) return toast(t("Pick a time.", "اختر وقتاً."));
      book.disabled = true;
      const res = await api(`/api/experts/${encodeURIComponent(read("expertKey", ""))}/book`, { method: "POST", body: { slotId, businessId: session.business.id } });
      book.disabled = false;
      if (res.status === 409) {
        toast(t("That time was just booked by someone else. Pick another.", "حُجز هذا الوقت للتو من شخص آخر. اختر وقتاً آخر."));
        return go("expert-book");
      }
      if (!res.ok) return toast(errorText(res));
      toast(t("Booked. You'll find it at the top of the experts page.", "تم الحجز. ستجده في أعلى صفحة الخبراء."));
      go("experts");
    };
  },
};
