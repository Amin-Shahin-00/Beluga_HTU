// Bedaya Copilot: the AI studies the business and prepares the work; the owner approves every piece
// (human in the loop). Stages: 1 understand (brief) → 2 plan (each step) → 3 documents → 4 sign & submit.
// Every AI draft, human edit and approval is a new version in the workspace (kind "copilot").
import { $, $$, api, day, errorText, esc, go, lang, needsAccount, ready, session, t, toast, tx } from "./core.js";
import { formatRich } from "./chat.js";
import { pdfFromText } from "./services.js";

const W = () => `/api/workspace/${session.business.id}/copilot`;
const getItem = (item) => api(`${W()}?item=${encodeURIComponent(item)}`);
const saveItem = (item, data, approved = false) => api(W(), { method: "POST", body: { item, data, approved } });
let state = null; // { ctx, brief, plan, docs: {id: row}, forms: [...], formApprovals: {id: row}, log }
let busy = null; // label of the running AI job

async function loadState() {
  const ctx = await api(`/api/copilot/context?lang=${lang}`);
  if (!ctx.ok) throw Object.assign(new Error(errorText(ctx)), { status: ctx.status });
  const c = ctx.data;
  const [brief, plan, forms, log, ...docRows] = await Promise.all([getItem("brief"), getItem("plan"), api("/api/documents"), api("/api/copilot/log"), ...c.writeDocs.map((d) => getItem(`doc:${d.id}`))]);
  const generated = forms.ok ? (forms.data.documents || []).filter((d) => d.kind === "generated") : [];
  const formRows = await Promise.all(generated.map((f) => getItem(`form:${f.id}`)));
  state = {
    ctx: c,
    brief: brief.ok ? brief.data.latest : null,
    plan: plan.ok ? plan.data.latest : null,
    docs: Object.fromEntries(c.writeDocs.map((d, i) => [d.id, docRows[i].ok ? docRows[i].data.latest : null])),
    forms: generated,
    formApprovals: Object.fromEntries(generated.map((f, i) => [f.id, formRows[i].ok ? formRows[i].data.latest : null])),
    log: log.ok ? log.data.data : [],
  };
}

// ---------------------------------------------------------------- stage status
const approved = (row) => Boolean(row?.approved);
function planDecided() {
  const p = state.plan?.data;
  if (!p) return false;
  return state.ctx.steps.every((s) => ["approved", "skipped"].includes(p.decisions?.[s.key]));
}
function stages() {
  const docsTotal = state.ctx.writeDocs.length + state.forms.length;
  const docsDone = state.ctx.writeDocs.filter((d) => approved(state.docs[d.id])).length + state.forms.filter((f) => approved(state.formApprovals[f.id])).length;
  return [
    { id: "understand", label: t("Understand", "الفهم"), done: approved(state.brief), open: true },
    { id: "plan", label: t("Plan", "الخطة"), done: planDecided(), open: approved(state.brief) },
    { id: "documents", label: t("Documents", "المستندات"), done: docsTotal > 0 && docsDone === docsTotal && state.forms.length > 0, open: planDecided(), count: `${docsDone}/${docsTotal}` },
    { id: "sign", label: t("Sign & submit", "التوقيع والإرسال"), done: state.forms.length > 0 && state.forms.every((f) => ["signed", "submitted", "approved"].includes(f.status)), open: planDecided() && docsDone > 0 },
  ];
}

