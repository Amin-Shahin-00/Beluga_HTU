// Partner inbox and review (feature 15), admin (feature 16) and analytics (feature 22): M4's role-checked APIs.
// Government offices and SANAD have their own mock staff dashboards from M5 (/dashboard/*).
import { $, $$, api, confirmDialog, day, errorText, esc, go, jod, read, save, session, t, time, toast, tx } from "./core.js";

const STATUS = {
  submitted: ["New", "جديد", "info"],
  in_review: ["In review", "قيد المراجعة", "warning"],
  needs_documents: ["Documents requested", "مطلوب مستندات", "error"],
  approved: ["Approved", "مقبول", "done"],
  rejected: ["Rejected", "مرفوض", "error"],
};

const staffLinks = () => `<div class="grid-2" style="margin-top:20px">
  <div class="card"><h2>${t("Government office", "الجهة الحكومية")}</h2><p class="muted">${t("Review, approve or return signed forms sent to your office.", "راجع النماذج الموقعة المرسلة لجهتك ووافق عليها أو أعدها.")}</p><a class="button" href="/dashboard/government">${t("Open", "فتح")}</a></div>
  <div class="card"><h2>${t("SANAD / MoDEE", "سند / وزارة الاقتصاد الرقمي")}</h2><p class="muted">${t("Login codes, consents and signatures issued.", "رموز الدخول والموافقات والتواقيع الصادرة.")}</p><a class="button" href="/dashboard/sanad">${t("Open", "فتح")}</a></div>
  <div class="card"><h2>${t("Bedaya team", "فريق بداية")}</h2><p class="muted">${t("Applicants' progress, warnings and the message outbox.", "تقدم المتقدمين والتنبيهات وصندوق الرسائل.")}</p><a class="button" href="/dashboard/admin">${t("Open", "فتح")}</a></div>
</div>`;

const noRole = (what) => `<p class="note">${t(
  `${what} needs a partner or admin role on your Bedaya account. The project owner assigns the first admin in Supabase; admins assign the rest from Management.`,
  `${what} تحتاج صلاحية شريك أو مدير على حسابك في بداية. يعيّن مالك المشروع أول مدير في Supabase، ثم يعيّن المديرون البقية من صفحة الإدارة.`,
)}</p>`;

async function inbox() {
  const res = await api("/api/platform/partner/inbox");
  return res;
}

const PARTY = {
  bank: { eyebrow: ["Bank", "البنك"], title: ["Bank file applications", "طلبات الملفات البنكية"], sub: ["Business owners who chose to send you their bank file. Only the documents they selected are included.", "أصحاب مشاريع اختاروا إرسال ملفهم البنكي إليك. تُرفق المستندات التي اختاروها فقط."] },
  incubator: { eyebrow: ["Incubator", "الحاضنة"], title: ["Applications to your programme", "الطلبات المقدمة لبرنامجك"], sub: ["Review complete profiles and keep owners informed.", "راجع الملفات وأبقِ أصحاب المشاريع على اطلاع."] },
  admin: { eyebrow: ["Admin", "الإدارة"], title: ["All partner applications", "كل طلبات الشركاء"], sub: ["Every bank and incubator inbox, for support.", "كل صناديق البنوك والحاضنات، لأغراض الدعم."] },
};

