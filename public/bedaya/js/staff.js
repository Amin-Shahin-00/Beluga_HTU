// Partner inbox and review (feature 15), admin (feature 16) and analytics (feature 22): M4's role-checked APIs.
// Government offices and SANAD have their own mock staff dashboards from M5 (/dashboard/*).
import { $, $$, api, confirmDialog, day, errorText, esc, go, jod, read, save, session, t, toast, tx } from "./core.js";

const STATUS = {
  submitted: ["New", "جديد", "info"],
  in_review: ["In review", "قيد المراجعة", "warning"],
  needs_documents: ["Documents requested", "مطلوب مستندات", "error"],
  approved: ["Approved", "مقبول", "done"],
  rejected: ["Rejected", "مرفوض", "error"],
};

const staffLinks = () => `<div class="grid-2" style="margin-top:20px">
  <div class="card"><h2>${t("Government office (demo)", "جهة حكومية (تجريبي)")}</h2><p class="muted">${t("Review, approve or return signed forms sent to your office.", "راجع النماذج الموقعة المرسلة لجهتك ووافق عليها أو أعدها.")}</p><a class="button" href="/dashboard/government">${t("Open", "فتح")}</a></div>
  <div class="card"><h2>${t("SANAD / MoDEE (demo)", "سند / وزارة الاقتصاد الرقمي (تجريبي)")}</h2><p class="muted">${t("Login codes, consents and signatures issued.", "رموز الدخول والموافقات والتواقيع الصادرة.")}</p><a class="button" href="/dashboard/sanad">${t("Open", "فتح")}</a></div>
  <div class="card"><h2>${t("Bedaya team (demo)", "فريق بداية (تجريبي)")}</h2><p class="muted">${t("Applicants' progress, warnings and the message outbox.", "تقدم المتقدمين والتنبيهات وصندوق الرسائل.")}</p><a class="button" href="/dashboard/admin">${t("Open", "فتح")}</a></div>
</div>`;

const noRole = (what) => `<p class="note">${t(
  `${what} needs a partner or admin role on your Bedaya account. The project owner assigns the first admin in Supabase; admins assign the rest from Management.`,
  `${what} تحتاج صلاحية شريك أو مدير على حسابك في بداية. يعيّن مالك المشروع أول مدير في Supabase، ثم يعيّن المديرون البقية من صفحة الإدارة.`,
)}</p>`;

async function inbox() {
  const res = await api("/api/platform/partner/inbox");
  return res;
}

// ---------- partner inbox ----------
export const partner = {
  layoutRole: "partner",
  async render() {
    if (!session.account) return `<h1>${t("Applications inbox", "صندوق الطلبات")}</h1><p class="note">${t("Sign in with a partner account.", "سجّل الدخول بحساب شريك.")}</p><div class="toolbar"><button class="primary" data-go="account">${t("Sign in", "تسجيل الدخول")}</button></div>${staffLinks()}`;
    const res = await inbox();
    if (!res.ok) return `<div class="eyebrow">${t("Partner", "الشريك")}</div><h1>${t("A better start for every application", "بداية أفضل لكل طلب")}</h1>${res.status === 403 ? noRole(t("The inbox", "صندوق الطلبات")) : `<p class="error">${esc(errorText(res))}</p>`}${staffLinks()}`;
    const rows = res.data.data;
    return `<div class="eyebrow">${t("Partner", "الشريك")} · ${esc(session.membership?.partner_key || t("all partners", "كل الشركاء"))}</div>
      <h1>${t("A better start for every application", "بداية أفضل لكل طلب")}</h1>
      <p class="subtitle">${t("Review complete profiles and keep owners informed.", "راجع الملفات وأبقِ أصحاب المشاريع على اطلاع.")}</p>
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
      <p id="inbox-empty" class="summary" hidden>${t("Nothing matches your search.", "لا شيء يطابق البحث.")}</p>${staffLinks()}`;
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
  layoutRole: "partner",
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
  layoutRole: "admin",
  async render() {
    if (!session.account) return `<h1>${t("Manage the launch framework", "إدارة إطار إطلاق المشاريع")}</h1><p class="note">${t("Sign in with an admin account.", "سجّل الدخول بحساب مدير.")}</p><div class="toolbar"><button class="primary" data-go="account">${t("Sign in", "تسجيل الدخول")}</button></div>${staffLinks()}`;
    const [catalog, users] = await Promise.all([api("/api/platform/admin/catalog"), api("/api/platform/admin/users")]);
    if (!catalog.ok) return `<div class="eyebrow">${t("Admin", "الإدارة")}</div><h1>${t("Manage the launch framework", "إدارة إطار إطلاق المشاريع")}</h1>${catalog.status === 403 ? noRole(t("Management", "الإدارة")) : `<p class="error">${esc(errorText(catalog))}</p>`}${staffLinks()}`;
    const entries = catalog.data.data;
    const tab = read("adminTab", "catalog");
    this.entries = entries;
    return `<div class="eyebrow">${t("Admin", "الإدارة")}</div>
      <h1>${t("Manage the launch framework", "إدارة إطار إطلاق المشاريع")}</h1>
      <p class="subtitle">${t("Rules, partners, demo slots and roles. Changes apply to new roadmaps.", "القواعد والشركاء والمواعيد التجريبية والصلاحيات. تنطبق التغييرات على المسارات الجديدة.")}</p>
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
           <label class="field"><span>${t("Role", "الصلاحية")}</span><select id="role-role"><option value="partner">partner</option><option value="admin">admin</option></select></label>
           <label class="field"><span>${t("Partner key (for partners)", "مفتاح الشريك (للشركاء)")}</span><select id="role-partner"><option value="">—</option>${entries.filter((e) => e.kind === "partner").map((e) => `<option>${esc(e.key)}</option>`).join("")}</select></label></div>
           <div class="toolbar"><button class="primary" id="assign">${t("Save role", "حفظ الصلاحية")}</button></div>`}`;
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
  layoutRole: "admin",
  async render() {
    const res = session.account ? await api("/api/platform/analytics") : null;
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