// ---------------------------------------------------------------- reusable review card (draft → edit / revise → approve)
function reviewCard(item, title, row, { why = "", generateLabel, empty }) {
  const d = row?.data;
  const isApproved = approved(row);
  const status = !d ? ["", t("Not drafted", "لم تُكتب بعد")] : isApproved ? ["done", t("Approved by you", "اعتمدتها")] : ["warning", d.actor === "ai" ? t("AI draft · needs your review", "مسودة الذكاء الاصطناعي · تحتاج مراجعتك") : t("Edited · needs approval", "معدّلة · تحتاج اعتماد")];
  return `<div class="cp-card ${isApproved ? "approved" : ""}" data-item="${esc(item)}">
    <div class="cp-card-head"><div><h3>${esc(title)}</h3>${why ? `<small class="muted">${esc(why)}</small>` : ""}</div><span class="status ${status[0]}">${status[1]}</span></div>
    ${
      d
        ? `<div class="cp-draft" dir="auto">${formatRich(d.text).html}</div>
           <div class="cp-edit" hidden><textarea rows="12" dir="auto">${esc(d.text)}</textarea></div>
           <div class="toolbar tight cp-actions">
             ${isApproved ? `<button data-act="reopen">${t("Reopen for changes", "إعادة فتح للتعديل")}</button><button data-act="pdf"><i data-lucide="download"></i>${t("Download PDF", "تنزيل PDF")}</button>` : `<button class="primary" data-act="approve"><i data-lucide="check"></i>${t("Approve", "اعتماد")}</button><button data-act="edit"><i data-lucide="pencil"></i>${t("Edit myself", "تعديل بنفسي")}</button><button data-act="revise"><i data-lucide="sparkles"></i>${t("Ask AI to change", "اطلب تعديلاً من الذكاء الاصطناعي")}</button>`}
           </div>
           <form class="cp-revise" hidden><input maxlength="500" dir="auto" placeholder="${t("e.g. make it shorter, more formal, mention delivery…", "مثال: اجعله أقصر، أكثر رسمية، اذكر التوصيل…")}"><button class="primary">${t("Rewrite", "إعادة الكتابة")}</button></form>
           <small class="muted cp-meta">${t("Version", "النسخة")} ${row.version} · ${esc(day(row.created_at))}</small>`
        : `<p class="muted">${esc(empty)}</p><div class="toolbar tight"><button class="primary" data-act="generate"><i data-lucide="sparkles"></i>${esc(generateLabel)}</button></div>`
    }
  </div>`;
}

// ---------------------------------------------------------------- page
export const copilot = {
  async render() {
    const title = t("Saad, your AI copilot", "سعد، مستشارك الذكي");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(t("Saad", "سعد"))}`;
    try {
      await loadState();
    } catch (e) {
      return `<h1>${title}</h1><p class="error" role="alert">${esc(e.message)}</p><div class="toolbar"><button data-go="copilot">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    }
    const c = state.ctx;
    const st = stages();
    const first = (c.name || "").split(" ")[0];
    const nextStage = st.find((s) => !s.done && s.open);
    return `<div id="cp-root"><div class="cp-hero">
        <img src="/bedaya/mascot.png" alt="" width="110" height="130">
        <div><div class="eyebrow">${t("Saad · AI copilot", "سعد · المستشار الذكي")}</div>
          <h1>${first ? t(`Hi ${first}, I'm Saad. I've studied ${c.business?.name || "your business"}`, `أهلاً ${first}، أنا سعد. درستُ ${c.business?.name || "مشروعك"}`) : title}</h1>
          <p class="subtitle">${t("I prepare the work: a brief of your business, a plan of where to go and what to sign, and the paperwork. You stay in control: nothing counts until you approve it.", "أنا أجهز العمل: ملخص مشروعك، وخطة بالجهات وما توقعه، والأوراق المطلوبة. وأنت صاحب القرار: لا يُعتمد شيء قبل موافقتك.")}</p></div>
      </div>
      <ol class="cp-stepper">${st.map((s, i) => `<li class="${s.done ? "done" : s === nextStage ? "now" : ""} ${s.open ? "" : "locked"}"><a href="#cp-${s.id}"><span class="cp-dot">${s.done ? "✓" : i + 1}</span><span>${s.label}${s.count ? ` <small>${s.count}</small>` : ""}</span></a></li>`).join("")}</ol>
      ${busy ? `<div class="cp-busy" role="status"><span class="sn-spin"></span>${esc(busy)}</div>` : ""}

      <section class="cp-stage" id="cp-understand">
        <h2>1. ${t("Understand your business", "فهم مشروعك")}</h2>
        ${reviewCard("brief", t("Business brief", "ملخص المشروع"), state.brief, { why: t("How I understand your business. Correct anything I got wrong.", "كيف أفهم مشروعك. صحّح أي شيء أخطأتُ فيه."), generateLabel: t("Study my business", "ادرس مشروعي"), empty: t("I'll read your profile, roadmap and documents and write a one-page brief for you to check.", "سأقرأ ملفك ومسارك ومستنداتك وأكتب ملخصاً من صفحة واحدة لتراجعه.") })}
      </section>

      <section class="cp-stage ${st[1].open ? "" : "locked"}" id="cp-plan">
        <h2>2. ${t("Your launch plan", "خطة الإطلاق")}</h2>
        ${st[1].open ? planHtml() : `<p class="muted">${t("Approve the brief first; the plan builds on it.", "اعتمد الملخص أولاً؛ الخطة مبنية عليه.")}</p>`}
      </section>

      <section class="cp-stage ${st[2].open ? "" : "locked"}" id="cp-documents">
        <h2>3. ${t("Documents", "المستندات")}</h2>
        ${st[2].open ? docsHtml() : `<p class="muted">${t("Approve or skip every plan step first.", "اعتمد خطوات الخطة أو تخطَّها أولاً.")}</p>`}
      </section>

      <section class="cp-stage ${st[3].open ? "" : "locked"}" id="cp-sign">
        <h2>4. ${t("Sign & submit", "التوقيع والإرسال")}</h2>
        ${st[3].open ? signHtml() : `<p class="muted">${t("Approve your documents first. Only what you approve goes to signing.", "اعتمد مستنداتك أولاً. لا يُرسل للتوقيع إلا ما تعتمده.")}</p>`}
      </section>

      <section class="cp-stage"><h2>${t("Activity", "سجل النشاط")}</h2>
        ${state.log.length ? `<ul class="cp-log">${state.log.slice(0, 15).map((l) => `<li><span class="cp-who ${l.actor === "ai" ? "ai" : "you"}">${l.actor === "ai" ? t("AI", "الذكاء الاصطناعي") : t("You", "أنت")}</span> ${esc(logText(l))} <small class="muted">${esc(new Date(l.at).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", { dateStyle: "short", timeStyle: "short" }))}</small></li>`).join("")}</ul>` : `<p class="muted">${t("Every draft and every approval will be listed here.", "سيظهر هنا كل مسودة وكل اعتماد.")}</p>`}
      </section></div>`;
  },
  mount() {
    if (!state) return;
    bindReviewCards();
    bindPlan();
    bindDocs();
    const sign = $("#cp-go-sign");
    if (sign) sign.onclick = () => go("signing");
    window.lucide?.createIcons({ attrs: { width: 16, height: 16 } });
  },
};

