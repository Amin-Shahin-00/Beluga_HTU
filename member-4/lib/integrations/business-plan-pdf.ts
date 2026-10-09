// PDF download for the business plan, in English or Arabic.
// TEMPORARY home: the M5 partner owns the shared pdf-lib helper; move this onto it when it lands.
// Arabic uses the Amiri font (SIL Open Font License, lib/integrations/fonts/OFL.txt) with our own shaping
// and right-to-left layout (pdf-rtl.ts), because pdf-lib can't shape Arabic by itself.
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { BusinessPlan } from "./business-plan";
import { drawRtlLine, widthRtl, wrapRtl } from "./pdf-rtl";
import type { Bilingual, Lang } from "./types";

const MARGIN = 48;
const WIDTH = 595.28; // A4
const HEIGHT = 841.89;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const ACCENT = rgb(0.05, 0.35, 0.3);

const LABELS = {
  generated: {
    en: (d: string) => `Generated ${d} by Bedaya. Official fees come from Jordanian government sources; other costs are estimates.`,
    ar: (d: string) => `أُنشئت في ${d} بواسطة بداية. الرسوم الرسمية من مصادر حكومية أردنية، وباقي التكاليف تقديرية.`,
  },
  business: { en: "1. The business", ar: "1. المشروع" },
  market: { en: "2. Market", ar: "2. السوق" },
  costs: { en: "3. Costs", ar: "3. التكاليف" },
  setup: { en: "Setup", ar: "التجهيز" },
  setupTotal: { en: "Total setup", ar: "مجموع التجهيز" },
  monthly: { en: "Monthly running costs", ar: "التكاليف الشهرية" },
  monthlyTotal: { en: "Total per month", ar: "المجموع الشهري" },
  funding: { en: "4. Funding needs", ar: "4. الاحتياجات التمويلية" },
  ownCapital: { en: "Own capital", ar: "رأس المال الذاتي" },
  needed: { en: "Needed to launch (setup + 3 months)", ar: "المطلوب للانطلاق (تجهيز + 3 أشهر)" },
  requested: { en: "Funding requested", ar: "التمويل المطلوب" },
  timeline: { en: "5. Timeline", ar: "5. الجدول الزمني" },
  est: { en: " (est.)", ar: " (تقدير)" },
  jod: { en: "JOD", ar: "دينار" },
} satisfies Record<string, Bilingual | { en: (d: string) => string; ar: (d: string) => string }>;

let amiri: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadAmiri() {
  const dir = path.join(process.cwd(), "lib", "integrations", "fonts");
  amiri ??= { regular: await readFile(path.join(dir, "Amiri-Regular.ttf")), bold: await readFile(path.join(dir, "Amiri-Bold.ttf")) };
  return amiri;
}

/** Text drawing that works left-to-right (English, Helvetica) or right-to-left (Arabic, Amiri). */
interface Writer {
  wrap(text: string, font: PDFFont, size: number, width: number): string[];
  /** Draws a line starting at the reading edge (left for English, right for Arabic), indented by `indent`. */
  line(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, indent: number): void;
  /** Draws text ending at the far edge (right for English, left for Arabic). */
  farEdge(page: PDFPage, text: string, y: number, size: number, font: PDFFont): void;
}

