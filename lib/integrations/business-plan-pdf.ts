// PDF download for the business plan.
// TEMPORARY: the M5 partner owns the shared pdf-lib helper. Swap renderBusinessPlanPdf's body for a call to it
// when it lands. pdf-lib can't shape Arabic text, so this version renders the English plan only.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { BusinessPlan } from "./business-plan";

const MARGIN = 48;
const WIDTH = 595.28; // A4
const HEIGHT = 841.89;

export async function renderBusinessPlanPdf(plan: BusinessPlan): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(plan.title.en);
  pdf.setProducer("Bedaya");

  let page: PDFPage = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;

  const newPageIfNeeded = (height: number) => {
    if (y - height < MARGIN) {
      page = pdf.addPage([WIDTH, HEIGHT]);
      y = HEIGHT - MARGIN;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const write = (text: string, opts: { font?: PDFFont; size?: number; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    for (const line of wrap(ascii(text), font, size, WIDTH - 2 * MARGIN - indent)) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };

  const heading = (text: string) => {
    y -= 6;
    write(text, { font: bold, size: 12, color: [0.05, 0.35, 0.3], gap: 2 });
  };

  const row = (label: string, value: string, strong = false) => {
    newPageIfNeeded(14);
    const font = strong ? bold : regular;
    page.drawText(ascii(label), { x: MARGIN + 8, y: y - 10, size: 10, font });
    const w = font.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: WIDTH - MARGIN - w, y: y - 10, size: 10, font });
    y -= 14;
  };

  write(plan.title.en, { font: bold, size: 18, gap: 2 });
  write(`Generated ${plan.generatedAt} by Bedaya. Official fees from Jordanian government sources; other costs are estimates.`, {
    size: 8,
    color: [0.4, 0.4, 0.45],
    gap: 6,
  });

  heading("1. The business");
  write(plan.business.en, { gap: 4 });
  heading("2. Market");
  write(plan.market.en, { gap: 4 });

  heading("3. Costs");
  write("Setup", { font: bold });
  for (const l of plan.costs.setup) row(`${l.item.en}${l.kind === "estimate" ? " (est.)" : ""}`, `${l.amountJod} JOD`);
  row("Total setup", `${plan.costs.setupTotalJod} JOD`, true);
  y -= 4;
  write("Monthly running costs", { font: bold });
  for (const l of plan.costs.monthly) row(`${l.item.en}${l.kind === "estimate" ? " (est.)" : ""}`, `${l.amountJod} JOD`);
  row("Total per month", `${plan.costs.monthlyTotalJod} JOD`, true);

  heading("4. Funding needs");
  row("Own capital", `${plan.funding.ownCapitalJod} JOD`);
  row("Needed to launch (setup + 3 months)", `${plan.funding.neededToLaunchJod} JOD`);
  row("Funding requested", `${plan.funding.requestedJod} JOD`, true);
  y -= 2;
  write(plan.funding.summary.en, { gap: 4 });

  heading("5. Timeline");
  for (const t of plan.timeline) {
    write(`${t.start} to ${t.end}${t.durationKnown ? "" : " (est.)"}: ${t.title.en}, ${t.office.en}`, { indent: 8 });
  }

  return pdf.save();
}

/** Helvetica only covers Latin-1; replace the few typographic characters we use and drop anything else. */
function ascii(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}