// ---------- partner inbox (bank and incubator accounts each see only their own) ----------
export const partner = {
  guard: "partner",
  async render() {
    const party = PARTY[session.role] || PARTY.incubator;
    const res = await inbox();
    if (!res.ok) return `<div class="eyebrow">${tx(party.eyebrow)}</div><h1>${tx(party.title)}</h1>${res.status === 403 ? noRole(t("The inbox", "صندوق الطلبات")) : `<p class="error" role="alert">${esc(errorText(res))}</p><div class="toolbar"><button data-go="partner">${t("Try again", "حاول مرة أخرى")}</button></div>`}`;
    const rows = res.data.data;
    return `<div class="eyebrow">${tx(party.eyebrow)}${session.partnerKey ? ` · <span class="ltr">${esc(session.partnerKey)}</span>` : ""}</div>
      <h1>${tx(party.title)}</h1>
      <p class="subtitle">${tx(party.sub)}</p>
      <label class="field"><span>${t("Search", "بحث")}</span><input id="inbox-search" placeholder="${t("Name, city or reference", "الاسم أو المدينة أو المرجع")}"></label>
      <div class="list" id="inbox">${
        rows.length
          ? rows
              .map((a) => {
                const p = a.payload?.profile;
                const st = STATUS[a.status] || [a.status, a.status, ""];
                const name = p ? tx({ en: p.business.nameEn, ar: p.business.nameAr }) : a.partner_key;
                return `<div class="item" data-row="${esc(`${a.id} ${name} ${p?.personal.city ?? ""} ${a.partner_key}`.toLowerCase())}"><span class="lead ltr">${esc(String(a.id).slice(0, 8).toUpperCase())}</span>
                  <div class="details"><strong>${esc(name)}</strong><small>${esc(p?.personal.city ?? "")} · ${esc(a.partner_key)} · ${esc(day(a.created_at))}</small></div>
                  <span class="status ${st[2]}">${tx(st)}</span><button data-open="${a.id}">${t("Review", "مراجعة")}</button></div>`;
              })
              .join("")
          : `<div class="item"><div class="details"><small>${t("No applications yet.", "لا توجد طلبات بعد.")}</small></div></div>`
      }</div>
      <p id="inbox-empty" class="summary" hidden>${t("Nothing matches your search.", "لا شيء يطابق البحث.")}</p>${session.role === "admin" ? staffLinks() : ""}`;
  },
  mount() {
    const search = $("#inbox-search");
    if (search)
      search.oninput = () => {
        const q = search.value.toLowerCase().trim();
        let shown = 0;
        $$("[data-row]").forEach((r) => ((r.hidden = !r.dataset.row.includes(q)), r.hidden || shown++));
        $("#inbox-empty").hidden = shown > 0;
      };
    $$("[data-open]").forEach((b) => (b.onclick = () => (save("appId", b.dataset.open), go("application"))));
  },
};

