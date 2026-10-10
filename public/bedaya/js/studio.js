// AI Launch Studio (Part D): brand kit (D1), design studio (D2) and website builder (D3).
// Everything the AI suggests is an editable draft. Saving keeps a new version; the owner approves the
// one they want. Designs and the website follow the approved brand (D4).
import { $, $$, api, errorText, esc, go, lang, loadScript, needsAccount, ready, sanadValue, session, t, toast, tx } from "./core.js";

// ---------------------------------------------------------------- shared helpers
const bid = () => session.business.id;
const wsGet = (kind, item = "", version = 0) => api(`/api/workspace/${bid()}/${kind}?item=${encodeURIComponent(item)}${version ? `&version=${version}` : ""}`);
const wsSave = (kind, data, { item = "", approved = false } = {}) => api(`/api/workspace/${bid()}/${kind}`, { method: "POST", body: { item, data, approved } });
const studio = (action, body = {}) => api(`/api/studio/${action}`, { method: "POST", body: { businessId: bid(), ...body }, timeoutMs: 45000 });
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
const pal = (brand) => Object.fromEntries((brand?.palette || []).map((p) => [p.role, p.hex]));
const sourceNote = () => "";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });

// The brand typefaces are served by Bedaya itself (public/vendor/fonts, SIL Open Font Licence), so
// pages, canvas designs, PDFs and logo exports keep the right fonts offline too.
const FONT_CSS = "/vendor/fonts/fonts.css";
async function useFonts(fonts) {
  const families = [fonts?.arabic, fonts?.latin].filter(Boolean);
  if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_CSS;
    document.head.append(l);
  }
  const wait = Promise.all(families.flatMap((f) => [document.fonts.load(`700 40px "${f}"`, "بداية Bedaya"), document.fonts.load(`400 40px "${f}"`, "بداية Bedaya")]));
  await Promise.race([wait, new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
}
// Fonts inlined into an SVG so a logo keeps its typeface when drawn as an image (PNG export, designs).
let fontCss = null;
const embedded = {};
async function embedFontCss(fonts) {
  const families = [fonts?.arabic, fonts?.latin].filter(Boolean);
  const key = families.join("|");
  embedded[key] ??= (async () => {
    try {
      fontCss ??= await (await fetch(FONT_CSS)).text();
      const blocks = (fontCss.match(/@font-face\s*\{[^}]+\}/g) || []).filter((b) => families.some((f) => b.includes(`'${f}'`)));
      let out = blocks.join("\n");
      for (const u of [...new Set(out.match(/\/vendor\/fonts\/[\w.-]+\.woff2/g) || [])]) {
        const bytes = new Uint8Array(await (await fetch(u)).arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        out = out.split(u).join(`data:font/woff2;base64,${btoa(bin)}`);
      }
      return out;
    } catch {
      return ""; // the browser's fallback fonts are used
    }
  })();
  return embedded[key];
}async function logoImage(svg, fonts) {
  const css = await embedFontCss(fonts);
  const withFonts = css ? svg.replace(/^<svg([^>]*)>/, `<svg$1><style>${css.replace(/</g, "")}</style>`) : svg;
  return loadImage(svgUrl(withFonts));
}
async function svgToPng(svg, fonts, size = 1024) {
  const img = await logoImage(svg, fonts);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(img, 0, 0, size, size);
  return new Promise((r) => c.toBlob(r, "image/png"));
}
async function pngToPdf(pngBlob, widthPt, heightPt) {
  await loadScript("/vendor/pdf-lib/pdf-lib.min.js");
  const { PDFDocument } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(await pngBlob.arrayBuffer());
  const page = pdf.addPage([widthPt, heightPt]);
  page.drawImage(png, { x: 0, y: 0, width: widthPt, height: heightPt });
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

// WCAG contrast (same formula as the server).
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---------------------------------------------------------------- canvas renderer for designs
// spec = { w, h, bg, items: [rect | circle | text | logo] }; text wraps to maxWidth and uses the brand fonts.
const isArabic = (s) => /[؀-ۿ]/.test(s);
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (maxWidth && ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
async function renderSpec(spec, canvas, fonts) {
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = spec.bg;
  ctx.fillRect(0, 0, spec.w, spec.h);
  for (const it of spec.items) {
    if (it.t === "rect") {
      ctx.fillStyle = it.fill;
      ctx.beginPath();
      ctx.roundRect(it.x, it.y, it.w, it.h, it.r || 0);
      if (it.fill) ctx.fill();
      if (it.stroke) ((ctx.strokeStyle = it.stroke), (ctx.lineWidth = it.sw || 2), ctx.stroke());
    } else if (it.t === "circle") {
      ctx.beginPath();
      ctx.arc(it.cx, it.cy, it.r, 0, Math.PI * 2);
      if (it.fill) ((ctx.fillStyle = it.fill), ctx.fill());
      if (it.stroke) ((ctx.strokeStyle = it.stroke), (ctx.lineWidth = it.sw || 2), ctx.stroke());
    } else if (it.t === "logo" && it.svg) {
      try {
        ctx.drawImage(await logoImage(it.svg, fonts), it.x, it.y, it.w, it.h);
      } catch {
        /* logo unavailable */
      }
    } else if (it.t === "text" && it.text) {
      const family = isArabic(it.text) ? fonts.arabic : fonts.latin;
      let size = it.size;
      ctx.font = `${it.weight || 400} ${size}px "${family}", "${fonts.arabic}", Tahoma, sans-serif`;
      let lines = wrap(ctx, it.text, it.maxWidth);
      // shrink long text to fit its box
      while (it.maxLines && lines.length > it.maxLines && size > 14) {
        size *= 0.9;
        ctx.font = `${it.weight || 400} ${size}px "${family}", "${fonts.arabic}", Tahoma, sans-serif`;
        lines = wrap(ctx, it.text, it.maxWidth);
      }
      ctx.fillStyle = it.fill;
      ctx.textAlign = it.align || "center";
      ctx.textBaseline = "alphabetic";
      ctx.direction = isArabic(it.text) ? "rtl" : "ltr";
      const lh = size * (it.lh || 1.3);
      lines.forEach((l, i) => ctx.fillText(l, it.x, it.y + i * lh));
    }
  }
  return canvas;
}

// ---------------------------------------------------------------- brand state
let brandState = null; // { bid, brand, versions, approvedVersion, version, dirty, sources }
const EMPTY_BRAND = () => ({ name: null, names: [], palette: [], fonts: null, tone: null, logos: [], logoIndex: 0 });
async function loadBrand(force = false) {
  if (!force && brandState?.bid === bid()) return brandState;
  const res = await wsGet("brand");
  if (!res.ok) throw new Error(errorText(res));
  const latest = res.data.latest;
  brandState = {
    bid: bid(),
    brand: latest ? latest.data : EMPTY_BRAND(),
    version: latest?.version || 0,
    approvedVersion: res.data.approved?.version || 0,
    approvedBrand: res.data.approved?.data || null,
    versions: res.data.versions || [],
    dirty: false,
    sources: {},
  };
  return brandState;
}
/** The brand designs and the website follow: the approved one, else the latest draft. */
async function activeBrand() {
  const s = await loadBrand();
  return s.approvedBrand || (s.brand?.name && s.brand.palette?.length ? s.brand : null);
}
const brandComplete = (b) => Boolean(b?.name?.en && b?.name?.ar && b.palette?.length === 5 && b.fonts && b.logos?.length);

function versionBar(kind, state) {
  const opts = state.versions.map((v) => `<option value="${v.version}" ${v.version === state.version ? "selected" : ""}>${t("Version", "نسخة")} ${v.version}${v.approved ? ` ✓ ${t("approved", "معتمدة")}` : ""} · ${new Date(v.created_at).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", { dateStyle: "short", timeStyle: "short" })}</option>`).join("");
  return `<div class="studio-bar card">
    <div><strong>${state.version ? t(`Draft version ${state.version}`, `مسودة النسخة ${state.version}`) : t("New draft", "مسودة جديدة")}</strong>
      ${state.approvedVersion ? `<span class="status done">${t(`Approved: version ${state.approvedVersion}`, `المعتمدة: النسخة ${state.approvedVersion}`)}</span>` : `<span class="status warning">${t("Not approved yet", "غير معتمدة بعد")}</span>`}
      <span class="status warning" id="${kind}-dirty" ${state.dirty ? "" : "hidden"}>${t("Unsaved changes", "تغييرات غير محفوظة")}</span></div>
    ${opts ? `<label class="field compact"><span>${t("Open a saved version", "فتح نسخة محفوظة")}</span><select id="${kind}-version">${opts}</select></label>` : ""}
    <div class="toolbar tight"><button id="${kind}-save">${t("Save draft", "حفظ المسودة")}</button><button class="primary" id="${kind}-approve">${t("Approve this version", "اعتماد هذه النسخة")}</button></div>
  </div>`;
}

// ---------------------------------------------------------------- hub
const hub = {
  async render() {
    if (!ready()) return `<h1>${t("AI Launch Studio", "استوديو الإطلاق الذكي")}</h1>${needsAccount(t("The Launch Studio", "استوديو الإطلاق"))}`;
    const [b, site, designs] = await Promise.all([loadBrand(true).catch(() => null), studio("published"), Promise.all(TEMPLATES.map((tp) => wsGet("design", tp.id)))]);
    const brand = b?.approvedBrand || b?.brand;
    const designCount = designs.filter((d) => d.ok && d.data.latest).length;
    const card = (route, icon, title, body, status, cls, button) => `<div class="card studio-card"><div class="studio-icon"><i data-lucide="${icon}"></i></div><h2>${title}</h2><p class="muted">${body}</p><p><span class="status ${cls}">${status}</span></p><button class="${cls === "done" ? "" : "primary"}" data-go="${route}">${button}</button></div>`;
    return `<div class="eyebrow">${t("Launch Studio", "استوديو الإطلاق")}</div>
      <h1>${t("Look like a real business from day one", "اظهر كمشروع حقيقي من اليوم الأول")}</h1>
      <p class="subtitle">${t("AI drafts your brand, marketing designs and website from your profile. You edit everything and approve what goes out.", "يجهز الذكاء الاصطناعي مسودات هويتك وتصاميمك وموقعك من ملفك. تعدّل كل شيء وتعتمد ما يُنشر.")}</p>
      ${b?.brand?.name ? `<div class="studio-brand-strip card">${brand?.logos?.length ? `<img src="${svgUrl(brand.logos[brand.logoIndex || 0])}" alt="" width="64" height="64">` : ""}<div><strong>${esc(tx(brand.name))}</strong><div class="swatches small">${(brand.palette || []).map((p) => `<span style="background:${esc(p.hex)}" title="${esc(p.hex)}"></span>`).join("")}</div></div></div>` : ""}
      <div class="grid-3">
        ${card("studio-brand", "palette", t("1 · Brand kit", "١ · الهوية"), t("Names, logos, colours, fonts and tone of voice, plus a one-page brand guide.", "أسماء وشعارات وألوان وخطوط ونبرة، مع دليل هوية من صفحة واحدة."), b?.approvedVersion ? t("Approved", "معتمدة") : b?.version ? t("Draft saved", "مسودة محفوظة") : t("Not started", "لم تبدأ"), b?.approvedVersion ? "done" : b?.version ? "warning" : "", b?.version ? t("Open brand kit", "فتح الهوية") : t("Create my brand", "أنشئ هويتي"))}
        ${card("studio-design", "image", t("2 · Design studio", "٢ · استوديو التصميم"), t("Social posts, profile and cover images, business card, flyer, menu and shop sign.", "منشورات وصور الحساب والغلاف وبطاقة العمل والنشرة والقائمة ولافتة المحل."), designCount ? t(`${designCount} design(s) saved`, `${designCount} تصميم محفوظ`) : t("Not started", "لم يبدأ"), designCount ? "done" : "", t("Open designs", "فتح التصاميم"))}
        ${card("studio-site", "globe", t("3 · Website", "٣ · الموقع"), t("A bilingual one-page site or store with map, contact form and WhatsApp.", "موقع أو متجر من صفحة واحدة بلغتين مع خريطة ونموذج تواصل وواتساب."), site.ok && site.data.site ? t(`Published at /s/${site.data.site.slug}`, `منشور على /s/${site.data.site.slug}`) : t("Not published", "غير منشور"), site.ok && site.data.site ? "done" : "", t("Open website builder", "فتح منشئ الموقع"))}
      </div>`;
  },
};

// ---------------------------------------------------------------- D1 brand kit
const ARABIC_FONTS = ["Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Reem Kufi", "Amiri"];
const LATIN_FONTS = ["Inter", "Poppins", "Montserrat", "Nunito", "Lora", "Playfair Display", "Work Sans"];
const ROLE = { primary: ["Primary", "أساسي"], secondary: ["Secondary", "ثانوي"], accent: ["Accent", "مميز"], dark: ["Text", "النص"], light: ["Background", "الخلفية"] };
// Random start per visit, so "regenerate" never repeats what the owner saw last time.
const seedStart = () => Math.floor(Math.random() * 5000) + 1;
let seeds = { names: seedStart(), palette: seedStart(), tone: seedStart(), logos: seedStart() };

function contrastRows(p) {
  if (!p.dark) return "";
  const rows = [
    [t("Text on background", "النص على الخلفية"), p.dark, p.light],
    [t("Background colour on primary (buttons)", "لون الخلفية على الأساسي (الأزرار)"), p.light, p.primary],
    [t("Text on accent", "النص على المميز"), p.dark, p.accent],
    [t("Primary on background (headings)", "الأساسي على الخلفية (العناوين)"), p.primary, p.light],
  ];
  return `<table class="data contrast"><thead><tr><th>${t("Pair", "الزوج")}</th><th>${t("Sample", "عينة")}</th><th>${t("Ratio", "النسبة")}</th><th>${t("Readable?", "مقروء؟")}</th></tr></thead><tbody>${rows
    .map(([label, fg, bg]) => {
      const r = ratio(fg, bg);
      const grade = r >= 7 ? ["AAA", "done"] : r >= 4.5 ? ["AA", "done"] : r >= 3 ? [t("Large text only", "للنص الكبير فقط"), "warning"] : [t("Too low", "منخفضة جداً"), "error"];
      return `<tr><td>${label}</td><td><span class="sample" style="color:${fg};background:${bg}">Aa أب</span></td><td class="ltr">${r.toFixed(2)}:1</td><td><span class="status ${grade[1]}">${grade[0]}</span></td></tr>`;
    })
    .join("")}</tbody></table>`;
}

const brandScreen = {
  async render() {
    const title = t("Your brand kit", "هويتك التجارية");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(t("The brand kit", "الهوية"))}`;
    let s;
    try {
      s = await loadBrand();
    } catch (e) {
      return `<h1>${title}</h1><p class="error" role="alert">${esc(e.message)}</p><div class="toolbar"><button data-go="studio-brand">${t("Try again", "حاول مرة أخرى")}</button></div>`;
    }
    const b = s.brand;
    const p = pal(b);
    if (b.fonts) await useFonts(b.fonts);
    const fontStyle = (f) => `font-family:'${esc(f)}', Tahoma, sans-serif`;
    return `<div class="eyebrow">${t("Launch Studio · Brand kit", "استوديو الإطلاق · الهوية")}</div>
      <h1>${title}</h1>
      <p class="subtitle">${t("Each part is a draft. Generate, edit anything, save versions and approve the one you like.", "كل جزء مسودة. ولّد وعدّل أي شيء واحفظ النسخ واعتمد ما يعجبك.")}</p>
      ${versionBar("brand", s)}

      <section class="studio-sec" id="sec-name"><h2>1. ${t("Name", "الاسم")}</h2>
        <div class="toolbar tight"><button id="gen-names" class="${b.names?.length ? "" : "primary"}">${b.names?.length ? t("More name ideas", "أفكار أسماء أخرى") : t("Suggest names", "اقترح أسماء")}</button>${sourceNote(s.sources.names)}</div>
        ${b.names?.length ? `<div class="options name-options">${b.names.map((n, i) => `<label class="option"><input type="radio" name="name-pick" value="${i}" ${b.name?.en === n.en && b.name?.ar === n.ar ? "checked" : ""}><div><strong>${esc(n.ar)} · ${esc(n.en)}</strong><small class="muted" style="display:block">${esc(tx({ en: n.meaningEn, ar: n.meaningAr }))}</small></div></label>`).join("")}</div>` : `<p class="muted">${t("No names yet. Bedaya suggests names from your activity and description.", "لا توجد أسماء بعد. تقترح بداية أسماء من نشاطك ووصفك.")}</p>`}
        <div class="grid-2">
          <label class="field"><span>${t("Arabic name", "الاسم بالعربية")}</span><input id="name-ar" dir="rtl" value="${esc(b.name?.ar || "")}" maxlength="60"></label>
          <label class="field"><span>${t("English name", "الاسم بالإنجليزية")}</span><input id="name-en" dir="ltr" value="${esc(b.name?.en || "")}" maxlength="60"></label>
          <label class="field"><span>${t("Meaning (Arabic)", "المعنى (عربي)")}</span><input id="mean-ar" dir="rtl" value="${esc(b.name?.meaningAr || "")}" maxlength="160"></label>
          <label class="field"><span>${t("Meaning (English)", "المعنى (إنجليزي)")}</span><input id="mean-en" dir="ltr" value="${esc(b.name?.meaningEn || "")}" maxlength="160"></label>
        </div></section>

      <section class="studio-sec"><h2>2. ${t("Colours", "الألوان")}</h2>
        <div class="toolbar tight"><button id="gen-palette" class="${b.palette?.length ? "" : "primary"}">${b.palette?.length ? t("Regenerate colours", "ألوان جديدة") : t("Suggest colours", "اقترح ألواناً")}</button>${sourceNote(s.sources.palette)}</div>
        ${b.palette?.length ? `<div class="palette">${b.palette.map((c, i) => `<label class="swatch"><input type="color" data-color="${i}" value="${esc(c.hex)}" aria-label="${tx(ROLE[c.role])}"><span class="chip" style="background:${esc(c.hex)}"></span><strong>${tx(ROLE[c.role])}</strong><input class="hex ltr" data-hex="${i}" value="${esc(c.hex)}" maxlength="7" aria-label="${tx(ROLE[c.role])} hex"></label>`).join("")}</div>
          <h3>${t("Contrast check", "فحص التباين")}</h3><div id="contrast">${contrastRows(p)}</div>` : `<p class="muted">${t("No colours yet.", "لا ألوان بعد.")}</p>`}
      </section>

      <section class="studio-sec"><h2>3. ${t("Fonts and tone of voice", "الخطوط ونبرة الصوت")}</h2>
        <div class="toolbar tight"><button id="gen-tone" class="${b.fonts ? "" : "primary"}">${b.fonts ? t("Suggest again", "اقترح مجدداً") : t("Suggest fonts and tone", "اقترح الخطوط والنبرة")}</button>${sourceNote(s.sources.tone)}</div>
        ${b.fonts ? `<div class="grid-2">
          <label class="field"><span>${t("Arabic font", "الخط العربي")}</span><select id="font-ar">${ARABIC_FONTS.map((f) => `<option ${f === b.fonts.arabic ? "selected" : ""}>${f}</option>`).join("")}</select></label>
          <label class="field"><span>${t("Latin font", "الخط اللاتيني")}</span><select id="font-en">${LATIN_FONTS.map((f) => `<option ${f === b.fonts.latin ? "selected" : ""}>${f}</option>`).join("")}</select></label></div>
          <div class="card font-sample"><p style="${fontStyle(b.fonts.arabic)};font-size:28px;font-weight:700" dir="rtl">${esc(b.name?.ar || "بداية")} — أهلاً بكم</p><p style="${fontStyle(b.fonts.latin)};font-size:24px;font-weight:700" dir="ltr">${esc(b.name?.en || "Bedaya")} — Welcome</p></div>
          <div class="grid-2">
            <label class="field"><span>${t("Tone of voice (Arabic)", "نبرة الصوت (عربي)")}</span><textarea id="tone-ar" dir="rtl" rows="3" maxlength="400">${esc(b.tone?.ar || "")}</textarea></label>
            <label class="field"><span>${t("Tone of voice (English)", "نبرة الصوت (إنجليزي)")}</span><textarea id="tone-en" dir="ltr" rows="3" maxlength="400">${esc(b.tone?.en || "")}</textarea></label></div>
          ${b.tone?.wordsEn?.length ? `<div class="chips">${(lang === "ar" ? b.tone.wordsAr : b.tone.wordsEn).map((w) => `<span class="status info">${esc(w)}</span>`).join("")}</div>` : ""}` : `<p class="muted">${t("No fonts yet.", "لا خطوط بعد.")}</p>`}
      </section>

      <section class="studio-sec"><h2>4. ${t("Logo", "الشعار")}</h2>
        <div class="toolbar tight"><button id="gen-logos" class="${b.logos?.length ? "" : "primary"}">${b.logos?.length ? t("Regenerate logos", "شعارات جديدة") : t("Generate 4 logos", "ولّد 4 شعارات")}</button>${sourceNote(s.sources.logos)}</div>
        <p id="logo-stale" class="note" ${b.logosStale ? "" : "hidden"}>${t("You changed the name, colours or fonts. Regenerate the logos so they match.", "غيّرت الاسم أو الألوان أو الخطوط. ولّد الشعارات مجدداً لتتطابق.")}</p>
        ${b.logos?.length ? `<div class="logo-grid">${b.logos.map((svg, i) => `<label class="logo-pick"><input type="radio" name="logo-pick" value="${i}" ${i === (b.logoIndex || 0) ? "checked" : ""}><img src="${svgUrl(svg)}" alt="${t(`Logo option ${i + 1}`, `خيار الشعار ${i + 1}`)}"></label>`).join("")}</div>
          <div class="toolbar tight"><button id="logo-png">${t("Download PNG", "تنزيل PNG")}</button><button id="logo-svg">${t("Download SVG", "تنزيل SVG")}</button></div>` : `<p class="muted">${t("Pick a name, colours and fonts first; the logos use them.", "اختر الاسم والألوان والخطوط أولاً؛ تستخدمها الشعارات.")}</p>`}
      </section>

      <section class="studio-sec"><h2>5. ${t("Brand guide", "دليل الهوية")}</h2>
        <p class="muted">${t("A one-page PDF with your name, logo, colours with hex codes, fonts and tone of voice.", "ملف PDF من صفحة واحدة يضم الاسم والشعار والألوان بأكوادها والخطوط والنبرة.")}</p>
        <div class="toolbar tight"><button id="guide" ${brandComplete(b) ? "" : "disabled"}>${t("Download brand guide (PDF)", "تنزيل دليل الهوية (PDF)")}</button><button data-go="studio-design" ${brandComplete(b) ? "" : "disabled"}>${t("Use it in designs", "استخدمها في التصاميم")}</button></div>
      </section>`;
  },
  mount() {
    const s = brandState;
    if (!s) return;
    const b = s.brand;
    const dirty = () => {
      s.dirty = true;
      const d = $("#brand-dirty");
      if (d) d.hidden = false;
    };
    const stale = () => {
      if (b.logos?.length) {
        b.logosStale = true;
        const el = $("#logo-stale");
        if (el) el.hidden = false;
      }
    };
    const busy = async (btn, fn) => {
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = t("Working…", "جارٍ العمل…");
      try {
        await fn();
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    };
    // name
    $("#gen-names").onclick = (e) =>
      busy(e.target, async () => {
        const res = await studio("names", { seed: seeds.names++ });
        if (!res.ok) return toast(errorText(res));
        b.names = res.data.names;
        s.sources.names = res.data.source;
        if (!b.name) b.name = { ...b.names[0] };
        dirty();
        go("studio-brand");
      });
    $$("input[name=name-pick]").forEach(
      (r) =>
        (r.onchange = () => {
          const n = b.names[Number(r.value)];
          b.name = { ...n };
          $("#name-ar").value = n.ar;
          $("#name-en").value = n.en;
          $("#mean-ar").value = n.meaningAr;
          $("#mean-en").value = n.meaningEn;
          dirty();
          stale();
        }),
    );
    for (const [id, key] of [["name-ar", "ar"], ["name-en", "en"], ["mean-ar", "meaningAr"], ["mean-en", "meaningEn"]])
      $(`#${id}`).oninput = (e) => {
        b.name = { ...(b.name || {}), [key]: e.target.value };
        dirty();
        if (key === "ar" || key === "en") stale();
      };
    // palette
    $("#gen-palette").onclick = (e) =>
      busy(e.target, async () => {
        const res = await studio("palette", { seed: seeds.palette++ });
        if (!res.ok) return toast(errorText(res));
        b.palette = res.data.palette;
        s.sources.palette = res.data.source;
        dirty();
        stale();
        go("studio-brand");
      });
    const setColor = (i, hex) => {
      b.palette[i].hex = hex.toLowerCase();
      $(`[data-color="${i}"]`).value = hex;
      $(`[data-hex="${i}"]`).value = hex;
      $(`[data-color="${i}"]`).nextElementSibling.style.background = hex;
      $("#contrast").innerHTML = contrastRows(pal(b));
      dirty();
      stale();
    };
    $$("[data-color]").forEach((inp) => (inp.oninput = () => setColor(Number(inp.dataset.color), inp.value)));
    $$("[data-hex]").forEach((inp) => (inp.onchange = () => (/^#[0-9a-f]{6}$/i.test(inp.value.trim()) ? setColor(Number(inp.dataset.hex), inp.value.trim()) : toast(t("Use a colour code like #1a7f5a.", "استخدم كود لون مثل ‎#1a7f5a.")))));
    // fonts and tone
    $("#gen-tone").onclick = (e) =>
      busy(e.target, async () => {
        const res = await studio("tone", { seed: seeds.tone++ });
        if (!res.ok) return toast(errorText(res));
        b.fonts = res.data.fonts;
        b.tone = res.data.tone;
        s.sources.tone = res.data.source;
        dirty();
        stale();
        go("studio-brand");
      });
    const fa = $("#font-ar");
    if (fa) {
      const onFont = () => {
        b.fonts = { arabic: fa.value, latin: $("#font-en").value };
        dirty();
        stale();
        go("studio-brand");
      };
      fa.onchange = onFont;
      $("#font-en").onchange = onFont;
      $("#tone-ar").oninput = (e) => ((b.tone = { ...(b.tone || {}), ar: e.target.value }), dirty());
      $("#tone-en").oninput = (e) => ((b.tone = { ...(b.tone || {}), en: e.target.value }), dirty());
    }
    // logos
    $("#gen-logos").onclick = (e) => {
      if (!b.name?.en || !b.name?.ar || b.palette?.length !== 5 || !b.fonts) return toast(t("Choose a name (Arabic and English), colours and fonts first.", "اختر الاسم (عربي وإنجليزي) والألوان والخطوط أولاً."));
      return busy(e.target, async () => {
        const res = await studio("logos", { seed: seeds.logos++, name: { en: b.name.en, ar: b.name.ar }, palette: b.palette, fonts: b.fonts });
        if (!res.ok) return toast(errorText(res));
        b.logos = res.data.logos;
        b.logoIndex = 0;
        b.logosStale = false;
        s.sources.logos = res.data.source;
        dirty();
        go("studio-brand");
      });
    };
    $$("input[name=logo-pick]").forEach((r) => (r.onchange = () => ((b.logoIndex = Number(r.value)), dirty())));
    const file = () => slugify(b.name?.en) || "logo";
    const png = $("#logo-png");
    if (png) png.onclick = () => busy(png, async () => downloadBlob(await svgToPng(b.logos[b.logoIndex || 0], b.fonts), `${file()}-logo.png`));
    const svg = $("#logo-svg");
    if (svg) svg.onclick = () => downloadBlob(new Blob([b.logos[b.logoIndex || 0]], { type: "image/svg+xml" }), `${file()}-logo.svg`);
    const guide = $("#guide");
    if (guide) guide.onclick = () => busy(guide, async () => downloadBlob(await brandGuide(b), `${file()}-brand-guide.pdf`));
    // versions and approval
    const save = async (approved) => {
      if (approved && !brandComplete(b)) return toast(t("Finish the name, colours, fonts and logo before approving.", "أكمل الاسم والألوان والخطوط والشعار قبل الاعتماد."));
      const res = await wsSave("brand", b, { approved });
      if (!res.ok) return toast(errorText(res));
      toast(approved ? t("Brand approved. Designs and your website now use it.", "تم اعتماد الهوية. تستخدمها التصاميم وموقعك الآن.") : t("Draft saved.", "تم حفظ المسودة."));
      await loadBrand(true);
      go("studio-brand");
    };
    $("#brand-save").onclick = () => save(false);
    $("#brand-approve").onclick = () => save(true);
    const ver = $("#brand-version");
    if (ver)
      ver.onchange = async () => {
        if (s.dirty && !confirm(t("Discard unsaved changes?", "تجاهل التغييرات غير المحفوظة؟"))) return (ver.value = String(s.version));
        const res = await wsGet("brand", "", Number(ver.value));
        if (!res.ok) return toast(errorText(res));
        s.brand = res.data.data.data;
        s.version = res.data.data.version;
        s.dirty = false;
        go("studio-brand");
      };
  },
};

/** One-page brand guide: drawn on a canvas (Arabic shaped by the browser), then wrapped in a PDF. */
async function brandGuide(b) {
  await useFonts(b.fonts);
  const p = pal(b);
  const W = 1240;
  const H = 1754;
  const items = [
    { t: "rect", x: 0, y: 0, w: W, h: 330, fill: p.primary },
    { t: "logo", x: 80, y: 55, w: 220, h: 220, svg: b.logos[b.logoIndex || 0] },
    { t: "text", x: W - 80, y: 150, text: b.name.ar, size: 78, weight: 700, fill: p.light, align: "right" },
    { t: "text", x: W - 80, y: 230, text: b.name.en, size: 46, weight: 700, fill: p.light, align: "right" },
    { t: "text", x: W - 80, y: 290, text: "Brand guide · دليل الهوية", size: 26, fill: p.light, align: "right" },
    { t: "text", x: 80, y: 420, text: "Name meaning · معنى الاسم", size: 30, weight: 700, fill: p.primary, align: "left" },
    { t: "text", x: 80, y: 470, text: b.name.meaningEn || "", size: 26, fill: p.dark, align: "left", maxWidth: 1080, maxLines: 2 },
    { t: "text", x: W - 80, y: 530, text: b.name.meaningAr || "", size: 28, fill: p.dark, align: "right", maxWidth: 1080, maxLines: 2 },
    { t: "text", x: 80, y: 640, text: "Colours · الألوان", size: 30, weight: 700, fill: p.primary, align: "left" },
  ];
  b.palette.forEach((c, i) => {
    const x = 80 + i * 220;
    items.push({ t: "rect", x, y: 670, w: 190, h: 190, r: 16, fill: c.hex, stroke: "#d0d7d3", sw: 2 });
    items.push({ t: "text", x: x + 95, y: 900, text: c.hex.toUpperCase(), size: 26, weight: 700, fill: "#222222", align: "center" });
    items.push({ t: "text", x: x + 95, y: 940, text: `${ROLE[c.role][0]} · ${ROLE[c.role][1]}`, size: 20, fill: "#555555", align: "center" });
  });
  const r1 = ratio(p.dark, p.light);
  const r2 = ratio(p.light, p.primary);
  items.push(
    { t: "text", x: 80, y: 1000, text: `Contrast: text on background ${r1.toFixed(1)}:1 ${r1 >= 4.5 ? "✓ AA" : "✗"} · light on primary ${r2.toFixed(1)}:1 ${r2 >= 4.5 ? "✓ AA" : r2 >= 3 ? "large text" : "✗"}`, size: 22, fill: "#444444", align: "left" },
    { t: "text", x: 80, y: 1100, text: "Fonts · الخطوط", size: 30, weight: 700, fill: p.primary, align: "left" },
    { t: "text", x: W - 80, y: 1170, text: `${b.fonts.arabic}: أبجد هوز حطي — ${b.name.ar}`, size: 38, weight: 700, fill: p.dark, align: "right" },
    { t: "text", x: 80, y: 1240, text: `${b.fonts.latin}: Aa Bb Cc 123 — ${b.name.en}`, size: 36, weight: 700, fill: p.dark, align: "left" },
    { t: "text", x: 80, y: 1350, text: "Tone of voice · نبرة الصوت", size: 30, weight: 700, fill: p.primary, align: "left" },
    { t: "text", x: 80, y: 1400, text: b.tone?.en || "", size: 24, fill: p.dark, align: "left", maxWidth: 1080, maxLines: 3 },
    { t: "text", x: W - 80, y: 1530, text: b.tone?.ar || "", size: 26, fill: p.dark, align: "right", maxWidth: 1080, maxLines: 3 },
    { t: "rect", x: 0, y: H - 70, w: W, h: 70, fill: p.dark },
    { t: "text", x: W / 2, y: H - 25, text: "Made with Bedaya Launch Studio · صُنع في استوديو الإطلاق من بداية", size: 20, fill: p.light, align: "center" },
  );
  const canvas = await renderSpec({ w: W, h: H, bg: p.light, items }, document.createElement("canvas"), b.fonts);
  const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return pngToPdf(pngBlob, 595.28, 841.89);
}

// ---------------------------------------------------------------- D2 design studio (Bedaya's own templates)
// Each template: size, PDF size in points, editable text fields, and a layout built from the brand.
const contactLine = () => [sanadValue("phone"), session.profile?.personal?.email].filter(Boolean).join(" · ");
const TEMPLATES = [
  {
    id: "post", name: ["Social post (1080×1080)", "منشور (1080×1080)"], w: 1080, h: 1080,
    fields: (b) => ({ headline: b.name.ar, subline: lang === "ar" ? "افتتاح قريب!" : "Opening soon!", cta: lang === "ar" ? "اطلب الآن عبر واتساب" : "Order now on WhatsApp" }),
    layout: (f, c, b) => [
      { t: "circle", cx: 1080, cy: 0, r: 420, fill: c.accent },
      { t: "circle", cx: 0, cy: 1080, r: 300, fill: c.primary },
      { t: "logo", x: 440, y: 120, w: 200, h: 200, svg: b.logo },
      { t: "text", x: 540, y: 470, text: f.headline, size: 96, weight: 700, fill: c.text, maxWidth: 900, maxLines: 2 },
      { t: "text", x: 540, y: 640, text: f.subline, size: 60, fill: c.text, maxWidth: 880, maxLines: 3 },
      { t: "rect", x: 240, y: 850, w: 600, h: 110, r: 55, fill: c.primary },
      { t: "text", x: 540, y: 922, text: f.cta, size: 40, weight: 700, fill: c.bg, maxWidth: 560, maxLines: 1 },
    ],
  },
  {
    id: "profile", name: ["Instagram / Facebook profile picture", "صورة الحساب (إنستغرام / فيسبوك)"], w: 1080, h: 1080,
    fields: (b) => ({ label: "" }),
    layout: (f, c, b) => [
      { t: "circle", cx: 540, cy: 540, r: 520, fill: c.primary },
      { t: "logo", x: 190, y: 190, w: 700, h: 700, svg: b.logo },
      { t: "text", x: 540, y: 1000, text: f.label, size: 48, weight: 700, fill: c.bg, maxWidth: 700, maxLines: 1 },
    ],
  },
  {
    id: "cover", name: ["Facebook cover (1640×624)", "غلاف فيسبوك (1640×624)"], w: 1640, h: 624,
    fields: (b) => ({ title: `${b.name.ar} · ${b.name.en}`, tagline: lang === "ar" ? b.toneWord || "صُنع بحب في الأردن" : "Made with love in Jordan", contact: contactLine() }),
    layout: (f, c, b) => [
      { t: "rect", x: 0, y: 0, w: 1640, h: 624, fill: c.primary },
      { t: "circle", cx: 1500, cy: 120, r: 260, fill: c.accent },
      { t: "logo", x: 1240, y: 170, w: 300, h: 300, svg: b.logo },
      { t: "text", x: 640, y: 270, text: f.title, size: 76, weight: 700, fill: c.bg, maxWidth: 1050, maxLines: 2 },
      { t: "text", x: 640, y: 390, text: f.tagline, size: 44, fill: c.bg, maxWidth: 1000, maxLines: 2 },
      { t: "text", x: 640, y: 540, text: f.contact, size: 32, fill: c.bg, maxWidth: 1000, maxLines: 1 },
    ],
  },
  {
    id: "card", name: ["Business card (3.5×2 in)", "بطاقة عمل (3.5×2 إنش)"], w: 1050, h: 600, pdf: [252, 144],
    fields: (b) => ({ person: tx({ en: sanadValue("fullNameEn"), ar: sanadValue("fullNameAr") }), role: lang === "ar" ? "المؤسس" : "Founder", phone: sanadValue("phone"), email: session.profile?.personal?.email || "" }),
    layout: (f, c, b) => [
      { t: "rect", x: 0, y: 0, w: 380, h: 600, fill: c.primary },
      { t: "logo", x: 50, y: 160, w: 280, h: 280, svg: b.logo },
      { t: "text", x: 990, y: 170, text: f.person, size: 54, weight: 700, fill: c.text, align: "right", maxWidth: 560, maxLines: 1 },
      { t: "text", x: 990, y: 230, text: f.role, size: 34, fill: c.accentText, align: "right", maxWidth: 560, maxLines: 1 },
      { t: "rect", x: 430, y: 285, w: 560, h: 4, fill: c.accent },
      { t: "text", x: 990, y: 380, text: f.phone, size: 34, fill: c.text, align: "right", maxWidth: 560, maxLines: 1 },
      { t: "text", x: 990, y: 440, text: f.email, size: 30, fill: c.text, align: "right", maxWidth: 560, maxLines: 1 },
      { t: "text", x: 990, y: 540, text: b.name.ar, size: 30, weight: 700, fill: c.primary, align: "right", maxWidth: 560, maxLines: 1 },
    ],
  },
  {
    id: "flyer", name: ["Flyer (A5)", "نشرة إعلانية (A5)"], w: 1240, h: 1754, pdf: [419.53, 595.28],
    fields: (b) => ({ headline: lang === "ar" ? `افتتاح ${b.name.ar}` : `${b.name.en} is open!`, body: lang === "ar" ? "منتجات طازجة كل يوم. اطلب مسبقاً واستلم في الموعد." : "Fresh every day. Pre-order and pick up on time.", offer: lang === "ar" ? "خصم 10% على أول طلب" : "10% off your first order", contact: contactLine() }),
    layout: (f, c, b) => [
      { t: "rect", x: 0, y: 0, w: 1240, h: 760, fill: c.primary },
      { t: "logo", x: 470, y: 90, w: 300, h: 300, svg: b.logo },
      { t: "text", x: 620, y: 560, text: f.headline, size: 92, weight: 700, fill: c.bg, maxWidth: 1080, maxLines: 2 },
      { t: "text", x: 620, y: 920, text: f.body, size: 52, fill: c.text, maxWidth: 1040, maxLines: 5 },
      { t: "rect", x: 170, y: 1260, w: 900, h: 200, r: 30, fill: c.accent },
      { t: "text", x: 620, y: 1385, text: f.offer, size: 62, weight: 700, fill: c.text, maxWidth: 840, maxLines: 1 },
      { t: "text", x: 620, y: 1640, text: f.contact, size: 42, fill: c.text, maxWidth: 1080, maxLines: 1 },
    ],
  },
  {
    id: "menu", name: ["Menu / price list (A4)", "قائمة الأسعار (A4)"], w: 1240, h: 1754, pdf: [595.28, 841.89],
    fields: (b) => ({ title: lang === "ar" ? "قائمة الأسعار" : "Price list", items: lang === "ar" ? "علبة معمول — 6 دنانير\nصينية كنافة — 12 ديناراً\nمناقيش زعتر (6) — 3 دنانير" : "Ma'amoul box — 6 JOD\nKnafeh tray — 12 JOD\nZa'atar manaqish (6) — 3 JOD", footer: contactLine() }),
    multiline: ["items"],
    layout: (f, c, b) => {
      const rows = String(f.items || "").split("\n").filter(Boolean).slice(0, 14);
      const ar = lang === "ar";
      return [
        { t: "rect", x: 0, y: 0, w: 1240, h: 330, fill: c.primary },
        { t: "logo", x: ar ? 880 : 80, y: 50, w: 230, h: 230, svg: b.logo },
        { t: "text", x: ar ? 820 : 420, y: 200, text: f.title, size: 88, weight: 700, fill: c.bg, align: ar ? "right" : "left", maxWidth: 700, maxLines: 1 },
        ...rows.flatMap((row, i) => {
          const [name, price = ""] = row.split(/\s+[—–-]\s+/);
          const y = 470 + i * 88;
          return [
            { t: "text", x: ar ? 1140 : 100, y, text: name, size: 44, fill: c.text, align: ar ? "right" : "left", maxWidth: 760, maxLines: 1 },
            { t: "text", x: ar ? 100 : 1140, y, text: price, size: 44, weight: 700, fill: c.primary, align: ar ? "left" : "right", maxWidth: 300, maxLines: 1 },
            { t: "rect", x: 100, y: y + 26, w: 1040, h: 2, fill: c.accent },
          ];
        }),
        { t: "rect", x: 0, y: 1654, w: 1240, h: 100, fill: c.primary },
        { t: "text", x: 620, y: 1718, text: f.footer, size: 36, fill: c.bg, maxWidth: 1100, maxLines: 1 },
      ];
    },
  },
  {
    id: "sign", name: ["Shop sign (3:1)", "لافتة المحل (3:1)"], w: 2400, h: 800,
    fields: (b) => ({ ar: b.name.ar, en: b.name.en, line: sanadValue("phone") }),
    layout: (f, c, b) => [
      { t: "rect", x: 0, y: 0, w: 2400, h: 800, fill: c.primary },
      { t: "rect", x: 30, y: 30, w: 2340, h: 740, r: 30, stroke: c.accent, sw: 10 },
      { t: "logo", x: 120, y: 150, w: 500, h: 500, svg: b.logo },
      { t: "text", x: 2260, y: 380, text: f.ar, size: 230, weight: 700, fill: c.bg, align: "right", maxWidth: 1550, maxLines: 1 },
      { t: "text", x: 2260, y: 560, text: f.en, size: 110, weight: 700, fill: c.bg, align: "right", maxWidth: 1550, maxLines: 1 },
      { t: "text", x: 2260, y: 690, text: f.line, size: 64, fill: c.bg, align: "right", maxWidth: 1550, maxLines: 1 },
    ],
  },
];
const LABELS = { headline: ["Headline", "العنوان"], subline: ["Second line", "السطر الثاني"], cta: ["Button text", "نص الزر"], label: ["Text under the logo (optional)", "نص تحت الشعار (اختياري)"], title: ["Title", "العنوان"], tagline: ["Tagline", "الشعار النصي"], contact: ["Contact line", "سطر التواصل"], person: ["Your name", "اسمك"], role: ["Role", "المسمى"], phone: ["Phone", "الهاتف"], email: ["Email", "البريد"], body: ["Body text", "النص"], offer: ["Offer", "العرض"], items: ["Items (one per line: name — price)", "العناصر (سطر لكل عنصر: الاسم — السعر)"], footer: ["Footer", "التذييل"], ar: ["Arabic name", "الاسم العربي"], en: ["English name", "الاسم الإنجليزي"], line: ["Bottom line", "السطر السفلي"] };
const defaultColors = (b) => {
  const p = pal(b);
  return { bg: p.light, primary: p.primary, accent: p.accent, text: p.dark, accentText: p.secondary };
};
let designState = null; // { bid, tpl, fields, colors, version, approvedVersion, versions, dirty }

const designScreen = {
  async render() {
    const title = t("Design studio", "استوديو التصميم");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(t("Designs", "التصاميم"))}`;
    let brand;
    try {
      brand = await activeBrand();
    } catch (e) {
      return `<h1>${title}</h1><p class="error" role="alert">${esc(e.message)}</p>`;
    }
    if (!brandComplete(brand)) return `<div class="eyebrow">${t("Launch Studio", "استوديو الإطلاق")}</div><h1>${title}</h1><p class="summary">${t("Your designs follow your brand. Create your brand kit (name, colours, fonts and logo) first.", "تتبع تصاميمك هويتك. أنشئ هويتك (الاسم والألوان والخطوط والشعار) أولاً.")}</p><div class="toolbar"><button class="primary" data-go="studio-brand">${t("Create my brand", "أنشئ هويتي")}</button></div>`;
    const tplId = designState?.bid === bid() ? designState.tpl : "post";
    const tpl = TEMPLATES.find((x) => x.id === tplId);
    if (designState?.bid !== bid() || designState.tpl !== tplId || !designState.loaded) {
      const res = await wsGet("design", tplId);
      if (!res.ok) return `<h1>${title}</h1><p class="error" role="alert">${esc(errorText(res))}</p>`;
      const saved = res.data.latest?.data;
      designState = { bid: bid(), tpl: tplId, loaded: true, fields: saved?.fields || tpl.fields(brand), colors: saved?.colors || defaultColors(brand), version: res.data.latest?.version || 0, approvedVersion: res.data.approved?.version || 0, versions: res.data.versions || [], dirty: false };
    }
    const d = designState;
    const usingDraft = !brandState.approvedBrand;
    return `<div class="eyebrow">${t("Launch Studio · Designs", "استوديو الإطلاق · التصاميم")}</div>
      <h1>${title}</h1>
      <p class="subtitle">${t("Bedaya's own templates in your brand. Edit the text and colours, then download PNG or PDF.", "قوالب من تصميم بداية بهويتك. عدّل النصوص والألوان ثم نزّل PNG أو PDF.")}</p>
      ${usingDraft ? `<p class="note">${t("Using your latest brand draft. Approve the brand kit to lock it in.", "تُستخدم آخر مسودة لهويتك. اعتمد الهوية لتثبيتها.")}</p>` : ""}
      <div class="tabs template-tabs" role="tablist">${TEMPLATES.map((x) => `<button role="tab" data-tpl="${x.id}" aria-pressed="${x.id === tplId}">${tx(x.name)}</button>`).join("")}</div>
      ${versionBar("design", d)}
      <div class="design-layout">
        <div class="design-form">
          ${Object.keys(d.fields).map((k) => `<label class="field"><span>${tx(LABELS[k] || [k, k])}</span>${(tpl.multiline || []).includes(k) ? `<textarea data-field="${k}" rows="6" dir="auto">${esc(d.fields[k])}</textarea>` : `<input data-field="${k}" dir="auto" value="${esc(d.fields[k])}" maxlength="140">`}</label>`).join("")}
          <h3>${t("Colours", "الألوان")}</h3>
          <div class="palette compact">${Object.entries(d.colors).map(([k, v]) => `<label class="swatch"><input type="color" data-dcolor="${k}" value="${esc(v)}"><strong>${tx({ bg: ["Background", "الخلفية"], primary: ["Primary", "الأساسي"], accent: ["Accent", "المميز"], text: ["Text", "النص"], accentText: ["Second text", "نص ثانوي"] }[k] || [k, k])}</strong></label>`).join("")}</div>
          <div class="toolbar tight"><button id="reset-colors">${t("Use brand colours", "استخدم ألوان الهوية")}</button><button id="reset-text">${t("Reset text", "إعادة النص")}</button></div>
        </div>
        <div class="design-preview"><canvas id="design-canvas" aria-label="${t("Design preview", "معاينة التصميم")}"></canvas>
          <div class="toolbar tight"><button class="primary" id="dl-png">${t("Download PNG", "تنزيل PNG")}</button><button id="dl-pdf">${t("Download PDF", "تنزيل PDF")}</button></div></div>
      </div>`;
  },
  async mount() {
    const d = designState;
    if (!d || !$("#design-canvas")) return;
    const brand = await activeBrand();
    const tpl = TEMPLATES.find((x) => x.id === d.tpl);
    const b = { ...brand, logo: brand.logos[brand.logoIndex || 0], toneWord: brand.tone?.wordsAr?.[0] };
    await useFonts(brand.fonts);
    const spec = () => ({ w: tpl.w, h: tpl.h, bg: d.colors.bg, items: tpl.layout(d.fields, d.colors, b) });
    let timer;
    const draw = () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderSpec(spec(), $("#design-canvas"), brand.fonts), 120);
    };
    draw();
    const dirty = () => {
      d.dirty = true;
      const el = $("#design-dirty");
      if (el) el.hidden = false;
    };
    $$("[data-tpl]").forEach(
      (btn) =>
        (btn.onclick = () => {
          if (d.dirty && !confirm(t("Discard unsaved changes?", "تجاهل التغييرات غير المحفوظة؟"))) return;
          designState = { bid: bid(), tpl: btn.dataset.tpl, loaded: false };
          go("studio-design");
        }),
    );
    $$("[data-field]").forEach((inp) => (inp.oninput = () => ((d.fields[inp.dataset.field] = inp.value), dirty(), draw())));
    $$("[data-dcolor]").forEach((inp) => (inp.oninput = () => ((d.colors[inp.dataset.dcolor] = inp.value), dirty(), draw())));
    $("#reset-colors").onclick = () => ((d.colors = defaultColors(brand)), dirty(), go("studio-design"));
    $("#reset-text").onclick = () => ((d.fields = tpl.fields(b)), dirty(), go("studio-design"));
    const exportCanvas = async () => renderSpec(spec(), document.createElement("canvas"), brand.fonts);
    const name = `${slugify(brand.name.en) || "design"}-${tpl.id}`;
    $("#dl-png").onclick = async () => downloadBlob(await new Promise(async (r) => (await exportCanvas()).toBlob(r, "image/png")), `${name}.png`);
    $("#dl-pdf").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const png = await new Promise(async (r) => (await exportCanvas()).toBlob(r, "image/png"));
        const [w, h] = tpl.pdf || [tpl.w * 0.75, tpl.h * 0.75];
        downloadBlob(await pngToPdf(png, w, h), `${name}.pdf`);
      } catch {
        toast(t("The PDF couldn't be made.", "تعذر إنشاء ملف PDF."));
      } finally {
        e.target.disabled = false;
      }
    };
    const save = async (approved) => {
      const res = await wsSave("design", { fields: d.fields, colors: d.colors }, { item: d.tpl, approved });
      if (!res.ok) return toast(errorText(res));
      toast(approved ? t("Design approved.", "تم اعتماد التصميم.") : t("Draft saved.", "تم حفظ المسودة."));
      d.loaded = false;
      go("studio-design");
    };
    $("#design-save").onclick = () => save(false);
    $("#design-approve").onclick = () => save(true);
    const ver = $("#design-version");
    if (ver)
      ver.onchange = async () => {
        const res = await wsGet("design", d.tpl, Number(ver.value));
        if (!res.ok) return toast(errorText(res));
        Object.assign(d, { fields: res.data.data.data.fields, colors: res.data.data.data.colors, version: res.data.data.version, dirty: false });
        go("studio-design");
      };
  },
};

// ---------------------------------------------------------------- D3 website builder
let siteState = null; // { bid, site, version, approvedVersion, versions, dirty, chat: [], previewLang, device }
const SECTION_LABEL = { about: ["About", "من نحن"], products: ["Products / services", "المنتجات / الخدمات"], gallery: ["Gallery", "المعرض"], map: ["Map", "الخريطة"], contact: ["Contact form", "نموذج التواصل"] };

async function compressImage(file) {
  const img = await loadImage(URL.createObjectURL(file));
  const scale = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.72, 0.6, 0.5, 0.4]) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < 85000) return url;
  }
  return null;
}

const siteScreen = {
  async render() {
    const title = t("Website builder", "منشئ الموقع");
    if (!ready()) return `<h1>${title}</h1>${needsAccount(t("The website builder", "منشئ الموقع"))}`;
    if (siteState?.bid !== bid()) {
      const [draft, pub] = await Promise.all([wsGet("site"), studio("published")]);
      if (!draft.ok) return `<h1>${title}</h1><p class="error" role="alert">${esc(errorText(draft))}</p><div class="toolbar"><button data-go="studio-site">${t("Try again", "حاول مرة أخرى")}</button></div>`;
      siteState = { bid: bid(), site: draft.data.latest?.data || null, version: draft.data.latest?.version || 0, approvedVersion: draft.data.approved?.version || 0, versions: draft.data.versions || [], dirty: false, chat: [], previewLang: lang, device: "desktop", published: pub.ok ? pub.data.site : null, messages: pub.ok ? pub.data.messages : [] };
    }
    const s = siteState;
    const head = `<div class="eyebrow">${t("Launch Studio · Website", "استوديو الإطلاق · الموقع")}</div><h1>${title}</h1>`;
    if (!s.site) {
      const brand = await activeBrand().catch(() => null);
      return `${head}<p class="subtitle">${t("A bilingual one-page site or online store: hero, about, products, gallery, map, contact form and a WhatsApp button, in your brand.", "موقع أو متجر إلكتروني من صفحة واحدة بلغتين: واجهة ومن نحن ومنتجات ومعرض وخريطة ونموذج تواصل وزر واتساب، بهويتك.")}</p>
        ${brand ? `<div class="toolbar"><button class="primary" id="site-create">${t("Create my website draft", "أنشئ مسودة موقعي")}</button></div>` : `<p class="summary">${t("Create your brand kit first, so the website can follow it.", "أنشئ هويتك أولاً ليتبعها الموقع.")}</p><div class="toolbar"><button class="primary" data-go="studio-brand">${t("Create my brand", "أنشئ هويتي")}</button></div>`}`;
    }
    const st = s.site;
    const bi = (path, label, rows = 1, max = 240) => {
      const val = path.split(".").reduce((o, k) => o?.[k], st) || { en: "", ar: "" };
      const ctl = (l) => (rows > 1 ? `<textarea data-path="${path}.${l}" rows="${rows}" dir="${l === "ar" ? "rtl" : "ltr"}" maxlength="${max}">${esc(val[l])}</textarea>` : `<input data-path="${path}.${l}" dir="${l === "ar" ? "rtl" : "ltr"}" value="${esc(val[l])}" maxlength="${max}">`);
      return `<div class="grid-2 bi"><label class="field"><span>${label} · ${t("Arabic", "عربي")}</span>${ctl("ar")}</label><label class="field"><span>${label} · ${t("English", "إنجليزي")}</span>${ctl("en")}</label></div>`;
    };
    const host = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? `localhost${location.port ? `:${location.port}` : ""}` : location.host;
    const slugValue = s.published?.slug || slugify(st.name.en) || `business-${bid()}`;
    return `${head}
      <p class="subtitle">${t("Ask for changes in the chat or edit the text directly. The AI only fills Bedaya's template; it never writes code.", "اطلب التعديلات في المحادثة أو عدّل النص مباشرة. يملأ الذكاء الاصطناعي قالب بداية فقط ولا يكتب أي كود.")}</p>
      ${versionBar("site", s)}
      <div class="site-layout">
        <div class="site-edit">
          <div class="card chat-card"><h2>${t("Edit by chat", "التعديل بالمحادثة")}</h2>
            <div id="site-chat" class="site-chat" aria-live="polite">${s.chat.length ? s.chat.map((m) => `<p class="bubble ${m.role === "assistant" ? "assistant" : ""}">${esc(m.text)}</p>`).join("") : `<p class="muted">${t('Try: change the title to "Fresh from our oven" · add product "Date cookies" 4 · hide the gallery · make it darker', 'جرّب: غيّر العنوان إلى "طازج من فرننا" · أضف منتج "كعك بالتمر" 4 · أخفِ المعرض · اجعله أغمق')}</p>`}</div>
            <form id="site-chat-form" class="chat-form"><input id="site-chat-input" maxlength="500" placeholder="${t("What should change?", "ما الذي تريد تغييره؟")}" aria-label="${t("Change request", "طلب التعديل")}"><button class="primary">${t("Apply", "تطبيق")}</button></form></div>
          <details open><summary>${t("Type", "النوع")}</summary>
            <div class="options"><label class="option"><input type="radio" name="kind" value="site" ${st.kind === "site" ? "checked" : ""}>${t("One-page website", "موقع من صفحة واحدة")}</label><label class="option"><input type="radio" name="kind" value="store" ${st.kind === "store" ? "checked" : ""}>${t("Online store (order on WhatsApp)", "متجر إلكتروني (الطلب عبر واتساب)")}</label></div>
            <div class="chips">${Object.keys(SECTION_LABEL).map((k) => `<label class="option small"><input type="checkbox" data-section="${k}" ${st.sections[k] ? "checked" : ""}>${tx(SECTION_LABEL[k])}</label>`).join("")}</div></details>
          <details open><summary>${t("Hero", "الواجهة")}</summary>${bi("hero.title", t("Title", "العنوان"), 1, 120)}${bi("hero.subtitle", t("Tagline", "الشعار النصي"), 2, 240)}${bi("hero.cta", t("Button", "الزر"), 1, 40)}</details>
          <details><summary>${t("About", "من نحن")}</summary>${bi("about.title", t("Heading", "العنوان"), 1, 80)}${bi("about.body", t("Text", "النص"), 5, 1200)}</details>
          <details><summary>${t("Products / services", "المنتجات / الخدمات")} (${st.products.length})</summary>
            <div id="products">${st.products.map((p, i) => `<div class="card product-row">${bi(`products.${i}.name`, t("Name", "الاسم"), 1, 80)}${bi(`products.${i}.description`, t("Description", "الوصف"), 2, 300)}<div class="inline-actions"><label class="field compact"><span>${t("Price (JOD)", "السعر (دينار)")}</span><input type="number" min="0" step="0.5" data-price="${i}" value="${p.price ?? ""}"></label><button data-remove-product="${i}">${t("Remove", "حذف")}</button></div></div>`).join("")}</div>
            <div class="toolbar tight"><button id="add-product" ${st.products.length >= 24 ? "disabled" : ""}>${t("Add product", "إضافة منتج")}</button></div></details>
          <details><summary>${t("Gallery", "المعرض")} (${st.gallery.length})</summary>
            ${st.gallery.map((g, i) => `<div class="card product-row">${g.image ? `<img src="${g.image}" alt="" class="thumb">` : `<span class="muted">${t("Brand pattern (no photo)", "نقش الهوية (بلا صورة)")}</span>`}${bi(`gallery.${i}.caption`, t("Caption", "الوصف"), 1, 80)}<div class="inline-actions"><label class="button">${t("Upload photo", "رفع صورة")}<input type="file" accept="image/png,image/jpeg,image/webp" data-photo="${i}" hidden></label>${g.image ? `<button data-clear-photo="${i}">${t("Remove photo", "حذف الصورة")}</button>` : ""}<button data-remove-gallery="${i}">${t("Remove", "حذف")}</button></div></div>`).join("")}
            <div class="toolbar tight"><button id="add-gallery" ${st.gallery.length >= 6 ? "disabled" : ""}>${t("Add picture", "إضافة صورة")}</button></div></details>
          <details><summary>${t("Contact and map", "التواصل والخريطة")}</summary>
            <div class="grid-2"><label class="field"><span>${t("Phone", "الهاتف")}</span><input data-path="contact.phone" dir="ltr" value="${esc(st.contact.phone)}" maxlength="30"></label>
            <label class="field"><span>${t("WhatsApp number (international, digits only)", "رقم واتساب (دولي، أرقام فقط)")}</span><input data-path="contact.whatsapp" dir="ltr" inputmode="numeric" value="${esc(st.contact.whatsapp)}" maxlength="20" placeholder="9627…"></label>
            <label class="field"><span>${t("Email", "البريد")}</span><input data-path="contact.email" dir="ltr" value="${esc(st.contact.email)}" maxlength="120"></label></div>
            ${bi("contact.address", t("Address", "العنوان"), 1, 200)}${bi("contact.hours", t("Opening hours", "ساعات العمل"), 1, 120)}
            <p class="muted">${st.map ? t("The map uses the location saved on your business.", "تستخدم الخريطة الموقع المحفوظ على مشروعك.") : t("No location saved yet.", "لم يُحفظ موقع بعد.")} <a href="#location">${t("Set location", "تحديد الموقع")}</a> · <button class="linklike" id="sync-map">${t("Use my saved location", "استخدم موقعي المحفوظ")}</button></p></details>
        </div>
        <div class="site-preview">
          <div class="toolbar tight"><div class="tabs"><button data-device="phone" aria-pressed="${s.device === "phone"}"><i data-lucide="smartphone"></i>${t("Phone", "الهاتف")}</button><button data-device="desktop" aria-pressed="${s.device === "desktop"}"><i data-lucide="monitor"></i>${t("Desktop", "سطح المكتب")}</button></div>
            <div class="tabs"><button data-plang="ar" aria-pressed="${s.previewLang === "ar"}">العربية</button><button data-plang="en" aria-pressed="${s.previewLang === "en"}">English</button></div></div>
          <div class="frame-wrap ${s.device}"><iframe id="site-frame" title="${t("Website preview", "معاينة الموقع")}" src="/site-preview"></iframe></div>
          <div class="card publish-card"><h2>${t("Publish", "النشر")}</h2>
            ${s.published ? `<p><span class="status done">${t("Live", "منشور")}</span> <a href="/s/${esc(s.published.slug)}" target="_blank" rel="noopener">/s/${esc(s.published.slug)}</a> · <a href="${location.protocol}//${esc(s.published.slug)}.${esc(host)}/" target="_blank" rel="noopener" class="ltr">${esc(s.published.slug)}.${esc(host)}</a></p>` : `<p class="muted">${t("Not published yet.", "لم يُنشر بعد.")}</p>`}
            <label class="field"><span>${t("Web address (subdomain)", "عنوان الموقع (نطاق فرعي)")}</span><div class="slug-row ltr"><input id="slug" value="${esc(slugValue)}" maxlength="40" pattern="[a-z0-9-]+"><span>.${esc(host)}</span></div></label>
            <div class="toolbar tight"><button class="primary" id="publish">${s.published ? t("Approve and update the live site", "اعتماد وتحديث الموقع المنشور") : t("Approve and publish", "اعتماد ونشر")}</button></div>
            <p class="muted">${t("Want your own domain? Connect it from Business tools.", "تريد نطاقاً خاصاً بك؟ اربطه من أدوات الأعمال.")}</p></div>
          <div class="card"><h2>${t("Messages from your website", "رسائل من موقعك")} <span class="status info">${s.messages.length}</span></h2>
            ${s.messages.length ? `<div class="list">${s.messages.map((m) => `<div class="item"><div class="details"><strong>${esc(m.name)} · <span class="ltr">${esc(m.contact)}</span></strong><small>${esc(m.message)}</small><small>${new Date(m.created_at).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB")}</small></div></div>`).join("")}</div>` : `<p class="muted">${t("No messages yet. Visitors' contact-form messages appear here.", "لا رسائل بعد. تظهر هنا رسائل الزوار من نموذج التواصل.")}</p>`}</div>
        </div>
      </div>`;
  },
  async mount() {
    const s = siteState;
    const create = $("#site-create");
    if (create)
      create.onclick = async () => {
        create.disabled = true;
        const res = await studio("site");
        create.disabled = false;
        if (!res.ok) return toast(errorText(res));
        s.site = res.data.site;
        s.dirty = true;
        go("studio-site");
      };
    if (!s?.site || !$("#site-frame")) return;
    const st = s.site;
    const brand = await activeBrand().catch(() => null);
    if (brand?.fonts) useFonts(brand.fonts);
    const frame = $("#site-frame");
    const push = () => frame.contentWindow?.postMessage({ type: "bedaya-site-preview", site: st, lang: s.previewLang }, location.origin);
    window.onmessage = (e) => e.origin === location.origin && e.data?.type === "bedaya-site-preview-ready" && push();
    frame.onload = push;
    let timer;
    const changed = () => {
      s.dirty = true;
      const el = $("#site-dirty");
      if (el) el.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(push, 200);
    };
    const setPath = (path, value) => {
      const keys = path.split(".");
      const last = keys.pop();
      keys.reduce((o, k) => o[k], st)[last] = value;
    };
    $$("[data-path]").forEach((inp) => (inp.oninput = () => (setPath(inp.dataset.path, inp.dataset.path === "contact.whatsapp" ? inp.value.replace(/\D/g, "") : inp.value), changed())));
    $$("[data-price]").forEach((inp) => (inp.oninput = () => ((st.products[Number(inp.dataset.price)].price = inp.value === "" ? null : Math.max(0, Number(inp.value))), changed())));
    $$("[data-section]").forEach((cb) => (cb.onchange = () => ((st.sections[cb.dataset.section] = cb.checked), changed())));
    $$("input[name=kind]").forEach((r) => (r.onchange = () => ((st.kind = r.value), changed())));
    $("#add-product").onclick = () => (st.products.push({ name: { en: "", ar: "" }, description: { en: "", ar: "" }, price: null }), changed(), go("studio-site"));
    $$("[data-remove-product]").forEach((b) => (b.onclick = () => (st.products.splice(Number(b.dataset.removeProduct), 1), changed(), go("studio-site"))));
    $("#add-gallery").onclick = () => (st.gallery.push({ caption: { en: "", ar: "" }, image: "" }), changed(), go("studio-site"));
    $$("[data-remove-gallery]").forEach((b) => (b.onclick = () => (st.gallery.splice(Number(b.dataset.removeGallery), 1), changed(), go("studio-site"))));
    $$("[data-clear-photo]").forEach((b) => (b.onclick = () => ((st.gallery[Number(b.dataset.clearPhoto)].image = ""), changed(), go("studio-site"))));
    $$("[data-photo]").forEach(
      (inp) =>
        (inp.onchange = async () => {
          const f = inp.files[0];
          if (!f) return;
          const url = await compressImage(f).catch(() => null);
          if (!url) return toast(t("That photo couldn't be used. Try a smaller JPG or PNG.", "تعذر استخدام الصورة. جرّب JPG أو PNG أصغر."));
          st.gallery[Number(inp.dataset.photo)].image = url;
          changed();
          go("studio-site");
        }),
    );
    $("#sync-map").onclick = async () => {
      const res = await wsGet("location");
      const loc = res.ok ? res.data.latest?.data : null;
      if (!loc) return toast(t("Save your location on the Location page first.", "احفظ موقعك من صفحة الموقع أولاً."));
      st.map = { lat: loc.lat, lng: loc.lng };
      st.contact.address = { en: loc.address, ar: loc.address };
      st.sections.map = true;
      changed();
      go("studio-site");
    };
    $$("[data-device]").forEach((b) => (b.onclick = () => ((s.device = b.dataset.device), go("studio-site"))));
    $$("[data-plang]").forEach((b) => (b.onclick = () => ((s.previewLang = b.dataset.plang), $$("[data-plang]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))), push())));
    // chat edits
    $("#site-chat-form").onsubmit = async (e) => {
      e.preventDefault();
      const input = $("#site-chat-input");
      const instruction = input.value.trim();
      if (!instruction) return;
      input.value = "";
      s.chat.push({ role: "user", text: instruction });
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      $("#site-chat").insertAdjacentHTML("beforeend", `<p class="bubble">${esc(instruction)}</p><p class="bubble assistant" id="thinking">${t("Working on it…", "جارٍ التنفيذ…")}</p>`);
      const res = await api("/api/studio/site-edit", { method: "POST", body: { site: st, instruction, tone: brand ? tx(brand.tone) : undefined }, timeoutMs: 45000 });
      btn.disabled = false;
      $("#thinking")?.remove();
      if (!res.ok) {
        s.chat.push({ role: "assistant", text: errorText(res) });
        return go("studio-site");
      }
      s.chat.push({ role: "assistant", text: tx(res.data.reply) });
      if (res.data.changed) {
        s.site = res.data.site;
        s.dirty = true;
      }
      go("studio-site");
    };
    const save = async (approved) => {
      const res = await wsSave("site", st, { approved });
      if (!res.ok) return (toast(errorText(res)), false);
      Object.assign(s, { version: res.data.data.version, dirty: false });
      if (approved) s.approvedVersion = res.data.data.version;
      const v = await wsGet("site");
      if (v.ok) s.versions = v.data.versions;
      return true;
    };
    $("#site-save").onclick = async () => (await save(false)) && (toast(t("Draft saved.", "تم حفظ المسودة.")), go("studio-site"));
    $("#site-approve").onclick = async () => (await save(true)) && (toast(t("Approved. Publish it when you're ready.", "تم الاعتماد. انشره متى كنت جاهزاً.")), go("studio-site"));
    $("#publish").onclick = async (e) => {
      const slug = $("#slug").value.trim().toLowerCase();
      if (!/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return toast(t("Use 3–40 lowercase English letters, numbers or dashes.", "استخدم 3–40 حرفاً إنجليزياً صغيراً أو أرقاماً أو شرطات."));
      e.target.disabled = true;
      if (!(await save(true))) return (e.target.disabled = false);
      const res = await studio("publish", { slug, site: st });
      e.target.disabled = false;
      if (!res.ok) return toast(errorText(res));
      s.published = { slug: res.data.slug };
      toast(t("Your website is live.", "موقعك منشور الآن."));
      go("studio-site");
    };
    const ver = $("#site-version");
    if (ver)
      ver.onchange = async () => {
        if (s.dirty && !confirm(t("Discard unsaved changes?", "تجاهل التغييرات غير المحفوظة؟"))) return (ver.value = String(s.version));
        const res = await wsGet("site", "", Number(ver.value));
        if (!res.ok) return toast(errorText(res));
        Object.assign(s, { site: res.data.data.data, version: res.data.data.version, dirty: false });
        go("studio-site");
      };
  },
};

// Shared with Startup services (branded invoices and contracts).
export { activeBrand, brandComplete, downloadBlob, logoImage, pal, useFonts, wrap, svgUrl, slugify };
export async function canvasesToPdf(canvases, widthPt, heightPt) {
  await loadScript("/vendor/pdf-lib/pdf-lib.min.js");
  const { PDFDocument } = window.PDFLib;
  const pdf = await PDFDocument.create();
  for (const c of canvases) {
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const png = await pdf.embedPng(await blob.arrayBuffer());
    pdf.addPage([widthPt, heightPt]).drawImage(png, { x: 0, y: 0, width: widthPt, height: heightPt });
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

export const routes = {
  studio: { ...hub },
  "studio-brand": brandScreen,
  "studio-design": designScreen,
  "studio-site": siteScreen,
};
