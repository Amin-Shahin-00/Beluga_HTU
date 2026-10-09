// Right-to-left text for pdf-lib. pdf-lib can't shape Arabic, so we:
//  1. split each line into runs: Arabic (right-to-left) and Latin/number (left-to-right),
//  2. shape Arabic runs into connected letter forms (arabic-shaping.ts),
//  3. draw the runs from the right margin leftwards. fontkit draws each shaped Arabic run in visual order itself.
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { shapeArabic } from "./arabic-shaping";

interface Run {
  text: string;
  rtl: boolean;
}

type Kind = "L" | "R" | "N";
const kindOf = (ch: string, prev: string | undefined): Kind => {
  if (/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(ch)) return "R";
  if (/[A-Za-z0-9]/.test(ch)) return "L";
  if (ch === "%" && prev && /[0-9]/.test(prev)) return "L";
  return "N";
};

/** Logical-order runs for a right-to-left paragraph. Neutral characters take the direction of their neighbours, else right-to-left. */
export function toRuns(line: string): Run[] {
  // Short-vowel marks (all harakat except shadda) split runs in fontkit; everyday Arabic reads fine without them.
  const chars = [...line.replace(/[ً-ِْ-ٟ]/g, "")];
  const kinds = chars.map((c, i) => kindOf(c, chars[i - 1]));
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== "N") continue;
    let j = i;
    while (j < kinds.length && kinds[j] === "N") j++;
    const before = kinds[i - 1];
    const after = kinds[j];
    const resolved: Kind = before === "L" && after === "L" ? "L" : "R";
    for (let k = i; k < j; k++) kinds[k] = resolved;
    i = j - 1;
  }
  const runs: Run[] = [];
  chars.forEach((c, i) => {
    const rtl = kinds[i] === "R";
    const last = runs.at(-1);
    if (last && last.rtl === rtl) last.text += c;
    else runs.push({ text: c, rtl });
  });
  // fontkit mirrors brackets inside right-to-left runs itself (the font's rtlm feature), so they stay as typed.
  return runs.map((r) => (r.rtl ? { rtl: true, text: shapeArabic(r.text) } : r));
}

export const widthRtl = (line: string, font: PDFFont, size: number) => toRuns(line).reduce((w, r) => w + font.widthOfTextAtSize(r.text, size), 0);

/** Word-wraps a right-to-left paragraph to `width`. */
export function wrapRtl(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthRtl(next, font, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws one line so that it ends at `right` (the right margin). */
export function drawRtlLine(page: PDFPage, line: string, opts: { right: number; y: number; size: number; font: PDFFont; color?: RGB }) {
  let x = opts.right;
  for (const run of toRuns(line)) {
    const w = opts.font.widthOfTextAtSize(run.text, opts.size);
    x -= w;
    if (run.text.trim()) page.drawText(run.text, { x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
  }
}