// ---------- one application ----------
export const application = {
  guard: "partner",
  async render() {
    const res = await inbox();
    const a = res.ok ? res.data.data.find((x) => x.id === read("appId", "")) : null;
    if (!a) return `<h1>${t("Application", "الطلب")}</h1><p class="error">${res.ok ? t("Application not found.", "الطلب غير موجود.") : esc(errorText(res))}</p><div class="toolbar"><button data-go="partner">${t("Back to inbox", "العودة للصندوق")}</button></div>`;
    const p = a.payload?.profile;
    const plan = a.payload?.plan;
    const docs = a.payload?.documents || [];
    const st = STATUS[a.status] || [a.status, a.status, ""];
    return `<div class="eyebrow">${t("Application", "الطلب")} <span class="ltr">${esc(String(a.id).slice(0, 8).toUpperCase())}</span></div>
      <h1>${esc(p ? tx({ en: p.business.nameEn, ar: p.business.nameAr }) : a.partner_key)}</h1>
      <p class="subtitle">${t("Received", "وصل")} ${esc(day(a.created_at))} · <span class="status ${st[2]}">${tx(st)}</span></p>
      ${p ? `<div class="card"><dl class="kv">
        <dt>${t("Owner", "المالك")}</dt><dd>${esc(tx({ en: p.personal.fullNameEn, ar: p.personal.fullNameAr }))}</dd>
        <dt>${t("City", "المدينة")}</dt><dd>${esc(p.personal.city)}</dd>
        <dt>${t("Activity", "النشاط")}</dt><dd>${esc(p.business.sector)} · ${esc(p.business.legalForm)}${p.business.homeBased ? ` · ${t("home-based", "منزلي")}` : ""}</dd>
        <dt>${t("Capital / needs", "رأس المال / الاحتياج")}</dt><dd>${esc(jod(p.business.startupCapitalJod))} / ${esc(jod(p.business.fundingNeededJod))}</dd>
        <dt>${t("Description", "الوصف")}</dt><dd>${esc(p.business.description)}</dd></dl></div>` : ""}
      <div class="list" style="margin-top:20px">
        <div class="item"><span class="lead">${t("PLAN", "خطة")}</span><div class="details"><strong>${t("Business plan", "خطة العمل")}</strong><small>${esc(plan ? tx(plan.funding?.summary) : t("Not included", "غير مرفقة"))}</small></div></div>
        <div class="item"><span class="lead">${t("DOCS", "ملفات")}</span><div class="details"><strong>${t("Documents", "المستندات")}</strong><small>${docs.length ? esc(docs.map((d) => d.filename).join(", ")) : t("No documents in the vault", "لا توجد مستندات في الخزنة")}</small></div></div>
        ${a.review_note ? `<div class="item"><span class="lead">${t("NOTE", "ملاحظة")}</span><div class="details"><small>${esc(a.review_note)}</small></div></div>` : ""}
      </div>
      <div class="toolbar"><button class="primary" data-decide="approved">${t("Approve", "الموافقة")}</button><button data-decide="needs_documents">${t("Request documents", "طلب مستندات")}</button><button data-decide="in_review">${t("Mark in review", "قيد المراجعة")}</button><button data-decide="rejected">${t("Reject", "رفض")}</button><button data-go="partner">${t("Back", "رجوع")}</button></div>`;
  },
  mount() {
    $$("[data-decide]").forEach(
      (b) =>
        (b.onclick = async () => {
          const status = b.dataset.decide;
          const res = await confirmDialog({
            title: b.textContent,
            withNote: true,
            noteRequired: status === "needs_documents" || status === "rejected",
            body: status === "needs_documents" ? t("Say which documents you need (one per line).", "اذكر المستندات المطلوبة (سطر لكل مستند).") : "",
          });
          if (!res.confirmed) return;
          const requestedItems = status === "needs_documents" ? res.note.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20) : [];
          const out = await api(`/api/platform/partner/applications/${read("appId", "")}`, { method: "PATCH", body: { status, note: res.note, requestedItems } });
          toast(out.ok ? t("Decision saved. The owner sees it under Applications.", "تم حفظ القرار. يراه المالك في صفحة الطلبات.") : errorText(out));
          if (out.ok) go("application");
        }),
    );
  },
};

