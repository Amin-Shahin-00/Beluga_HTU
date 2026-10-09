// Assistant (M5 AI), notifications (M4 + M5), appointments, business plan, compliance, location (M4),
// and e-invoicing (M5).
import { $, $$, api, bpath, confirmDialog, day, download, errorText, esc, go, jod, lang, loadScript, loadStyle, needsAccount, ready, sanadValue, session, t, time, toast, tx } from "./core.js";

// ---------- assistant (feature 8), with Member 3's chat behaviour ----------
const history = []; // kept for this visit only; sent with each question (last 10 turns)
const SUGGESTIONS = [
  ["What documents do I need for a home business licence?", "شو الوثائق المطلوبة لرخصة المهن المنزلية؟"],
  ["Can I run a bakery from home?", "هل أستطيع فتح مخبز من البيت؟"],
  ["How much does it cost to register an LLC?", "كم رسوم تسجيل شركة ذات مسؤولية محدودة؟"],
  ["Do I need to register in social security if I work alone?", "هل لازم أسجل بالضمان إذا ما عندي موظفين؟"],
];
const SOURCE_LABEL = {
  mock: ["Answer from Bedaya's verified data · no live AI", "إجابة من بيانات بداية الموثقة · بدون ذكاء اصطناعي مباشر"],
  llm: ["Live AI answer from Bedaya's data", "إجابة ذكاء اصطناعي مباشرة من بيانات بداية"],
  cache: ["Saved AI answer", "إجابة ذكاء اصطناعي محفوظة"],
  fallback: ["Data answer · live AI unavailable", "إجابة من البيانات · الذكاء الاصطناعي غير متاح"],
};

export const assistant = {
  async render() {
    return `<div class="eyebrow">${t("Assistant", "المساعد")}</div>
      <h1>${t("A little clarity, whenever you need it", "إجابة واضحة عندما تحتاجها")}</h1>
      <p class="subtitle">${t("Ask about fees, documents, offices or your next step, in Arabic or English.", "اسأل عن الرسوم أو المستندات أو الجهات أو خطوتك التالية، بالعربية أو الإنجليزية.")}</p>
      <div class="chips">${SUGGESTIONS.map((s) => `<button data-question="${esc(tx(s))}">${esc(tx(s))}</button>`).join("")}</div>
      <div id="messages"><div class="bubble assistant"><small>${t("Bedaya", "بداية")}</small><p>${t("Hello! I answer only from official Jordanian sources. When I don't know something, I'll tell you which office to ask.", "مرحباً! أجيب فقط من مصادر أردنية رسمية. وإذا لم أعرف شيئاً سأخبرك بالجهة التي تسألها.")}</p></div></div>
      <form class="chat-form" id="chat-form" novalidate><input id="question" maxlength="1000" aria-label="${t("Your question", "سؤالك")}" placeholder="${t("Type your question", "اكتب سؤالك")}" dir="auto"><button class="primary" id="send">${t("Send", "إرسال")}</button></form>
      <div class="toolbar"><button id="chat-clear">${t("Clear conversation", "مسح المحادثة")}</button></div>
      <p class="note" id="chat-disclaimer">${t("No government endorsement. Confirm current requirements with the relevant authority.", "لا تمثل جهة حكومية. تأكد من المتطلبات الحالية لدى الجهة المختصة.")}</p>`;
  },
  mount() {
    const box = $("#messages");
    let busy = false;
    for (const turn of history) bubble(turn.content, turn.role === "user" ? "user" : "assistant");
    function bubble(text, kind) {
      const el = document.createElement("div");
      el.className = `bubble ${kind === "user" ? "" : "assistant"}`;
      el.textContent = text;
      el.dir = "auto";
      box.append(el);
      el.scrollIntoView({ block: "nearest" });
      return el;
    }
    function link(container, title, url) {
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol) || typeof title !== "string") return;
        const a = document.createElement("a");
        a.href = u.href;
        a.textContent = title;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        container.append(a);
      } catch {
        /* skip malformed links */
      }
    }
    async function send(message) {
      if (busy) return;
      message = message.trim();
      if (!message) return toast(t("Please enter a question.", "يرجى كتابة سؤال."));
      busy = true;
      $("#send").disabled = true;
      bubble(message, "user");
      $("#question").value = "";
      const loading = bubble(t("Thinking…", "لحظة…"), "assistant");
      const res = await api("/api/ai/chat", { method: "POST", body: { message, history: history.slice(-10), ...(session.profile ? { profile: session.profile } : {}) }, timeoutMs: 18000 });
      if (res.ok && typeof res.data.answer === "string" && res.data.answer.trim()) {
        const r = res.data;
        loading.textContent = r.answer;
        loading.dir = r.lang === "ar" ? "rtl" : "ltr";
        const label = document.createElement("small");
        label.className = "answer-source";
        label.textContent = tx(SOURCE_LABEL[r.source] || SOURCE_LABEL.mock);
        loading.append(label);
        const links = document.createElement("div");
        links.className = "answer-links";
        (r.sources || []).forEach((s) => s && link(links, s.title, s.url));
        (r.offices || []).forEach((o) => o && link(links, o.name, o.website));
        if (links.childNodes.length) loading.append(links);
        if (typeof r.disclaimer === "string") $("#chat-disclaimer").textContent = r.disclaimer;
        history.push({ role: "user", content: message }, { role: "assistant", content: r.answer });
        if (history.length > 10) history.splice(0, history.length - 10);
      } else {
        loading.classList.add("failure");
        loading.textContent = res.status === 0 ? errorText(res) : `${t("No answer received", "لم تصل إجابة")}: ${errorText(res)}`;
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = t("Ask again", "اسأل مرة أخرى");
        retry.onclick = () => send(message);
        loading.append(document.createElement("br"), retry);
      }
      busy = false;
      $("#send").disabled = false;
      $("#question").focus();
    }
    $("#chat-form").onsubmit = (e) => (e.preventDefault(), send($("#question").value));
    $$("[data-question]").forEach((b) => (b.onclick = () => send(b.dataset.question)));
    $("#chat-clear").onclick = () => {
      history.length = 0;
      box.replaceChildren();
      bubble(t("Conversation cleared. Ask about starting a business in Jordan.", "تم مسح المحادثة. اسأل عن بدء مشروع في الأردن."), "assistant");
    };
  },
};