function logText(l) {
  const what = l.title || l.item;
  const verbs = { draft: t("drafted", "كتب مسودة"), revise: t("revised", "عدّل"), edit: t("edited", "عدّلت"), approve: t("approved", "اعتمدت"), reopen: t("reopened", "أعدت فتح"), decide: t("decided on", "قررت في"), save: t("saved", "حفظت") };
  return `${verbs[l.action] || l.action} · ${what}`;
}

// ---------------------------------------------------------------- stage 2: plan
function planHtml() {
  const p = state.plan?.data;
  if (!p) return `<div class="cp-card"><p class="muted">${t(`I'll turn your ${state.ctx.steps.length} steps into a plan: where to go, how to do it, what to sign and where, and my recommendations for your kind of business.`, `سأحوّل خطواتك الـ${state.ctx.steps.length} إلى خطة: أين تذهب، وكيف، وماذا توقع وأين، مع توصياتي لنوع مشروعك.`)}</p><div class="toolbar tight"><button class="primary" id="cp-plan-gen"><i data-lucide="sparkles"></i>${t("Build my plan", "ابنِ خطتي")}</button></div></div>`;
  const decisions = p.decisions || {};
  const HOW = { esign: [t("Sign with SANAD in Bedaya", "توقيع عبر سند في بداية"), "info"], in_person: [t("In person", "حضورياً"), "warning"], shop: [t("At a shop", "من محل"), ""] };
  return `<div class="cp-recs card"><h3>${t("My recommendations for you", "توصياتي لك")}</h3><ul>${(p.recommendations || []).map((r) => `<li dir="auto">${esc(r)}</li>`).join("")}</ul></div>
    <div class="toolbar tight"><button id="cp-plan-all" class="primary"><i data-lucide="check-check"></i>${t("Approve all steps", "اعتماد كل الخطوات")}</button><button id="cp-plan-regen"><i data-lucide="refresh-cw"></i>${t("Rebuild recommendations", "إعادة بناء التوصيات")}</button></div>
    <div class="cp-steps">${state.ctx.steps
      .map((s) => {
        const dec = decisions[s.key] || "pending";
        return `<div class="cp-step ${dec}" data-step="${esc(s.key)}">
          <div class="cp-step-num">${s.status === "done" ? "✓" : s.order}</div>
          <div class="cp-step-body"><strong>${esc(s.title)}</strong> <span class="status ${HOW[s.how][1]}">${HOW[s.how][0]}</span>
            <dl class="kv cp-kv">
              <dt>${t("Where", "أين")}</dt><dd>${esc(s.office.name)}${s.office.address ? ` · ${esc(s.office.address)}` : ""}${s.office.website ? ` · <a href="${esc(s.office.website)}" target="_blank" rel="noopener noreferrer">${t("website", "الموقع")}</a>` : ""}</dd>
              <dt>${t("Sign", "التوقيع")}</dt><dd>${esc(s.sign)}</dd>
              ${s.papers.length ? `<dt>${t("Papers", "الأوراق")}</dt><dd>${esc(s.papers.join(lang === "ar" ? "، " : ", "))}</dd>` : ""}
              ${s.fee ? `<dt>${t("Fee", "الرسوم")}</dt><dd>${esc(s.fee)}</dd>` : ""}
              ${s.time ? `<dt>${t("Time", "المدة")}</dt><dd>${esc(s.time)}</dd>` : ""}
              ${s.tip ? `<dt>${t("Tip", "نصيحة")}</dt><dd>${esc(s.tip)}</dd>` : ""}
            </dl></div>
          <div class="cp-step-act">${
            dec === "approved"
              ? `<span class="status done">${t("Approved", "معتمدة")}</span><button class="linklike" data-decide="pending">${t("Undo", "تراجع")}</button>`
              : dec === "skipped"
                ? `<span class="status">${t("Skipped", "متخطاة")}</span><button class="linklike" data-decide="pending">${t("Undo", "تراجع")}</button>`
                : `<button class="primary" data-decide="approved">${t("Approve", "اعتماد")}</button><button data-decide="skipped">${t("Not for me", "لا تنطبق علي")}</button>`
          }</div></div>`;
      })
      .join("")}</div>`;
}