// ---------- admin ----------
export const admin = {
  guard: "admin",
  async render() {
    const [catalog, users, experts] = await Promise.all([api("/api/platform/admin/catalog"), api("/api/platform/admin/users"), api("/api/experts")]);
    this.experts = experts.ok ? experts.data.data : [];
    if (!catalog.ok) return `<div class="eyebrow">${t("Admin", "الإدارة")}</div><h1>${t("Manage the launch framework", "إدارة إطار إطلاق المشاريع")}</h1>${catalog.status === 403 ? noRole(t("Management", "الإدارة")) : `<p class="error">${esc(errorText(catalog))}</p>`}${staffLinks()}`;
    const entries = catalog.data.data;
    const tab = read("adminTab", "catalog");
    this.entries = entries;
    return `<div class="eyebrow">${t("Admin", "الإدارة")}</div>
      <h1>${t("Manage the launch framework", "إدارة إطار إطلاق المشاريع")}</h1>
      <p class="subtitle">${t("Rules, partners, appointment slots and roles. Changes apply to new roadmaps.", "القواعد والشركاء والمواعيد والصلاحيات. تنطبق التغييرات على المسارات الجديدة.")}</p>
      <div class="tabs">${[["catalog", ["Catalog", "الفهرس"]], ["users", ["Users", "المستخدمون"]]].map(([k, v]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${tx(v)}</button>`).join("")}<button data-go="analytics">${t("Analytics", "التحليلات")}</button></div>
      ${tab === "catalog"
        ? `<table class="data"><thead><tr><th>${t("Key", "المفتاح")}</th><th>${t("Kind", "النوع")}</th><th>${t("Demo?", "تجريبي؟")}</th><th></th></tr></thead><tbody>${entries
            .map((e) => `<tr><td class="ltr">${esc(e.key)}</td><td>${esc(e.kind)}</td><td>${e.is_demo ? t("yes", "نعم") : t("no", "لا")}</td><td><button data-edit="${esc(e.key)}">${t("Edit", "تعديل")}</button></td></tr>`)
            .join("")}</tbody></table>`
        : `<table class="data"><thead><tr><th>${t("User ID", "معرف المستخدم")}</th><th>${t("Role", "الصلاحية")}</th><th>${t("Partner", "الشريك")}</th></tr></thead><tbody>${(users.ok ? users.data.data : [])
            .map((u) => `<tr><td class="ltr">${esc(u.user_id)}</td><td>${esc(u.role)}</td><td>${esc(u.partner_key ?? "")}</td></tr>`)
            .join("")}</tbody></table>
           <h2 style="margin-top:24px">${t("Assign a role", "تعيين صلاحية")}</h2>
           <div class="grid-2"><label class="field"><span>${t("User ID (Supabase)", "معرف المستخدم (Supabase)")}</span><input id="role-user" class="ltr"></label>
           <label class="field"><span>${t("Role", "الصلاحية")}</span><select id="role-role"><option value="partner">${t("partner (bank / incubator)", "شريك (بنك / حاضنة)")}</option><option value="expert">${t("expert", "خبير")}</option><option value="admin">${t("admin", "مدير")}</option></select></label>
           <label class="field"><span>${t("Partner or expert", "الشريك أو الخبير")}</span><select id="role-partner"><option value="">—</option><optgroup label="${t("Partners", "الشركاء")}">${entries.filter((e) => e.kind === "partner").map((e) => `<option>${esc(e.key)}</option>`).join("")}</optgroup><optgroup label="${t("Experts", "الخبراء")}">${this.experts.map((e) => `<option>${esc(e.key)}</option>`).join("")}</optgroup></select></label></div>
           <div class="toolbar"><button class="primary" id="assign">${t("Save role", "حفظ الصلاحية")}</button></div>`}${staffLinks()}`;
  },
  mount() {
    $$("[data-tab]").forEach((b) => (b.onclick = () => (save("adminTab", b.dataset.tab), go("admin"))));
    $$("[data-edit]").forEach(
      (b) =>
        (b.onclick = async () => {
          const entry = admin.entries.find((e) => e.key === b.dataset.edit);
          const res = await confirmDialog({
            title: `${t("Edit", "تعديل")} ${entry.key}`,
            html: `<label class="field"><span>${t("Payload (JSON)", "البيانات (JSON)")}</span><textarea id="payload" rows="12" class="ltr" spellcheck="false">${esc(JSON.stringify(entry.payload, null, 2))}</textarea></label>
                   <label class="option"><input type="checkbox" id="is-demo" ${entry.is_demo ? "checked" : ""}>${t("Demo / fictional data", "بيانات تجريبية / افتراضية")}</label>`,
            confirmLabel: t("Save changes", "حفظ التغييرات"),
          });
          if (!res.confirmed) return;
          let payload;
          try {
            payload = JSON.parse($("#payload").value);
          } catch {
            return toast(t("That isn't valid JSON.", "هذا ليس JSON صالحاً."));
          }
          const out = await api("/api/platform/admin/catalog", { method: "POST", body: { key: entry.key, kind: entry.kind, payload, isDemo: $("#is-demo").checked } });
          toast(out.ok ? t("Saved.", "تم الحفظ.") : errorText(out));
          go("admin");
        }),
    );
    const assign = $("#assign");
    if (assign)
      assign.onclick = async () => {
        const out = await api("/api/platform/admin/users", { method: "POST", body: { userId: $("#role-user").value.trim(), role: $("#role-role").value, partnerKey: $("#role-partner").value || null } });
        toast(out.ok ? t("Role saved.", "تم حفظ الصلاحية.") : errorText(out));
        if (out.ok) go("admin");
      };
  },
};

// ---------- analytics ----------
export const analytics = {
  guard: "admin",
  async render() {
    const res = await api("/api/platform/analytics");
    if (!res.ok) return `<div class="eyebrow">${t("Analytics", "التحليلات")}</div><h1>${t("See where progress slows", "اعرف أين يتباطأ التقدم")}</h1><p class="error" role="alert">${esc(errorText(res))}</p><div class="toolbar"><button data-go="analytics">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    const rows = res?.ok ? res.data.data : [];
    const max = Math.max(1, ...rows.map((r) => r.averageDays));
    const STEP = { registration: ["Business registration", "تسجيل المشروع"], documents: ["Document preparation", "تجهيز المستندات"], licensing: ["Licensing", "الترخيص"] };
    return `<div class="eyebrow">${t("Analytics", "التحليلات")}</div>
      <h1>${t("See where progress slows", "اعرف أين يتباطأ التقدم")}</h1>
      <p class="subtitle">${t("Anonymous aggregates; no personal records.", "بيانات مجمعة مجهولة؛ دون سجلات شخصية.")}</p>
      ${res ? "" : `<p class="note">${t("Sign in to view analytics.", "سجّل الدخول لعرض التحليلات.")}</p>`}
      <div class="list">${rows
        .map((r) => `<div class="item"><span class="lead">${r.averageDays}</span><div class="details"><strong>${esc(tx(STEP[r.step] || [r.step, r.step]))}</strong><small>${t(`Average days · sample of ${r.sampleSize}`, `متوسط الأيام · عينة من ${r.sampleSize}`)}</small><div class="bar"><span style="width:${(r.averageDays / max) * 100}%"></span></div></div></div>`)
        .join("")}</div>
      ${res?.ok ? `<p class="note">${esc(res.data.disclaimer)}</p>` : ""}
      <div class="toolbar"><button data-go="admin">${t("Back to management", "العودة للإدارة")}</button></div>`;
  },
};