// ---------- notifications (feature 11): M4's roadmap/booking messages + M5's form/office messages ----------
export async function loadNotifications() {
  const [m4, m5] = await Promise.all([session.account ? api("/api/platform/notifications") : null, session.identity ? api("/api/notifications") : null]);
  const items = [
    ...(m4?.ok ? m4.data.data.map((n) => ({ id: n.id, from: "m4", title: { en: n.title_en, ar: n.title_ar }, body: { en: n.body_en, ar: n.body_ar }, read: Boolean(n.read_at), at: n.created_at })) : []),
    ...(m5?.ok ? m5.data.notifications.map((n) => ({ id: n.id, from: "m5", title: { en: n.titleEn, ar: n.titleAr }, body: { en: n.bodyEn, ar: n.bodyAr }, read: Boolean(n.read), at: n.createdAt, link: n.link })) : []),
  ];
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export const notifications = {
  async render() {
    const items = await loadNotifications();
    return `<div class="eyebrow">${t("Notifications", "الإشعارات")}</div>
      <h1>${t("Stay one step ahead", "ابق على اطلاع")}</h1>
      <p class="subtitle">${t("Updates from your roadmap, bookings and government offices.", "تحديثات من مسارك ومواعيدك والجهات الحكومية.")}</p>
      <div class="list">${
        items.length
          ? items
              .map((n) => `<div class="item"><span class="lead">${n.read ? "" : "●"}</span><div class="details"><strong>${esc(tx(n.title))}</strong><small>${esc(tx(n.body))}</small><small>${esc(day(n.at))}</small></div>${n.read ? "" : `<span class="status info">${t("New", "جديد")}</span>`}</div>`)
              .join("")
          : `<div class="item"><div class="details"><small>${t("Nothing here yet.", "لا توجد إشعارات بعد.")}</small></div></div>`
      }</div>
      <p class="note">${t("Email and WhatsApp copies are logged in the demo outbox; nothing is actually sent.", "نسخ البريد وواتساب تُسجل في صندوق تجريبي ولا يُرسل شيء فعلياً.")}</p>
      <div class="toolbar"><button class="primary" id="read-all" ${items.some((n) => !n.read) ? "" : "disabled"}>${t("Mark all as read", "تحديد الكل كمقروء")}</button></div>`;
  },
  mount() {
    $("#read-all").onclick = async () => {
      const items = await loadNotifications();
      await Promise.all([
        ...items.filter((n) => n.from === "m4" && !n.read).map((n) => api(`/api/platform/notifications/${n.id}`, { method: "PATCH", body: {} })),
        session.identity ? api("/api/notifications", { method: "POST", body: {} }) : null,
      ]);
      toast(t("All caught up.", "لا جديد."));
      go("notifications");
    };
  },
};

// ---------- appointments (feature 12) ----------
function calendar(dates) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const marked = new Set(dates.filter((d) => d.getMonth() === now.getMonth()).map((d) => d.getDate()));
  return `<div class="calendar" aria-label="${esc(first.toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB", { month: "long", year: "numeric" }))}">${Array.from({ length: daysIn }, (_, i) => `<div class="day ${marked.has(i + 1) ? "event" : ""}">${i + 1}</div>`).join("")}</div>`;
}

