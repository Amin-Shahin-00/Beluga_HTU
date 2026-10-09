// The owner's core journey: roadmap (M4), documents + OCR + checker (M5), forms + signing (M5).
import { $, $$, api, bpath, docName, errorText, esc, go, jod, needsAccount, officeName, read, ready, reference, save, session, t, toast, tx } from "./core.js";

// ---------- roadmap (features 2, 10, 13) ----------
const TASK_STATUS = {
  pending: ["Not started", "لم يبدأ", ""],
  in_progress: ["In progress", "قيد التنفيذ", "warning"],
  done: ["Completed", "مكتمل", "done"],
};

export const roadmap = {
  async render() {
    if (!ready()) return `<h1>${t("A clear path to opening day", "مسار واضح ليوم الافتتاح")}</h1>${needsAccount(t("Your roadmap", "مسارك"))}`;
    const [rm, est, ref] = await Promise.all([api(bpath("roadmap")), api(bpath("estimate")), reference()]);
    if (!rm.ok) return `<h1>${t("Your roadmap", "مسارك")}</h1><p class="error">${esc(errorText(rm))}</p>`;
    const { steps, progress, nextAction } = rm.data.data;
    const e = est.ok ? est.data.data : null;
    const fee = e ? (e.range.maxJod === null ? `${e.range.minJod}+ ${t("JOD", "دينار")}` : `${e.range.minJod}–${e.range.maxJod} ${t("JOD", "دينار")}`) : "—";
    const days = e?.estimatedDays ?? null;
    const home = session.profile.business.homeBased;
    const homeTrack = home ? await api(bpath("home-track")) : null;
    const name = tx({ en: session.profile.business.nameEn, ar: session.profile.business.nameAr });
    return `<div class="eyebrow">${esc(name)}</div>
      <h1>${t("A clear path to opening day", "مسار واضح ليوم الافتتاح")}</h1>
      <p class="subtitle">${nextAction ? t(`Next step: ${nextAction.title_en}.`, `الخطوة التالية: ${nextAction.title_ar}.`) : t("Every step is complete. Well done!", "اكتملت كل الخطوات. أحسنت!")}</p>
      <div class="metrics">
        <div class="metric"><b>${progress}%</b><small>${t("Roadmap complete", "اكتمال المسار")}</small></div>
        <div class="metric"><b>${esc(fee)}</b><small>${t("Official fees (range)", "الرسوم الرسمية (نطاق)")}</small></div>
        <div class="metric"><b>${days === null ? "—" : days}</b><small>${t("Days, if steps run back to back", "أيام إذا تتابعت الخطوات")}</small></div>
      </div>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <div class="list">${steps
        .map((s, i) => {
          const st = TASK_STATUS[s.status] || TASK_STATUS.pending;
          const isNext = nextAction && s.id === nextAction.id;
          const feeNote = s.details?.fee?.note ? tx(s.details.fee.note) : "";
          const timeNote = s.details?.days?.note ? tx(s.details.days.note) : "";
          const docs = (s.documents || []).map((d) => docName(ref, d)).join(lang() === "ar" ? "، " : ", ");
          const action = s.locked
            ? `<button data-locked title="${t("Complete the previous step first", "أكمل الخطوة السابقة أولاً")}" aria-label="${t("Locked", "مقفل")}"><i data-lucide="lock-keyhole"></i></button>`
            : s.status === "done"
              ? `<button data-task="${s.id}" data-status="pending">${t("Undo", "تراجع")}</button>`
              : s.status === "in_progress"
                ? `<button class="primary" data-task="${s.id}" data-status="done">${t("Mark done", "تم")}</button>`
                : `<button ${isNext ? 'class="primary"' : ""} data-task="${s.id}" data-status="in_progress">${t("Start", "ابدأ")}</button>`;
          return `<div class="item"><span class="lead">${String(i + 1).padStart(2, "0")}</span>
            <div class="details"><strong>${esc(tx({ en: s.title_en, ar: s.title_ar }))}</strong>
              <small>${esc(officeName(ref, s.office))}${feeNote ? ` · ${esc(feeNote)}` : ""}</small>
              ${timeNote ? `<small>${esc(timeNote)}</small>` : ""}
              ${docs ? `<small>${t("Papers", "الأوراق")}: ${esc(docs)}</small>` : ""}</div>
            <span class="status ${st[2]}">${s.locked ? t("Locked", "مقفل") : tx(st)}</span>${action}</div>`;
        })
        .join("")}</div>
      ${e?.scopeWarning ? `<p class="note">${esc(e.scopeWarning)}</p>` : ""}
      ${homeTrack?.ok ? `<h2 style="margin-top:28px">${t("Home business rules", "قواعد المشروع المنزلي")}</h2><div class="list">${homeTrack.data.facts.map((f) => `<div class="item"><div class="details"><small>${esc(tx(f.text))}</small></div></div>`).join("")}</div>` : ""}
      <p class="note">${t("Fees and steps come from official Jordanian sources (MIT eRegulations, GAM, JFDA, chambers). Confirm with the office before paying.", "الرسوم والخطوات من مصادر أردنية رسمية (دليل المستثمر لوزارة الصناعة والتجارة، الأمانة، الغذاء والدواء، الغرف). تأكد من الجهة قبل الدفع.")}</p>
      <div class="toolbar"><button class="primary" data-go="documents">${t("Prepare documents", "تجهيز المستندات")}</button><button data-go="plan">${t("See the business plan", "عرض خطة العمل")}</button></div>`;
  },
  mount() {
    $$("[data-locked]").forEach((b) => (b.onclick = () => toast(t("Complete the previous step first.", "أكمل الخطوة السابقة أولاً."))));
    $$("[data-task]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const res = await api(`/api/platform/tasks/${b.dataset.task}`, { method: "PATCH", body: { status: b.dataset.status } });
          if (!res.ok) {
            b.disabled = false;
            toast(res.status === 409 ? t("Complete the previous step first.", "أكمل الخطوة السابقة أولاً.") : errorText(res));
            return;
          }
          toast(t("Progress saved.", "تم حفظ التقدم."));
          go("roadmap");
        }),
    );
  },
};
const lang = () => document.documentElement.lang;