// ---------------------------------------------------------------- stage 3: documents
function docsHtml() {
  const c = state.ctx;
  const forms = state.forms;
  const FORM_STATUS = { ready_to_sign: t("Ready to sign", "جاهز للتوقيع"), signed: t("Signed", "موقّع"), submitted: t("Sent to the office", "أُرسل للجهة"), approved: t("Accepted by the office", "قبلته الجهة"), returned: t("Returned", "مُعاد") };
  return `<h3 class="cp-sub">${t("Written by the AI for you to review", "يكتبها الذكاء الاصطناعي لتراجعها")}</h3>
    <div class="cp-docs">${c.writeDocs.map((d) => reviewCard(`doc:${d.id}`, tx(d.title), state.docs[d.id], { why: tx(d.why), generateLabel: t("Write it for me", "اكتبه لي"), empty: t("Not written yet.", "لم يُكتب بعد.") })).join("")}</div>
    <h3 class="cp-sub">${t("Official forms Bedaya fills from your data", "نماذج رسمية تملؤها بداية من بياناتك")}</h3>
    ${
      forms.length
        ? `<div class="list">${forms
            .map((f) => {
              const ok = approved(state.formApprovals[f.id]);
              return `<div class="item"><div class="details"><strong>${esc(f.title || f.docType)}</strong><small>${esc(f.officeName ? tx(f.officeName) : f.office || "")} · ${esc(FORM_STATUS[f.status] || f.status)}${(f.missingFields || []).length ? ` · <span class="error">${t(`${f.missingFields.length} field(s) empty`, `${f.missingFields.length} حقل فارغ`)}</span>` : ""}</small></div>
                <a class="button" href="${esc(f.fileUrl)}" target="_blank" rel="noopener">${t("Review PDF", "مراجعة الملف")}</a>
                ${ok ? `<span class="status done">${t("Approved by you", "اعتمدته")}</span>` : `<button class="primary" data-approve-form="${esc(f.id)}" data-title="${esc(f.title || f.docType)}">${t("Approve", "اعتماد")}</button>`}</div>`;
            })
            .join("")}</div>`
        : `<div class="toolbar tight"><button class="primary" id="cp-forms-gen"><i data-lucide="file-text"></i>${t("Prepare my official forms", "جهّز نماذجي الرسمية")}</button></div>`
    }
    ${
      c.provide.length
        ? `<h3 class="cp-sub">${t("Papers only you can provide", "أوراق توفرها أنت")}</h3><ul class="cp-provide">${c.provide.map((p) => `<li><span class="status ${p.inVault ? "done" : "warning"}">${p.inVault ? t("In your vault", "في خزنتك") : t("Needed", "مطلوب")}</span> ${esc(p.name)}</li>`).join("")}</ul><div class="toolbar tight"><button data-go="documents"><i data-lucide="upload"></i>${t("Upload papers", "رفع الأوراق")}</button></div>`
        : ""
    }`;
}