export const appointments = {
  async render() {
    if (!ready()) return `<h1>${t("Make room for your next step", "حدد موعداً لخطوتك التالية")}</h1>${needsAccount(t("Booking", "الحجز"))}`;
    const [slots, bookings, catalog] = await Promise.all([api("/api/platform/slots"), api(bpath("bookings")), api("/api/platform/catalog")]);
    const all = catalog.ok ? catalog.data.data : [];
    const partner = (key) => {
      const p = all.find((c) => c.key === key);
      return p ? tx(p.payload.name) : key;
    };
    const slotOf = (key) => all.find((c) => c.key === key)?.payload;
    const free = slots.ok ? slots.data.data : [];
    const mine = bookings.ok ? bookings.data.data.filter((b) => b.status === "booked") : [];
    const dates = [...free.map((s) => new Date(s.payload.starts_at)), ...mine.map((b) => new Date(slotOf(b.slot_key)?.starts_at))];
    return `<div class="eyebrow">${t("Appointments", "المواعيد")}</div>
      <h1>${t("Make room for your next step", "حدد موعداً لخطوتك التالية")}</h1>
      <p class="subtitle">${t("Funding and partner visits (banks, incubators). Demo schedules, not real institution calendars. Expert sessions are booked separately on the Experts page.", "زيارات التمويل والشركاء (البنوك والحاضنات). مواعيد تجريبية وليست تقويمات حقيقية. تُحجز جلسات الخبراء بشكل منفصل من صفحة الخبراء.")}</p>
      <div class="toolbar"><button data-go="experts">${t("Book an expert instead", "حجز خبير بدلاً من ذلك")}</button></div>
      ${calendar(dates)}
      ${mine.length ? `<h2>${t("Your bookings", "حجوزاتك")}</h2><div class="list">${mine
        .map((b) => {
          const s = slotOf(b.slot_key);
          return `<div class="item"><span class="lead">${s ? esc(day(s.starts_at)) : ""}</span><div class="details"><strong>${esc(partner(s?.partner_key))}</strong><small>${s ? esc(time(s.starts_at)) : ""} · ${s?.duration_minutes ?? 30} ${t("min", "دقيقة")}</small></div><button data-cancel="${b.id}">${t("Cancel", "إلغاء")}</button></div>`;
        })
        .join("")}</div>` : ""}
      ${free.length
        ? `<label class="field"><span>${t("Available slot", "الموعد المتاح")}</span><select id="slot">${free.map((s) => `<option value="${esc(s.key)}">${esc(day(s.payload.starts_at))} · ${esc(time(s.payload.starts_at))} · ${esc(partner(s.payload.partner_key))}</option>`).join("")}</select></label>
           <div class="toolbar"><button class="primary" id="book">${t("Book appointment", "حجز موعد")}</button></div>`
        : `<p class="summary">${t("No free slots right now. The team can add more with npm run seed:team.", "لا توجد مواعيد متاحة الآن. يمكن للفريق إضافة المزيد.")}</p>`}`;
  },
  mount() {
    const book = $("#book");
    if (book)
      book.onclick = async () => {
        book.disabled = true;
        const res = await api(bpath("bookings"), { method: "POST", body: { slotKey: $("#slot").value } });
        if (!res.ok) return ((book.disabled = false), toast(res.status === 409 ? t("That slot was just taken. Pick another.", "حُجز هذا الموعد للتو. اختر غيره.") : errorText(res)));
        if (session.identity) {
          const label = $("#slot").selectedOptions[0].textContent.split(" · ");
          await api("/api/notifications/send", { method: "POST", body: { event: "visit_soon", vars: { placeAr: label[2], placeEn: label[2], date: label[0], time: label[1] } } });
        }
        toast(t("Appointment reserved.", "تم حجز الموعد."));
        go("appointments");
      };
    $$("[data-cancel]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await confirmDialog({ title: t("Cancel this booking?", "إلغاء هذا الحجز؟"), confirmLabel: t("Cancel booking", "إلغاء الحجز") });
          if (!ok.confirmed) return;
          const res = await api(`/api/platform/bookings/${b.dataset.cancel}/cancel`, { method: "POST", body: {} });
          toast(res.ok ? t("Booking cancelled.", "تم إلغاء الحجز.") : errorText(res));
          go("appointments");
        }),
    );
  },
};