// ---------- documents (features 3 and 9) ----------
const UPLOAD_TYPES = ["national_id", "lease_contract", "property_ownership_document", "property_owner_approval", "building_documents", "building_residents_consent", "product_label", "registration_certificate", "passport"];
const M4_KIND = { national_id: "identity", passport: "identity", lease_contract: "address", property_ownership_document: "address", registration_certificate: "registration", signed: "signed" };
const SAMPLES = [
  ["layla-national-id.png", ["Clear ID sample", "نموذج هوية واضح"]],
  ["layla-national-id-blurry.png", ["Blurry ID sample", "نموذج هوية غير واضح"]],
  ["layla-national-id-expired.png", ["Expired ID sample", "نموذج هوية منتهية"]],
];
const SEVERITY = { error: "error", warning: "warning", info: "info" };

export const documents = {
  guard: "identity",
  async render() {
    const [docs, check, ref] = await Promise.all([api("/api/documents"), api("/api/documents/check"), reference()]);
    const uploads = docs.ok ? docs.data.documents.filter((d) => d.kind === "upload") : [];
    const c = check.ok ? check.data : null;
    const warningsFor = (id) => c?.files.find((f) => f.fileId === id);
    return `<div class="eyebrow">${t("Document vault", "خزنة المستندات")}</div>
      <h1>${t("Your documents, together", "مستنداتك في مكان واحد")}</h1>
      <p class="subtitle">${t("Upload once. Bedaya reads each file, checks it, and reuses it in your forms.", "ارفع مرة واحدة. تقرأ بداية كل ملف وتفحصه وتعيد استخدامه في نماذجك.")}</p>
      ${c ? `<div class="metrics"><div class="metric"><b>${c.summary.ok}/${c.summary.files}</b><small>${t("Files ready", "ملفات جاهزة")}</small></div><div class="metric"><b>${c.summary.expired + c.summary.blurry}</b><small>${t("Need a new copy", "تحتاج نسخة جديدة")}</small></div><div class="metric"><b>${c.summary.missing}</b><small>${t("Still missing", "ما زالت ناقصة")}</small></div></div>` : ""}
      <h2>${t("Uploaded", "المرفوعة")}</h2>
      <div class="list">${
        uploads.length
          ? uploads
              .map((d) => {
                const f = warningsFor(d.id);
                const status = f?.status === "error" ? "error" : f?.status === "warning" ? "warning" : "";
                const msgs = (f?.warnings || []).map((w) => `<small class="${w.severity === "error" ? "error" : ""}">${esc(tx(w.message))}</small>`).join("");
                return `<div class="item"><span class="lead">${t("FILE", "ملف")}</span><div class="details"><strong>${esc(f ? tx(f.docName) : docName(ref, d.docType))}</strong><small>${esc(d.fileName)}</small>${msgs}</div>
                  <span class="status ${status}">${status === "error" ? t("Needs a new copy", "تحتاج نسخة جديدة") : status === "warning" ? t("Check", "راجع") : t("Looks good", "سليم")}</span>
                  <div class="inline-actions"><a class="button" href="${esc(d.fileUrl)}" target="_blank" rel="noopener">${t("View", "عرض")}</a><button data-ocr="${d.id}">${t("Details", "التفاصيل")}</button></div></div>`;
              })
              .join("")
          : `<div class="item"><div class="details"><small>${t("Nothing uploaded yet.", "لا توجد ملفات بعد.")}</small></div></div>`
      }</div>
      ${c?.missing?.length ? `<h2 style="margin-top:28px">${t("Still needed", "ما زال مطلوباً")}</h2><div class="list">${c.missing
        .map((m) => `<div class="item"><div class="details"><strong>${esc(tx(m.docName))}</strong><small>${esc(tx(m.message))}</small></div><span class="status ${SEVERITY[m.severity] || ""}">${m.obtainedAt ? t("Comes later", "لاحقاً") : t("Missing", "ناقص")}</span></div>`)
        .join("")}</div>` : ""}
      <h2 style="margin-top:28px">${t("Add a document", "إضافة مستند")}</h2>
      <div class="card">
        <label class="field"><span>${t("What is it?", "ما نوعه؟")}</span><select id="doc-type">${UPLOAD_TYPES.map((d) => `<option value="${d}">${esc(docName(ref, d))}</option>`).join("")}</select></label>
        <label class="field"><span>${t("File (PDF, JPG, PNG or WEBP, up to 10 MB)", "الملف (PDF أو JPG أو PNG أو WEBP، حتى 10 ميجابايت)")}</span><input type="file" id="doc-file" accept=".pdf,.png,.jpg,.jpeg,.webp"></label>
        <p id="file-feedback" class="muted" role="status"></p><div id="file-preview" class="file-preview"></div>
        <div class="toolbar"><button class="primary" id="upload" disabled>${t("Upload document", "رفع مستند")}</button></div>
        <p class="muted">${t("Or try a sample:", "أو جرّب نموذجاً:")}</p>
        <div class="chips">${SAMPLES.map(([file, label]) => `<button data-sample="${file}">${esc(tx(label))}</button>`).join("")}</div>
      </div>
      <p class="note">${t("OCR is simulated in this build: it returns realistic results for the sample IDs. Files stay on this Bedaya server.", "القراءة الآلية محاكاة في هذه النسخة وتعيد نتائج واقعية لنماذج الهوية. تبقى الملفات على خادم بداية.")}</p>
      <div class="toolbar"><button class="primary" data-go="signing">${t("Prepare and sign forms", "تجهيز النماذج وتوقيعها")}</button></div>`;
  },
  mount() {
    let chosen = null;
    let previewUrl = null;
    const clear = () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      $("#file-preview").replaceChildren();
    };
    // File checks from Member 3's document picker: type, size and non-empty.
    $("#doc-file").onchange = (e) => {
      clear();
      const file = e.target.files[0];
      chosen = null;
      $("#upload").disabled = true;
      if (!file) return;
      const okType = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) && /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
      if (!okType || file.size === 0 || file.size > 10 * 1024 * 1024) {
        $("#file-feedback").textContent = t("Choose a non-empty PDF, JPG, PNG or WEBP under 10 MB.", "اختر ملف PDF أو JPG أو PNG أو WEBP غير فارغ وأقل من 10 ميجابايت.");
        e.target.value = "";
        return;
      }
      chosen = file;
      $("#file-feedback").textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`;
      $("#upload").disabled = false;
      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = previewUrl;
        img.alt = t("Preview", "معاينة");
        $("#file-preview").append(img);
      }
    };
    $("#upload").onclick = async () => {
      if (chosen) await uploadFile(chosen, $("#doc-type").value, $("#upload"));
    };
    $$("[data-sample]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const res = await fetch(`/samples/${b.dataset.sample}`);
          const blob = await res.blob();
          await uploadFile(new File([blob], b.dataset.sample, { type: "image/png" }), "national_id", b);
        }),
    );
    $$("[data-ocr]").forEach((b) => (b.onclick = () => (save("ocrDoc", b.dataset.ocr), go("ocr"))));
  },
};

/** Uploads to M5's vault (mock OCR), then mirrors the file into M4's private Supabase vault for the bank file. */
async function uploadFile(file, docType, button) {
  button.disabled = true;
  const form = new FormData();
  form.append("file", file);
  form.append("docType", docType);
  const res = await api("/api/documents/upload", { method: "POST", form, timeoutMs: 60000 });
  if (!res.ok) {
    button.disabled = false;
    toast(errorText(res));
    return;
  }
  const doc = res.data.document;
  save("ocrDoc", doc.id);
  if (ready() && ["application/pdf", "image/jpeg", "image/png"].includes(file.type)) await mirrorToM4(file, docType, doc.ocr).catch(() => null);
  toast(t("Uploaded and read.", "تم الرفع والقراءة."));
  go("ocr");
}

async function mirrorToM4(file, docType, ocr) {
  const expiresOn = ocr?.fields?.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(ocr.fields.expiryDate) ? ocr.fields.expiryDate : undefined;
  const meta = await api(bpath("documents/upload"), {
    method: "POST",
    body: { filename: file.name.slice(0, 180), mimeType: file.type, sizeBytes: file.size, kind: M4_KIND[docType] || "other", ...(expiresOn ? { expiresOn } : {}) },
  });
  if (!meta.ok) return;
  const put = await fetch(meta.data.upload.signedUrl, { method: "PUT", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file });
  if (!put.ok) return;
  const id = meta.data.data.id;
  const fin = await api(`/api/platform/documents/${id}/finalize`, { method: "POST", body: {} });
  if (!fin.ok || !ocr) return;
  const fields = Object.fromEntries(Object.entries(ocr.fields || {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, 500)]));
  await api(`/api/platform/documents/${id}/ocr`, {
    method: "POST",
    body: { consent: true, result: { fileId: id, fileName: file.name.slice(0, 180), docType: ocr.docType, fields, confidence: ocr.confidence, imageQuality: ocr.imageQuality } },
  });
}

// ---------- OCR review (feature 3) ----------
const FIELD_LABELS = {
  name: ["Full name", "الاسم الكامل"],
  nameEn: ["Name (English)", "الاسم بالإنجليزية"],
  nationalId: ["National ID", "الرقم الوطني"],
  birthDate: ["Date of birth", "تاريخ الميلاد"],
  expiryDate: ["Expiry date", "تاريخ الانتهاء"],
  issueDate: ["Issue date", "تاريخ الإصدار"],
  documentNumber: ["Document number", "رقم الوثيقة"],
};

export const ocr = {
  guard: "identity",
  async render() {
    const res = await api("/api/documents");
    const uploads = res.ok ? res.data.documents.filter((d) => d.kind === "upload") : [];
    const doc = uploads.find((d) => d.id === read("ocrDoc", "")) || uploads[0];
    if (!doc) return `<h1>${t("Check the extracted details", "تحقق من البيانات المستخرجة")}</h1><p class="note">${t("Upload a document first.", "ارفع مستنداً أولاً.")}</p><div class="toolbar"><button class="primary" data-go="documents">${t("Go to documents", "الذهاب إلى المستندات")}</button></div>`;
    const o = doc.ocr || { fields: {}, confidence: 0, imageQuality: 0 };
    const edits = read(`ocrEdits.${doc.id}`, {});
    const blurry = o.confidence < 0.6 || o.imageQuality < 0.5;
    return `<div class="eyebrow">${t("Document reading", "قراءة المستند")}</div>
      <h1>${t("Check the extracted details", "تحقق من البيانات المستخرجة")}</h1>
      <p class="subtitle">${t("You stay in control of what goes into your forms.", "أنت تتحكم بالبيانات المستخدمة في نماذجك.")}</p>
      <div class="split">
        <div class="preview">${doc.mimeType?.startsWith("image/") ? `<img src="${esc(doc.fileUrl)}" alt="${esc(doc.fileName)}" style="max-width:100%;border-radius:6px">` : `<h2>${esc(doc.fileName)}</h2><div class="lines"></div><div class="lines"></div><div class="lines"></div><a href="${esc(doc.fileUrl)}" target="_blank" rel="noopener">${t("Open the file", "فتح الملف")}</a>`}
          <p class="muted" style="margin-top:12px">${t("Reading confidence", "دقة القراءة")}: ${Math.round(o.confidence * 100)}% · ${t("Image quality", "جودة الصورة")}: ${Math.round(o.imageQuality * 100)}%</p></div>
        <div>${Object.entries(o.fields || {})
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => `<label class="field"><span>${esc(tx(FIELD_LABELS[k] || [k, k]))}</span><input data-field="${esc(k)}" value="${esc(edits[k] ?? v)}" dir="auto"></label>`)
          .join("")}</div>
      </div>
      ${blurry ? `<p class="note">${t("This copy is hard to read. Upload a clearer photo: flat, in good light, without glare.", "هذه النسخة صعبة القراءة. ارفع صورة أوضح: مسطحة وبإضاءة جيدة ودون انعكاس.")}</p>` : `<p class="note">${t("Edit anything that was read wrongly before confirming.", "عدّل أي حقل قُرئ بشكل خاطئ قبل التأكيد.")}</p>`}
      <div class="toolbar"><button class="primary" id="confirm-ocr">${t("Confirm details", "تأكيد البيانات")}</button><button data-go="documents">${t("Upload a clearer copy", "رفع نسخة أوضح")}</button></div>`;
  },
  mount() {
    const btn = $("#confirm-ocr");
    if (!btn) return;
    btn.onclick = async () => {
      const id = read("ocrDoc", "");
      save(`ocrEdits.${id}`, Object.fromEntries($$("[data-field]").map((i) => [i.dataset.field, i.value.trim()])));
      if (ready()) await api("/api/platform/consents", { method: "POST", body: { purpose: "ocr_processing", granted: true } });
      toast(t("Details confirmed.", "تم تأكيد البيانات."));
      go("signing");
    };
  },
};

// ---------- forms and signing (feature 4) ----------
const FORM_STATUS = {
  ready_to_sign: ["Ready for review", "جاهز للمراجعة", ""],
  signed: ["Signed", "موقّع", "done"],
  submitted: ["Sent to the office", "أرسل للجهة", "info"],
  approved: ["Approved", "مقبول", "done"],
  returned: ["Returned", "مُعاد", "error"],
};

export const signing = {
  guard: "identity",
  async render() {
    const res = await api("/api/documents");
    const forms = res.ok ? res.data.documents.filter((d) => d.kind === "generated") : [];
    const toSign = forms.filter((f) => f.status === "ready_to_sign").length;
    const toSend = forms.filter((f) => f.status === "signed").length;
    const returned = forms.filter((f) => f.status === "returned").length;
    return `<div class="eyebrow">${t("Government forms", "النماذج الحكومية")}</div>
      <h1>${t("Review. Sign. Move forward.", "راجع ووقّع وتقدم.")}</h1>
      <p class="subtitle">${t("Bedaya fills every form your case needs from your identity, answers and documents.", "تملأ بداية كل نموذج تحتاجه حالتك من هويتك وإجاباتك ومستنداتك.")}</p>
      <div class="list">${
        forms.length
          ? forms
              .map((f) => {
                const st = FORM_STATUS[f.status] || [f.status, f.status, ""];
                const missing = (f.missingFields || []).length;
                return `<div class="item"><span class="lead">${esc(f.office || "")}</span><div class="details"><strong>${esc(f.title || f.docType)}</strong>
                  <small>${esc(f.officeName ? tx(f.officeName) : "")}</small>
                  ${missing ? `<small class="error">${t(`${missing} field(s) still empty`, `${missing} حقل ما زال فارغاً`)}: ${esc(f.missingFields.join(", "))}</small>` : ""}
                  ${f.review?.note ? `<small class="error">${t("Office note", "ملاحظة الجهة")}: ${esc(f.review.note)}</small>` : ""}
                  ${f.signature?.signatureRef ? `<small class="ltr">${esc(f.signature.signatureRef)}</small>` : ""}</div>
                  <span class="status ${st[2]}">${tx(st)}</span><a class="button" href="${esc(f.fileUrl)}" target="_blank" rel="noopener">${t("View", "عرض")}</a></div>`;
              })
              .join("")
          : `<div class="item"><div class="details"><small>${t("No forms yet. Prepare them from your profile and documents.", "لا توجد نماذج بعد. جهزها من ملفك ومستنداتك.")}</small></div></div>`
      }</div>
      ${toSign ? `<label class="option" style="margin-top:20px"><input type="checkbox" id="sign-consent">${t("I reviewed the forms and agree to sign them with SANAD (demo signature, not legally binding).", "راجعت النماذج وأوافق على توقيعها عبر سند (توقيع تجريبي غير ملزم قانونياً).")}</label>` : ""}
      <div class="toolbar">
        <button ${forms.length ? "" : 'class="primary"'} id="generate">${forms.length ? (returned ? t("Regenerate returned forms", "إعادة تجهيز النماذج المعادة") : t("Refresh forms", "تحديث النماذج")) : t("Prepare my forms", "تجهيز نماذجي")}</button>
        ${toSign ? `<button class="primary" id="sign-all" disabled>${t(`Sign all ${toSign} forms`, `توقيع جميع النماذج (${toSign})`)}</button>` : ""}
        ${toSend ? `<button class="primary" id="submit-all">${t(`Send ${toSend} signed form(s) to the offices`, `إرسال ${toSend} نموذج موقّع إلى الجهات`)}</button>` : ""}
      </div>
      <p class="note">${t("Demo forms: every PDF says DEMO FORM - NOT OFFICIAL until the official templates arrive.", "نماذج تجريبية: كل ملف يحمل عبارة نموذج تجريبي غير رسمي حتى وصول النماذج الرسمية.")}</p>`;
  },
  mount() {
    $("#generate").onclick = async (e) => {
      e.target.disabled = true;
      const res = await api("/api/documents/generate", { method: "POST", body: {}, timeoutMs: 60000 });
      toast(res.ok ? t(`${res.data.generated.length} form(s) prepared.`, `تم تجهيز ${res.data.generated.length} نموذج.`) : errorText(res));
      go("signing");
    };
    const consent = $("#sign-consent");
    if (consent) consent.onchange = () => ($("#sign-all").disabled = !consent.checked);
    const sign = $("#sign-all");
    if (sign)
      sign.onclick = async () => {
        sign.disabled = true;
        const res = await api("/api/documents/sign-all", { method: "POST", body: {}, timeoutMs: 60000 });
        if (!res.ok) return (toast(errorText(res)), (sign.disabled = false));
        if (ready()) {
          await api("/api/platform/consents", { method: "POST", body: { purpose: "e_signature", granted: true } });
          await mirrorSigned();
        }
        save("lastSigned", res.data.signed?.length || 0);
        toast(t("Forms signed.", "تم توقيع النماذج."));
        go("signing");
      };
    const submit = $("#submit-all");
    if (submit)
      submit.onclick = async () => {
        submit.disabled = true;
        const res = await api("/api/documents/submit", { method: "POST", body: {} });
        if (!res.ok) return (toast(errorText(res)), (submit.disabled = false));
        save("lastSubmitted", res.data.submitted?.length || 0);
        go("signed");
      };
  },
};

/** Copies each signed form into the business vault (kind "signed") so it can go in the bank file. Skips ones already copied. */
async function mirrorSigned() {
  const [forms, vault] = await Promise.all([api("/api/documents"), api(bpath("documents"))]);
  if (!forms.ok || !vault.ok) return;
  const have = new Set(vault.data.data.map((d) => d.filename));
  for (const f of forms.data.documents.filter((d) => d.kind === "generated" && d.status === "signed" && d.fileUrl)) {
    const name = `${String(f.docType || f.title || "form").replace(/[^\w.-]+/g, "-").slice(0, 120)}-signed.pdf`;
    if (have.has(name)) continue;
    const pdf = await fetch(f.fileUrl, { credentials: "same-origin" }).catch(() => null);
    if (!pdf?.ok) continue;
    await mirrorToM4(new File([await pdf.blob()], name, { type: "application/pdf" }), "signed", null);
  }
}

export const signed = {
  guard: "identity",
  async render() {
    const res = await api("/api/documents");
    const forms = res.ok ? res.data.documents.filter((d) => d.kind === "generated") : [];
    const sent = forms.filter((f) => ["submitted", "approved", "returned"].includes(f.status));
    return `<div class="eyebrow">${t("Forms sent", "تم إرسال النماذج")}</div>
      <h1>${t("Your documents are signed and on their way", "تم توقيع مستنداتك وإرسالها")}</h1>
      <p class="subtitle">${t("Each office reviews its own form. You'll get a notification when they approve or return one.", "تراجع كل جهة نموذجها. سيصلك إشعار عند الموافقة أو الإعادة.")}</p>
      <div class="success-mark" aria-hidden="true">✓</div>
      <div class="list">${sent
        .map((f) => `<div class="item"><span class="lead">${esc(f.office || "")}</span><div class="details"><strong>${esc(f.title)}</strong><small>${esc(f.officeName ? tx(f.officeName) : "")}</small></div><span class="status ${f.status === "returned" ? "error" : f.status === "approved" ? "done" : "info"}">${tx(FORM_STATUS[f.status])}</span></div>`)
        .join("")}</div>
      <p class="note">${t("Demo: the Bedaya admin account plays each government office on the staff dashboard, where it approves or returns these forms.", "تجريبي: يمثل حساب إدارة بداية كل جهة حكومية في لوحة الموظفين، ومنها يوافق على النماذج أو يعيدها.")}</p>
      <div class="toolbar"><button class="primary" data-go="incubators">${t("Explore incubators", "استكشاف الحاضنات")}</button><button data-go="roadmap">${t("Back to the roadmap", "العودة إلى المسار")}</button></div>`;
  },
};