// ---------------------------------------------------------------- stage 4: sign
function signHtml() {
  const approvedForms = state.forms.filter((f) => approved(state.formApprovals[f.id]));
  const approvedDocs = state.ctx.writeDocs.filter((d) => approved(state.docs[d.id]));
  return `<div class="cp-card">
    <p>${t(`You approved ${approvedForms.length} official form(s) and ${approvedDocs.length} document(s).`, `اعتمدت ${approvedForms.length} نموذجاً رسمياً و${approvedDocs.length} مستنداً.`)}</p>
    <ul>${approvedForms.map((f) => `<li>${esc(f.title || f.docType)}</li>`).join("")}</ul>
    <p class="muted">${t("Signing is your decision: you sign with SANAD on the next page, then Bedaya sends each form to its office.", "التوقيع قرارك: توقع عبر سند في الصفحة التالية، ثم ترسل بداية كل نموذج إلى جهته.")}</p>
    <div class="toolbar tight"><button class="primary" id="cp-go-sign" ${approvedForms.length ? "" : "disabled"}><i data-lucide="signature"></i>${t("Go to signing", "الانتقال إلى التوقيع")}</button></div></div>`;
}

// ---------------------------------------------------------------- actions
async function rerender() {
  const root = $("#cp-root");
  if (!root) return go("copilot");
  const y = window.scrollY;
  const html = await copilot.render();
  if (!root.isConnected) return;
  root.outerHTML = html;
  copilot.mount();
  window.scrollTo(0, y);
}
async function aiJob(label, fn) {
  if (busy) return toast(t("Saad is still working on the previous request.", "ما زال سعد يعمل على الطلب السابق."));
  busy = label;
  await rerender();
  try {
    await fn();
  } finally {
    busy = null;
    await rerender();
  }
}
function itemMeta(item) {
  if (item === "brief") return { title: t("business brief", "ملخص المشروع") };
  const d = state.ctx.writeDocs.find((x) => `doc:${x.id}` === item);
  return { title: d ? tx(d.title) : item };
}
async function draftWith(item, instruction, current) {
  const isBrief = item === "brief";
  const res = await api(`/api/copilot/${isBrief ? "brief" : "doc"}`, { method: "POST", body: { lang, ...(isBrief ? {} : { docId: item.slice(4) }), ...(instruction ? { instruction, current } : {}) }, timeoutMs: 120000 });
  if (!res.ok) return toast(errorText(res));
  const saved = await saveItem(item, { text: res.data.draft, actor: "ai", action: instruction ? "revise" : "draft", title: itemMeta(item).title, instruction: instruction || undefined }, false);
  if (!saved.ok) toast(errorText(saved));
}
function bindReviewCards() {
  $$(".cp-card[data-item]").forEach((card) => {
    const item = card.dataset.item;
    const row = item === "brief" ? state.brief : state.docs[item.slice(4)];
    const meta = itemMeta(item);
    card.querySelectorAll("[data-act]").forEach((b) => {
      const act = b.dataset.act;
      b.onclick = async () => {
        if (act === "generate") return aiJob(item === "brief" ? t("Studying your business… (about 20 seconds)", "أدرس مشروعك… (حوالي 20 ثانية)") : t(`Writing your ${meta.title}… (about 20 seconds)`, `أكتب ${meta.title}… (حوالي 20 ثانية)`), () => draftWith(item));
        if (act === "approve") {
          const r = await saveItem(item, { ...row.data, actor: "human", action: "approve" }, true);
          if (!r.ok) return toast(errorText(r));
          toast(t("Approved. Saved as a version.", "تم الاعتماد وحُفظ كنسخة."));
          return rerender();
        }
        if (act === "reopen") {
          await saveItem(item, { ...row.data, actor: "human", action: "reopen" }, false);
          return rerender();
        }
        if (act === "edit") {
          const edit = card.querySelector(".cp-edit");
          const draft = card.querySelector(".cp-draft");
          if (edit.hidden) {
            edit.hidden = false;
            draft.hidden = true;
            b.innerHTML = `<i data-lucide="save"></i>${t("Save my edit", "حفظ تعديلي")}`;
            window.lucide?.createIcons({ attrs: { width: 16, height: 16 } });
            return edit.querySelector("textarea").focus();
          }
          const text = edit.querySelector("textarea").value.trim();
          if (!text) return toast(t("The text is empty.", "النص فارغ."));
          await saveItem(item, { text, actor: "human", action: "edit", title: meta.title }, false);
          toast(t("Your edit is saved. Approve it when it's right.", "حُفظ تعديلك. اعتمده عندما يصبح جاهزاً."));
          return rerender();
        }
        if (act === "revise") {
          const form = card.querySelector(".cp-revise");
          form.hidden = false;
          form.querySelector("input").focus();
          form.onsubmit = (e) => {
            e.preventDefault();
            const instruction = form.querySelector("input").value.trim();
            if (!instruction) return;
            aiJob(t("Rewriting as you asked…", "أعيد الكتابة كما طلبت…"), () => draftWith(item, instruction, row.data.text));
          };
        }
        if (act === "pdf") {
          b.disabled = true;
          await pdfFromText(row.data.text, meta.title, `${meta.title.replace(/\s+/g, "-").toLowerCase()}.pdf`).catch(() => toast(t("The PDF couldn't be made.", "تعذر إنشاء ملف PDF.")));
          b.disabled = false;
        }
      };
    });
  });
}
function bindPlan() {
  const gen = $("#cp-plan-gen");
  const build = () =>
    aiJob(t("Building your plan… (about 20 seconds)", "أبني خطتك… (حوالي 20 ثانية)"), async () => {
      const res = await api("/api/copilot/plan", { method: "POST", body: { lang }, timeoutMs: 120000 });
      if (!res.ok) return toast(errorText(res));
      const keep = state.plan?.data?.decisions || {};
      await saveItem("plan", { recommendations: res.data.recommendations, decisions: keep, actor: "ai", action: state.plan ? "revise" : "draft", title: t("launch plan", "خطة الإطلاق") }, false);
    });
  if (gen) gen.onclick = build;
  const regen = $("#cp-plan-regen");
  if (regen) regen.onclick = build;
  const decide = async (decisions, label) => {
    const p = state.plan.data;
    const all = state.ctx.steps.every((s) => ["approved", "skipped"].includes(decisions[s.key]));
    await saveItem("plan", { ...p, decisions, actor: "human", action: all ? "approve" : "decide", title: label }, all);
    rerender();
  };
  $$("[data-step] [data-decide]").forEach(
    (b) =>
      (b.onclick = () => {
        const key = b.closest("[data-step]").dataset.step;
        const step = state.ctx.steps.find((s) => s.key === key);
        decide({ ...(state.plan.data.decisions || {}), [key]: b.dataset.decide }, step.title);
      }),
  );
  const all = $("#cp-plan-all");
  if (all) all.onclick = () => decide(Object.fromEntries(state.ctx.steps.map((s) => [s.key, state.plan.data.decisions?.[s.key] === "skipped" ? "skipped" : "approved"])), t("all plan steps", "كل خطوات الخطة"));
}
function bindDocs() {
  const formsGen = $("#cp-forms-gen");
  if (formsGen)
    formsGen.onclick = () =>
      aiJob(t("Filling your official forms…", "أملأ نماذجك الرسمية…"), async () => {
        const res = await api("/api/documents/generate", { method: "POST", body: {}, timeoutMs: 60000 });
        if (!res.ok) toast(errorText(res));
      });
  $$("[data-approve-form]").forEach(
    (b) =>
      (b.onclick = async () => {
        await saveItem(`form:${b.dataset.approveForm}`, { actor: "human", action: "approve", title: b.dataset.title }, true);
        toast(t("Form approved. It can now be signed.", "تم اعتماد النموذج ويمكن توقيعه الآن."));
        rerender();
      }),
  );
}

export const routes = { copilot };