// ---------- business plan (feature 14) ----------
export const plan = {
  async render() {
    if (!ready()) return `<h1>${t("Your idea, on paper", "فكرتك على الورق")}</h1>${needsAccount(t("The business plan", "خطة العمل"))}`;
    const res = await api(bpath("plan"));
    if (!res.ok) return `<h1>${t("Your idea, on paper", "فكرتك على الورق")}</h1><p class="error">${esc(errorText(res))}</p>`;
    const p = res.data.data.plan;
    const c = res.data.data.costs;
    return `<div class="eyebrow">${t("Business plan", "خطة العمل")}</div>
      <h1>${esc(tx(p.title))}</h1>
      <p class="subtitle">${t("A concise plan built from your answers. Review it before sharing.", "خطة مختصرة من إجاباتك. راجعها قبل المشاركة.")}</p>
      <div class="list">
        <div class="item"><span class="lead">01</span><div class="details"><strong>${t("The business", "المشروع")}</strong><small>${esc(tx(p.business))}</small></div></div>
        <div class="item"><span class="lead">02</span><div class="details"><strong>${t("Customers & channels", "العملاء والقنوات")}</strong><small>${esc(tx(p.market))}</small></div></div>
        <div class="item"><span class="lead">03</span><div class="details"><strong>${t("Official setup fees", "رسوم التأسيس الرسمية")}</strong><small>${p.costs.setup.map((l) => `${esc(tx(l.item))}: ${esc(jod(l.amountJod))}`).join(" · ")}</small><small>${t("Known minimum", "الحد الأدنى المعروف")}: ${esc(jod(c.range.minJod))}${c.range.unknownSteps.length ? t(" + steps without a published fee", " + خطوات بلا رسوم منشورة") : ""}</small></div></div>
        <div class="item"><span class="lead">04</span><div class="details"><strong>${t("Funding", "التمويل")}</strong><small>${esc(tx(p.funding.summary))}</small></div></div>
        <div class="item"><span class="lead">05</span><div class="details"><strong>${t("Timeline", "الجدول الزمني")}</strong>${p.timeline.map((s) => `<small>${esc(day(s.start))} → ${esc(day(s.end))}: ${esc(tx(s.title))}${s.durationKnown ? "" : ` (${t("estimate", "تقدير")})`}</small>`).join("")}</div></div>
      </div>
      <p class="note">${esc(res.data.disclaimer)}</p>
      <div class="toolbar"><button class="primary" data-pdf="${lang}">${t("Download plan (PDF)", "تنزيل الخطة (PDF)")}</button><button data-pdf="${lang === "ar" ? "en" : "ar"}">${lang === "ar" ? "English PDF" : "PDF بالعربية"}</button></div>`;
  },
  mount() {
    $$("[data-pdf]").forEach((b) => (b.onclick = async () => ((b.disabled = true), await download(bpath(`plan/pdf?lang=${b.dataset.pdf}`), `bedaya-business-plan-${b.dataset.pdf}.pdf`), (b.disabled = false))));
  },
};

