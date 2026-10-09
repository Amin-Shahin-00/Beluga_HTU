// Auto-fill (feature 3): turns a template + the user's data into a PDF.
// Each value shows where it came from (SANAD, ID scan, or typed by the user).

import { PDFDocument, rgb } from "pdf-lib";
import type { Source } from "../types";
import type { FormContext, FormTemplate } from "./templates";
import { drawText, embedFonts, wrapLines } from "./text";

export const PAGE = { w: 595.28, h: 841.89 }; // A4
/** Where the signature goes. sign.ts stamps inside this box. */
export const SIGNATURE_BOX = { x: 40, y: 56, w: 515, h: 92 };

const C = {
  ink: rgb(0.1, 0.12, 0.16),
  muted: rgb(0.42, 0.45, 0.5),
  line: rgb(0.85, 0.87, 0.9),
  band: rgb(0.99, 0.94, 0.93),
  red: rgb(0.75, 0.16, 0.13),
  green: rgb(0.1, 0.5, 0.3),
  blue: rgb(0.13, 0.36, 0.7),
  zebra: rgb(0.975, 0.98, 0.985),
};

const SOURCE_TAG: Record<Source, { text: string; color: ReturnType<typeof rgb> }> = {
  verified_by_sanad: { text: "Verified by SANAD (mock) | موثق من سند", color: C.green },
  read_by_ocr: { text: "Read from ID scan | من مسح الهوية", color: C.blue },
  typed_by_user: { text: "Typed by user | أدخله المستخدم", color: C.muted },
};

export interface FilledForm {
  bytes: Uint8Array;
  title: string;
  fieldSources: Record<string, Source>;
  /** Field keys with no value: the user must fill these in. */
  missing: string[];
}

export async function fillForm(t: FormTemplate, ctx: FormContext, referenceNo: string): Promise<FilledForm> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${t.titleEn} (DEMO)`);
  pdf.setProducer("Bedaya demo");
  const f = await embedFonts(pdf);
  const page = pdf.addPage([PAGE.w, PAGE.h]);
  const L = 40;
  const R = PAGE.w - 40;

  // Demo warning band.
  page.drawRectangle({ x: 0, y: PAGE.h - 34, width: PAGE.w, height: 34, color: C.band });
  drawText(page, "DEMO FORM - NOT AN OFFICIAL GOVERNMENT FORM", { x: L, y: PAGE.h - 22, size: 9, fonts: f, bold: true, color: C.red, align: "left" });
  drawText(page, "نموذج تجريبي - ليس نموذجًا حكوميًا رسميًا", { x: R, y: PAGE.h - 22, size: 10, fonts: f, bold: true, color: C.red });

  // Authority and title.
  let y = PAGE.h - 66;
  drawText(page, t.authorityAr(ctx), { x: R, y, size: 11, fonts: f, color: C.muted, maxWidth: 255 });
  drawText(page, t.authorityEn(ctx), { x: L, y, size: 9, fonts: f, color: C.muted, align: "left", maxWidth: 255 });
  y -= 30;
  drawText(page, t.titleAr, { x: R, y, size: 17, fonts: f, bold: true, maxWidth: 300 });
  y -= 22;
  drawText(page, t.titleEn, { x: R, y, size: 11, fonts: f, color: C.muted, align: "right", maxWidth: 300 });

  // Reference box on the left.
  const today = new Date().toISOString().slice(0, 10);
  drawText(page, `Ref: ${referenceNo}`, { x: L, y: y + 22, size: 9, fonts: f, align: "left" });
  drawText(page, `Date: ${today}`, { x: L, y: y + 8, size: 9, fonts: f, align: "left" });

  y -= 22;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: C.ink });

  // Field table: English label | value + source | Arabic label.
  const rowH = 33;
  const colEn = { x: L + 6, w: 132 };
  const colVal = { x: L + 146, w: 236 };
  const colAr = { right: R - 6, w: 120 };
  const fieldSources: Record<string, Source> = {};
  const missing: string[] = [];

  t.fields.forEach((field, i) => {
    const top = y - i * rowH;
    if (i % 2 === 0) page.drawRectangle({ x: L, y: top - rowH, width: R - L, height: rowH, color: C.zebra });
    page.drawLine({ start: { x: L, y: top - rowH }, end: { x: R, y: top - rowH }, thickness: 0.5, color: C.line });

    drawText(page, field.labelEn, { x: colEn.x, y: top - 20, size: 8.5, fonts: f, color: C.muted, align: "left", maxWidth: colEn.w });
    drawText(page, field.labelAr, { x: colAr.right, y: top - 20, size: 9.5, fonts: f, bold: true, maxWidth: colAr.w });

    const v = field.get(ctx);
    if (v && String(v.value).trim()) {
      fieldSources[field.key] = v.source;
      drawText(page, String(v.value), { x: colVal.x + colVal.w / 2, y: top - 15, size: 10.5, fonts: f, align: "center", maxWidth: colVal.w });
      const tag = SOURCE_TAG[v.source];
      drawText(page, tag.text, { x: colVal.x + colVal.w / 2, y: top - 27, size: 6.5, fonts: f, color: tag.color, align: "center", maxWidth: colVal.w });
    } else {
      missing.push(field.key);
      drawText(page, "Missing - please fill | ناقص - يرجى الإدخال", { x: colVal.x + colVal.w / 2, y: top - 19, size: 8.5, fonts: f, color: C.red, align: "center", maxWidth: colVal.w });
    }
  });

  // Pledge text (pledge forms only): Arabic, then English.
  if (t.statement) {
    let sy = y - t.fields.length * rowH - 26;
    drawText(page, "الإقرار والتعهد", { x: R, y: sy, size: 11, fonts: f, bold: true });
    drawText(page, "Declaration", { x: L, y: sy, size: 9, fonts: f, bold: true, color: C.muted, align: "left" });
    sy -= 18;
    for (const line of wrapLines(t.statement.ar, 10.5, f, R - L)) {
      drawText(page, line, { x: R, y: sy, size: 10.5, fonts: f });
      sy -= 16;
    }
    sy -= 4;
    for (const line of wrapLines(t.statement.en, 9, f, R - L)) {
      drawText(page, line, { x: L, y: sy, size: 9, fonts: f, color: C.muted, align: "left" });
      sy -= 13;
    }
  }

  // Signature box (empty until signed).
  const b = SIGNATURE_BOX;
  page.drawRectangle({ x: b.x, y: b.y, width: b.w, height: b.h, borderColor: C.line, borderWidth: 1, borderDashArray: [4, 3] });
  drawText(page, "توقيع مقدم الطلب", { x: b.x + b.w - 10, y: b.y + b.h - 18, size: 10, fonts: f, bold: true });
  drawText(page, "Applicant signature", { x: b.x + 10, y: b.y + b.h - 18, size: 9, fonts: f, color: C.muted, align: "left" });
  drawText(page, "Not signed yet - sign all documents in Bedaya | لم يتم التوقيع بعد", {
    x: b.x + b.w / 2,
    y: b.y + b.h / 2 - 8,
    size: 8.5,
    fonts: f,
    color: C.muted,
    align: "center",
  });

  // Footer.
  drawText(page, "Generated by Bedaya (hackathon demo). Data in this form is dummy data.", { x: L, y: 30, size: 7, fonts: f, color: C.muted, align: "left" });

  return { bytes: await pdf.save(), title: t.titleEn, fieldSources, missing };
}