const ltr: Writer = {
  wrap(text, font, size, width) {
    const lines: string[] = [];
    let line = "";
    for (const word of latin1(text).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  },
  line: (page, text, y, size, font, color, indent) => page.drawText(latin1(text), { x: MARGIN + indent, y, size, font, color }),
  farEdge: (page, text, y, size, font) => page.drawText(latin1(text), { x: WIDTH - MARGIN - font.widthOfTextAtSize(latin1(text), size), y, size, font, color: INK }),
};

const rtl: Writer = {
  wrap: wrapRtl,
  line: (page, text, y, size, font, color, indent) => drawRtlLine(page, text, { right: WIDTH - MARGIN - indent, y, size, font, color }),
  farEdge: (page, text, y, size, font) => drawRtlLine(page, text, { right: MARGIN + widthRtl(text, font, size), y, size, font, color: INK }),
};

export async function renderBusinessPlanPdf(plan: BusinessPlan, lang: Lang = "en"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let regular: PDFFont;
  let bold: PDFFont;
  if (lang === "ar") {
    pdf.registerFontkit(fontkit);
    const fonts = await loadAmiri();
    // Subsetting garbles Amiri in pdf-lib, so the whole font is embedded (adds about 0.8 MB).
    regular = await pdf.embedFont(fonts.regular, { subset: false });
    bold = await pdf.embedFont(fonts.bold, { subset: false });
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  const w = lang === "ar" ? rtl : ltr;
  const tx = (b: Bilingual) => b[lang];
  const jod = (n: number) => `${n.toLocaleString("en")} ${tx(LABELS.jod)}`;
  pdf.setTitle(tx(plan.title));
  pdf.setProducer("Bedaya");
  pdf.setLanguage(lang === "ar" ? "ar-JO" : "en");

  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;
  // Amiri's Arabic needs more line height than Helvetica.
  const leading = lang === "ar" ? 1.7 : 1.4;

  const ensure = (height: number) => {
    if (y - height < MARGIN) {
      page = pdf.addPage([WIDTH, HEIGHT]);
      y = HEIGHT - MARGIN;
    }
  };

  const write = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    for (const line of w.wrap(text, font, size, WIDTH - 2 * MARGIN - indent)) {
      ensure(size * leading);
      y -= size * leading;
      w.line(page, line, y + size * (leading - 1), size, font, opts.color ?? INK, indent);
    }
    y -= opts.gap ?? 0;
  };

  const heading = (text: string) => {
    y -= 6;
    write(text, { font: bold, size: 12, color: ACCENT, gap: 2 });
  };

  const row = (label: string, value: string, strong = false) => {
    const font = strong ? bold : regular;
    const lines = w.wrap(label, font, 10, WIDTH - 2 * MARGIN - 110);
    ensure(lines.length * 10 * leading);
    lines.forEach((l, i) => {
      y -= 10 * leading;
      const base = y + 10 * (leading - 1);
      w.line(page, l, base, 10, font, INK, 8);
      if (i === 0) w.farEdge(page, value, base, 10, font);
    });
  };

  write(tx(plan.title), { font: bold, size: 18, gap: 2 });
  write(LABELS.generated[lang](plan.generatedAt), { size: 8, color: MUTED, gap: 6 });

  heading(tx(LABELS.business));
  write(tx(plan.business), { gap: 4 });
  heading(tx(LABELS.market));
  write(tx(plan.market), { gap: 4 });

  heading(tx(LABELS.costs));
  write(tx(LABELS.setup), { font: bold });
  for (const l of plan.costs.setup) row(`${tx(l.item)}${l.kind === "estimate" ? tx(LABELS.est) : ""}`, jod(l.amountJod));
  row(tx(LABELS.setupTotal), jod(plan.costs.setupTotalJod), true);
  y -= 4;
  write(tx(LABELS.monthly), { font: bold });
  for (const l of plan.costs.monthly) row(`${tx(l.item)}${l.kind === "estimate" ? tx(LABELS.est) : ""}`, jod(l.amountJod));
  row(tx(LABELS.monthlyTotal), jod(plan.costs.monthlyTotalJod), true);

  heading(tx(LABELS.funding));
  row(tx(LABELS.ownCapital), jod(plan.funding.ownCapitalJod));
  row(tx(LABELS.needed), jod(plan.funding.neededToLaunchJod));
  row(tx(LABELS.requested), jod(plan.funding.requestedJod), true);
  y -= 2;
  write(tx(plan.funding.summary), { gap: 4 });

  heading(tx(LABELS.timeline));
  for (const t of plan.timeline) {
    const span = t.start === t.end ? t.start : `${t.start} - ${t.end}`;
    write(`${span}${t.durationKnown ? "" : tx(LABELS.est)}: ${tx(t.title)}${lang === "ar" ? "، " : ", "}${tx(t.office)}`, { indent: 8 });
  }

  return pdf.save();
}

/** Helvetica only covers Latin-1; replace the typographic characters we use and drop anything else. */
function latin1(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}