// ---------- compliance (feature 17) ----------
export const compliance = {
  async render() {
    if (!ready()) return `<h1>${t("Keep your business on track", "حافظ على انتظام مشروعك")}</h1>${needsAccount(t("The compliance calendar", "تقويم الالتزامات"))}`;
    const res = await api(bpath(`compliance?start=${new Date().toISOString().slice(0, 10)}`));
    const items = res.ok ? res.data.data : [];
    return `<div class="eyebrow">${t("Compliance", "الالتزامات")}</div>
      <h1>${t("Keep your business on track", "حافظ على انتظام مشروعك")}</h1>
      <p class="subtitle">${t("Reminders for obligations after launch.", "تذكيرات بالالتزامات بعد الإطلاق.")}</p>
      ${calendar(items.map((i) => new Date(`${i.dueDate}T12:00:00`)))}
      <div class="list">${items.map((i) => `<div class="item"><span class="lead">${esc(day(i.dueDate))}</span><div class="details"><strong>${esc(tx({ en: i.title_en, ar: i.title_ar }))}</strong><small>${esc(i.office)}</small></div></div>`).join("")}</div>
      <p class="note">${esc(res.data?.disclaimer || "")} ${t("Licence renewal is due every year by the end of February (GAM guide).", "يجب تجديد رخصة المهن سنوياً قبل نهاية شهر شباط (دليل الأمانة).")}</p>`;
  },
};

// ---------- location (feature 18) ----------
// The owner types an address (prefilled from SANAD), the map jumps to that area, and they place the
// exact pin. The location is saved on the business (versioned workspace "location") and the checker
// uses that saved point plus the business's own activity. No external geocoding service or key:
// a small built-in list of Jordanian areas finds the neighbourhood; the pin gives the exact point.
const PLACES = [
  // neighbourhoods first (more specific), then cities
  [["jabal al-hussein", "jabal al hussein", "جبل الحسين"], [31.971, 35.9075, 16]],
  [["abdali", "العبدلي"], [31.962, 35.9075, 16]],
  [["shmeisani", "shmaisani", "الشميساني"], [31.9705, 35.887, 16]],
  [["sweifieh", "الصويفية"], [31.955, 35.862, 15]],
  [["khalda", "خلدا"], [31.996, 35.84, 15]],
  [["jabal amman", "جبل عمان", "جبل عمّان"], [31.951, 35.922, 15]],
  [["nuzha", "al-nuzha", "النزهة"], [32.545, 35.85, 16]],
  [["prince mohammad", "الأمير محمد"], [32.06, 36.09, 15]],
  [["amman", "عمان", "عمّان"], [31.9539, 35.9106, 13]],
  [["irbid", "إربد", "اربد"], [32.5556, 35.85, 13]],
  [["zarqa", "الزرقاء", "الزرقا"], [32.0608, 36.09, 13]],
  [["aqaba", "العقبة"], [29.532, 35.006, 13]],
  [["salt", "السلط"], [32.039, 35.727, 13]],
  [["madaba", "مادبا"], [31.716, 35.794, 13]],
  [["mafraq", "المفرق"], [32.343, 36.208, 13]],
  [["karak", "الكرك"], [31.185, 35.704, 13]],
];
const findPlace = (text) => {
  const q = String(text || "").toLowerCase();
  return PLACES.find(([names]) => names.some((n) => q.includes(n)))?.[1] || null;
};
const SECTOR = { food: ["Food", "أغذية"], retail: ["Retail", "تجارة تجزئة"], crafts: ["Crafts", "حِرف"], services: ["Services", "خدمات"], tech: ["Technology", "تقنية"] };

