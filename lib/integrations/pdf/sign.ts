// Stamps a visible signature block onto a generated form (feature 4).
// Mock only: a real SANAD signature would be a cryptographic signature on the
// PDF. The stamp records who signed, when, a reference, and the hash of the
// unsigned document so any later change is detectable.

import { PDFDocument, rgb } from "pdf-lib";
import { SIGNATURE_BOX } from "./fillForm";
import { drawText, embedFonts } from "./text";

export interface StampInfo {
  nameAr: string;
  nameEn: string;
  nationalId: string;
  signedAt: string;
  signatureRef: string;
  originalHash: string;
}

export async function stampSignature(pdfBytes: Uint8Array, s: StampInfo): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const f = await embedFonts(pdf);
  const page = pdf.getPages()[0];
  const b = SIGNATURE_BOX;
  const green = rgb(0.1, 0.5, 0.3);

  page.drawRectangle({ x: b.x, y: b.y, width: b.w, height: b.h, color: rgb(0.94, 0.98, 0.95), borderColor: green, borderWidth: 1.5 });

  // Seal on the left.
  const cx = b.x + 44;
  const cy = b.y + b.h / 2;
  page.drawCircle({ x: cx, y: cy, size: 30, borderColor: green, borderWidth: 2 });
  drawText(page, "SANAD", { x: cx, y: cy + 4, size: 10, fonts: f, bold: true, color: green, align: "center" });
  drawText(page, "MOCK", { x: cx, y: cy - 9, size: 8, fonts: f, bold: true, color: rgb(0.75, 0.16, 0.13), align: "center" });

  const right = b.x + b.w - 12;
  drawText(page, "تم التوقيع إلكترونيًا عبر سند (تجريبي)", { x: right, y: b.y + b.h - 18, size: 10.5, fonts: f, bold: true, color: green });
  drawText(page, s.nameAr, { x: right, y: b.y + b.h - 36, size: 11, fonts: f, bold: true });
  drawText(page, `${s.nameEn}  |  ID ${s.nationalId}`, { x: right, y: b.y + b.h - 51, size: 8.5, fonts: f, align: "right" });

  const left = b.x + 88;
  drawText(page, "Signed electronically via SANAD (MOCK)", { x: left, y: b.y + b.h - 18, size: 8.5, fonts: f, bold: true, color: green, align: "left" });
  drawText(page, `Signed at: ${s.signedAt.replace("T", " ").slice(0, 19)} UTC`, { x: left, y: b.y + 30, size: 7.5, fonts: f, align: "left" });
  drawText(page, `Ref: ${s.signatureRef}`, { x: left, y: b.y + 19, size: 7.5, fonts: f, align: "left" });
  drawText(page, `Document hash: ${s.originalHash.slice(0, 32)}...`, { x: left, y: b.y + 8, size: 6.5, fonts: f, color: rgb(0.42, 0.45, 0.5), align: "left" });

  return pdf.save();
}