// ---------- expert dashboard: the expert's own availability and bookings ----------
// Jordan keeps UTC+3 all year, so times entered here are sent with a +03:00 offset.
const ammanDate = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
export const expert = {
  guard: "expert",
  async render() {
    const res = await api("/api/experts/me");
    const head = `<div class="eyebrow">${t("Expert dashboard", "لوحة الخبير")}</div>`;
    if (!res.ok) return `${head}<h1>${t("My availability", "مواعيدي")}</h1><p class="error" role="alert">${esc(errorText(res))}</p><div class="toolbar"><button data-go="expert">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    const { expert: me, slots } = res.data;
    const upcoming = slots.filter((s) => new Date(s.starts_at) > new Date());
    const booked = upcoming.filter((s) => s.status === "booked");
    const open = upcoming.filter((s) => s.status === "open");
    const row = (s) => `<div class="item"><span class="lead ltr">${esc(time(s.starts_at))}</span><div class="details"><strong>${esc(day(s.starts_at))}</strong><small>${s.duration_minutes} ${t("min", "دقيقة")}${s.status === "booked" ? ` · ${t("Booked by a Bedaya business owner", "محجوز من صاحب مشروع في بداية")} <span class="ltr">#${esc(s.business_id ?? "")}</span>` : ""}</small></div>
      ${s.status === "booked" ? `<span class="status done">${t("Booked", "محجوز")}</span><button data-cancel="${esc(s.id)}">${t("Cancel booking", "إلغاء الحجز")}</button>` : `<span class="status info">${t("Free", "متاح")}</span><button data-remove="${esc(s.id)}">${t("Remove", "حذف")}</button>`}</div>`;
    return `${head}<h1>${esc(tx({ en: me.name_en, ar: me.name_ar }))}</h1>
      <p class="subtitle">${esc(tx({ en: me.title_en, ar: me.title_ar }))} · ${esc(jod(me.fee_jod))} · ${t("Owners only see the free times you add here.", "يرى أصحاب المشاريع الأوقات المتاحة التي تضيفها هنا فقط.")}</p>
      <div class="card"><h2>${t("Add free time", "إضافة وقت متاح")}</h2>
        <div class="grid-2">
          <label class="field"><span>${t("Date", "التاريخ")}</span><input type="date" id="slot-date" min="${ammanDate()}" value="${ammanDate(new Date(Date.now() + 864e5))}"></label>
          <label class="field"><span>${t("Start time (Amman)", "وقت البدء (عمّان)")}</span><input type="time" id="slot-time" value="10:00" step="900"></label>
          <label class="field"><span>${t("Length", "المدة")}</span><select id="slot-minutes">${[30, 45, 60, 90].map((m) => `<option value="${m}" ${m === 45 ? "selected" : ""}>${m} ${t("minutes", "دقيقة")}</option>`).join("")}</select></label>
          <label class="field"><span>${t("Repeat", "التكرار")}</span><select id="slot-repeat"><option value="1">${t("Just this day", "هذا اليوم فقط")}</option><option value="5">${t("Next 5 days", "الأيام الخمسة القادمة")}</option><option value="10">${t("Next 10 days", "الأيام العشرة القادمة")}</option></select></label>
        </div>
        <p id="slot-error" class="error" role="alert"></p>
        <div class="toolbar"><button class="primary" id="add-slot">${t("Add", "إضافة")}</button></div></div>
      <h2 style="margin-top:24px">${t("Booked sessions", "الجلسات المحجوزة")} <span class="status ${booked.length ? "done" : ""}">${booked.length}</span></h2>
      <div class="list">${booked.length ? booked.map(row).join("") : `<div class="item"><div class="details"><small>${t("No bookings yet.", "لا حجوزات بعد.")}</small></div></div>`}</div>
      <h2 style="margin-top:24px">${t("Free times", "الأوقات المتاحة")} <span class="status info">${open.length}</span></h2>
      <div class="list">${open.length ? open.map(row).join("") : `<div class="item"><div class="details"><small>${t("You have no free times. Add some above so owners can book you.", "ليس لديك أوقات متاحة. أضف بعضها أعلاه ليتمكن أصحاب المشاريع من حجزك.")}</small></div></div>`}</div>`;
  },
  mount() {
    const add = $("#add-slot");
    if (add)
      add.onclick = async () => {
        const date = $("#slot-date").value;
        const clock = $("#slot-time").value;
        const minutes = Number($("#slot-minutes").value);
        const repeat = Number($("#slot-repeat").value);
        $("#slot-error").textContent = "";
        if (!date || !clock) return ($("#slot-error").textContent = t("Choose a date and time.", "اختر التاريخ والوقت."));
        add.disabled = true;
        let added = 0;
        let lastError = "";
        for (let i = 0; i < repeat; i++) {
          const d = new Date(`${date}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() + i);
          const startsAt = `${d.toISOString().slice(0, 10)}T${clock}:00+03:00`;
          const res = await api("/api/experts/me/slots", { method: "POST", body: { startsAt, minutes } });
          if (res.ok) added++;
          else lastError = errorText(res);
        }
        add.disabled = false;
        if (!added) return ($("#slot-error").textContent = lastError);
        toast(t(`${added} free time(s) added.`, `أضيف ${added} وقت متاح.`) + (lastError ? ` ${lastError}` : ""));
        go("expert");
      };
    $$("[data-remove]").forEach(
      (b) =>
        (b.onclick = async () => {
          const res = await api(`/api/experts/me/slots/${encodeURIComponent(b.dataset.remove)}`, { method: "DELETE" });
          toast(res.ok ? t("Removed.", "تم الحذف.") : errorText(res));
          if (res.ok) go("expert");
        }),
    );
    $$("[data-cancel]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await confirmDialog({ title: t("Cancel this booking?", "إلغاء هذا الحجز؟"), body: t("The owner will no longer have this session and the time becomes free again.", "لن تبقى الجلسة لصاحب المشروع وسيصبح الوقت متاحاً مجدداً."), confirmLabel: t("Cancel booking", "إلغاء الحجز") });
          if (!ok.confirmed) return;
          const res = await api(`/api/experts/bookings/${encodeURIComponent(b.dataset.cancel)}/cancel`, { method: "POST" });
          toast(res.ok ? t("Booking cancelled.", "تم إلغاء الحجز.") : errorText(res));
          if (res.ok) go("expert");
        }),
    );
  },
};