export const location = {
  async render() {
    const title = t("Check before you commit", "تحقق قبل أن تلتزم");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(t("The location check", "فحص الموقع"))}`;
    const [saved, cat] = await Promise.all([api(`/api/workspace/${session.business.id}/location`), api("/api/platform/catalog")]);
    if (!saved.ok || !cat.ok) return `<h1>${title}</h1><p class="error" role="alert">${esc(errorText(saved.ok ? cat : saved))}</p><div class="toolbar"><button data-go="location">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    this.zones = cat.data.data.find((c) => c.key === "location-demo")?.payload?.zones || [];
    this.saved = saved.data.latest?.data || null;
    this.versions = saved.data.versions?.length || 0;
    const address = this.saved?.address || sanadValue("address") || session.profile.personal.city || "";
    const sector = session.profile.business.sector;
    return `<div class="eyebrow">${t("Location", "الموقع")}</div>
      <h1>${title}</h1>
      <p class="subtitle">${t("Find your area, put the pin on your exact premises, save it to your business, then run the check.", "اعثر على منطقتك، ضع الدبوس على موقع مشروعك بالضبط، احفظه على مشروعك، ثم شغّل الفحص.")}</p>
      <div class="grid-2">
        <label class="field"><span>${t("Business address", "عنوان المشروع")}</span><input id="address" value="${esc(address)}" autocomplete="street-address" placeholder="${t("e.g. Irbid, Al-Nuzha, Street 12", "مثال: إربد، حي النزهة، شارع 12")}"></label>
        <div class="field"><span>${t("Your activity (from your profile)", "نشاطك (من ملفك)")}</span><p><span class="status info">${esc(tx(SECTOR[sector] || [sector, sector]))}</span></p></div>
      </div>
      <div class="toolbar"><button id="find">${t("Find on map", "البحث على الخريطة")}</button>${sanadValue("address") ? `<button id="use-sanad">${t("Use my SANAD address", "استخدام عنواني في سند")}</button>` : ""}</div>
      <p id="find-note" class="muted" aria-live="polite"></p>
      <div id="map" class="leaflet-map" role="application" aria-label="${t("Map: tap to place your business pin", "خريطة: انقر لوضع دبوس مشروعك")}"><p class="skeleton">${t("Loading map…", "جارٍ تحميل الخريطة…")}</p></div>
      <p class="muted" id="pin-text">${this.saved ? t(`Saved pin: ${this.saved.lat.toFixed(5)}, ${this.saved.lng.toFixed(5)} (version ${this.versions})`, `الدبوس المحفوظ: ${this.saved.lat.toFixed(5)}، ${this.saved.lng.toFixed(5)} (نسخة ${this.versions})`) : t("No location saved yet. Tap the map to place your pin.", "لم يُحفظ موقع بعد. انقر على الخريطة لوضع الدبوس.")}</p>
      <div class="toolbar"><button class="primary" id="save-loc">${t("Save location to my business", "حفظ الموقع على مشروعي")}</button><button id="check" ${this.saved ? "" : "disabled"}>${t("Check this location", "فحص هذا الموقع")}</button></div>
      <div id="location-result" aria-live="polite"></div>
      <p class="note">${t("Coloured areas are fictional demo zones, not official municipal zoning. Map data © OpenStreetMap contributors.", "المناطق الملونة مناطق تجريبية افتراضية وليست تنظيماً بلدياً رسمياً. بيانات الخريطة © مساهمو OpenStreetMap.")}</p>`;
  },
  async mount() {
    const self = location;
    loadStyle("/vendor/leaflet/leaflet.css");
    try {
      await loadScript("/vendor/leaflet/leaflet.js");
    } catch {
      $("#map").innerHTML = `<p class="error" role="alert">${t("The map couldn't load. You can still save the address and check it later.", "تعذر تحميل الخريطة. يمكنك حفظ العنوان وفحصه لاحقاً.")}</p>`;
      return;
    }
    const L = window.L;
    L.Icon.Default.imagePath = "/vendor/leaflet/images/";
    $("#map").replaceChildren();
    const start = self.saved ? [self.saved.lat, self.saved.lng, 16] : findPlace($("#address").value) || [31.9539, 35.9106, 12];
    const map = L.map("map", { scrollWheelZoom: false }).setView([start[0], start[1]], start[2]);
    let tileWarned = false;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" })
      .on("tileerror", () => {
        // Offline or blocked: the zones, pin, save and check still work on a plain background.
        if (tileWarned) return;
        tileWarned = true;
        $("#find-note").textContent = t("The street map can't load right now (no internet?). You can still place the pin inside the coloured areas, save and check.", "تعذر تحميل خريطة الشوارع الآن (لا يوجد إنترنت؟). ما زال بإمكانك وضع الدبوس داخل المناطق الملونة والحفظ والفحص.");
      })
      .addTo(map);
    for (const z of self.zones) {
      const ok = z.activities.includes(session.profile.business.sector);
      L.polygon(z.polygon, { color: ok ? "#00543f" : "#b42318", weight: 2, dashArray: "6 4", fillOpacity: 0.12 }).addTo(map).bindTooltip(lang === "ar" ? z.nameAr : z.name);
    }
    let pin = self.saved ? L.marker([self.saved.lat, self.saved.lng], { draggable: true }).addTo(map) : null;
    let point = self.saved ? { lat: self.saved.lat, lng: self.saved.lng } : null;
    const dirty = () => {
      $("#pin-text").textContent = t(`Pin: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} (not saved yet)`, `الدبوس: ${point.lat.toFixed(5)}، ${point.lng.toFixed(5)} (غير محفوظ بعد)`);
      $("#check").disabled = true;
      $("#location-result").replaceChildren();
    };
    const place = (latlng) => {
      point = { lat: latlng.lat, lng: latlng.lng };
      if (pin) pin.setLatLng(latlng);
      else {
        pin = L.marker(latlng, { draggable: true }).addTo(map);
        pin.on("dragend", () => ((point = pin.getLatLng()), dirty()));
      }
      dirty();
    };
    if (pin) pin.on("dragend", () => ((point = pin.getLatLng()), dirty()));
    map.on("click", (e) => place(e.latlng));
    setTimeout(() => map.invalidateSize(), 50);

    const find = () => {
      const hit = findPlace($("#address").value);
      if (!hit) return ($("#find-note").textContent = t("We couldn't find that area. Move the map and tap your location.", "لم نجد هذه المنطقة. حرّك الخريطة وانقر على موقعك."));
      map.setView([hit[0], hit[1]], hit[2]);
      $("#find-note").textContent = t("Area found. Now tap your exact premises on the map.", "تم إيجاد المنطقة. انقر الآن على موقع مشروعك بالضبط.");
    };
    $("#find").onclick = find;
    $("#address").onkeydown = (e) => e.key === "Enter" && find();
    const useSanad = $("#use-sanad");
    if (useSanad) useSanad.onclick = () => (($("#address").value = sanadValue("address")), find());

    $("#save-loc").onclick = async () => {
      const address = $("#address").value.trim();
      if (!address) return toast(t("Type the address first.", "اكتب العنوان أولاً."));
      if (!point) return toast(t("Tap the map to place your pin.", "انقر على الخريطة لوضع الدبوس."));
      const btn = $("#save-loc");
      btn.disabled = true;
      const res = await api(`/api/workspace/${session.business.id}/location`, { method: "POST", body: { data: { address, lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }, approved: true } });
      btn.disabled = false;
      if (!res.ok) return toast(errorText(res));
      self.saved = res.data.data?.data || { address, ...point };
      $("#pin-text").textContent = t(`Saved to your business (version ${res.data.data?.version ?? ""}).`, `تم الحفظ على مشروعك (نسخة ${res.data.data?.version ?? ""}).`);
      $("#check").disabled = false;
      toast(t("Location saved.", "تم حفظ الموقع."));
    };

    $("#check").onclick = async () => {
      const box = $("#location-result");
      box.innerHTML = `<p class="skeleton">${t("Checking…", "جارٍ الفحص…")}</p>`;
      const res = await api("/api/location/check", { method: "POST", body: { businessId: session.business.id } });
      if (!res.ok) return (box.innerHTML = `<p class="error" role="alert">${esc(errorText(res))}</p>`);
      const r = res.data;
      const verdict =
        r.allowed === true
          ? [t("Allowed in this demo zone", "مسموح في هذه المنطقة التجريبية"), "done"]
          : r.allowed === false
            ? [t("Not allowed in this demo zone", "غير مسموح في هذه المنطقة التجريبية"), "error"]
            : [t("Outside the demo zones: ask your municipality", "خارج المناطق التجريبية: راجع البلدية"), "warning"];
      box.innerHTML = `<div class="summary"><p><span class="status ${verdict[1]}">${esc(verdict[0])}</span></p>
        <dl class="kv"><dt>${t("Address", "العنوان")}</dt><dd>${esc(r.location.address)}</dd>
        <dt>${t("Zone", "المنطقة")}</dt><dd>${r.zone ? esc(lang === "ar" ? r.zone.nameAr : r.zone.name) : "—"}</dd>
        <dt>${t("Activity checked", "النشاط المفحوص")}</dt><dd>${esc(tx(SECTOR[r.activity] || [r.activity, r.activity]))}</dd>
        ${r.zone ? `<dt>${t("Allowed here", "المسموح هنا")}</dt><dd>${r.zone.activities.map((a) => esc(tx(SECTOR[a] || [a, a]))).join(t(", ", "، "))}</dd>` : ""}</dl>
        <p class="muted">${esc(r.disclaimer)}</p></div>`;
    };
  },
};

// ---------- e-invoicing (feature 21) ----------
export const invoicing = {
  async render() {
    const res = await api("/api/einvoicing");
    const d = res.ok ? res.data : null;
    if (!d) return `<h1>${t("Prepare for e-invoicing", "استعد للفوترة الإلكترونية")}</h1><p class="error">${esc(errorText(res))}</p>`;
    // Fields come as titleEn/titleAr, introEn/introAr, bodyEn/bodyAr, labelEn/labelAr.
    const pick = (o, base) => tx({ en: o?.[`${base}En`], ar: o?.[`${base}Ar`] });
    const steps = d.steps || [];
    const fields = d.fields || [];
    return `<div class="eyebrow">${t("E-invoicing (JoFotara)", "الفوترة الإلكترونية (جوفوترة)")}</div>
      <h1>${esc(pick(d, "title"))}</h1>
      <p class="subtitle">${esc(pick(d, "intro"))}</p>
      <div class="list">${steps.map((s, i) => `<div class="item"><span class="lead">${String(i + 1).padStart(2, "0")}</span><div class="details"><strong>${esc(pick(s, "title"))}</strong><small>${esc(pick(s, "body"))}</small></div></div>`).join("")}</div>
      ${fields.length ? `<h2 style="margin-top:28px">${t("Details you'll need", "البيانات التي ستحتاجها")}</h2><div class="list">${fields.map((f) => `<div class="item"><div class="details"><strong>${esc(pick(f, "label"))}</strong></div></div>`).join("")}</div>` : ""}
      <p class="note">${t("Screens only: the JoFotara connection isn't built yet. The text is a placeholder until Member 1's JoFotara note.", "واجهات فقط: الربط مع جوفوترة غير منفذ بعد. النص مؤقت حتى وصول ملاحظة العضو 1.")}</p>`;
  },
};
