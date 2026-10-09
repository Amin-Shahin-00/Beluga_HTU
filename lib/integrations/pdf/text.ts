// Mixed Arabic/English text for pdf-lib.
//
// pdf-lib (with fontkit) joins Arabic letters correctly but does not do
// right-to-left word order, and the Arabic font has no Latin glyphs. This
// helper splits text into Arabic and Latin pieces, picks the right font for
// each, orders words right-to-left when the line is Arabic, and draws them.

import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, PDFFont, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";

const FONT_DIR = join(process.cwd(), "assets", "fonts");

export interface Fonts {
  ar: PDFFont;
  arBold: PDFFont;
  latin: PDFFont;
  latinBold: PDFFont;
  arChars: Set<number>;
}

let fontBytes: { regular: Uint8Array; bold: Uint8Array; chars: Set<number> } | null = null;

function loadFontBytes() {
  if (fontBytes) return fontBytes;
  const regular = new Uint8Array(readFileSync(join(FONT_DIR, "IBMPlexSansArabic-Regular.ttf")));
  const bold = new Uint8Array(readFileSync(join(FONT_DIR, "IBMPlexSansArabic-Bold.ttf")));
  const chars = new Set<number>((fontkit.create(regular) as unknown as { characterSet: number[] }).characterSet);
  return (fontBytes = { regular, bold, chars });
}

export async function embedFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const b = loadFontBytes();
  return {
    ar: await pdf.embedFont(b.regular, { subset: true }),
    arBold: await pdf.embedFont(b.bold, { subset: true }),
    latin: await pdf.embedFont(StandardFonts.Helvetica),
    latinBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    arChars: b.chars,
  };
}

// ---------------------------------------------------------------- layout

const ARABIC_LETTER = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN_STRONG = /[A-Za-z0-9]/;

type Dir = "rtl" | "ltr" | "neutral";
interface Seg {
  text: string;
  arabicFont: boolean;
}
interface Word {
  segs: Seg[];
  dir: Dir;
}

const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };
function mirror(text: string) {
  return [...text].map((c) => MIRROR[c] ?? c).join("");
}

function wordDir(w: string): Dir {
  if (ARABIC_LETTER.test(w)) return "rtl";
  if (LATIN_STRONG.test(w)) return "ltr";
  return "neutral";
}

function splitSegments(word: string, arChars: Set<number>): Seg[] {
  const segs: Seg[] = [];
  for (const ch of word) {
    // Spaces never reach here; ASCII always goes to the Latin font.
    const useAr = ch.codePointAt(0)! > 127 && arChars.has(ch.codePointAt(0)!);
    const last = segs[segs.length - 1];
    if (last && last.arabicFont === useAr) last.text += ch;
    else segs.push({ text: ch, arabicFont: useAr });
  }
  return segs;
}

export function isRtl(text: string) {
  const firstStrong = [...text].find((c) => ARABIC_LETTER.test(c) || /[A-Za-z]/.test(c));
  return !!firstStrong && ARABIC_LETTER.test(firstStrong);
}

/** Words in left-to-right drawing order, each with its pieces in drawing order. */
function visualWords(text: string, arChars: Set<number>): Word[] {
  const rtl = isRtl(text);
  const words: Word[] = text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const dir = wordDir(w);
      let segs = splitSegments(w, arChars);
      if (dir === "rtl" || (dir === "neutral" && rtl)) {
        // Right-to-left: reverse the pieces (e.g. ذ.م.م) and mirror brackets.
        segs = segs.reverse().map((s) => (s.arabicFont ? s : { ...s, text: mirror(s.text) }));
      }
      return { segs, dir };
    });
  const resolved = words.map((w) => ({ ...w, dir: w.dir === "neutral" ? (rtl ? "rtl" : "ltr") : w.dir }) as Word);

  // Group runs of the minority direction so they keep their own order.
  const runs: Word[][] = [];
  for (const w of resolved) {
    const last = runs[runs.length - 1];
    if (last && last[0].dir === w.dir) last.push(w);
    else runs.push([w]);
  }
  if (rtl) {
    return runs.reverse().flatMap((run) => (run[0].dir === "rtl" ? [...run].reverse() : run));
  }
  return runs.flatMap((run) => (run[0].dir === "rtl" ? [...run].reverse() : run));
}

function fontFor(seg: Seg, f: Fonts, bold: boolean) {
  return seg.arabicFont ? (bold ? f.arBold : f.ar) : bold ? f.latinBold : f.latin;
}

/** Latin fonts only know WinAnsi; replace anything they cannot draw. */
function safeLatin(text: string) {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

export function measure(text: string, size: number, f: Fonts, bold = false) {
  const words = visualWords(text, f.arChars);
  const space = (bold ? f.latinBold : f.latin).widthOfTextAtSize(" ", size);
  let w = 0;
  words.forEach((word, i) => {
    for (const s of word.segs) {
      w += fontFor(s, f, bold).widthOfTextAtSize(s.arabicFont ? s.text : safeLatin(s.text), size);
    }
    if (i < words.length - 1) w += space;
  });
  return w;
}

/** Splits a paragraph into lines that fit maxWidth (words in reading order; drawText orders them). */
export function wrapLines(text: string, size: number, f: Fonts, maxWidth: number, bold = false): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size, f, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface DrawOpts {
  x: number;
  y: number;
  size: number;
  fonts: Fonts;
  bold?: boolean;
  color?: RGB;
  /** left: x is the left edge. right: x is the right edge. center: x is the middle. */
  align?: "left" | "right" | "center";
  /** Shrinks the font (down to 6pt) until the text fits. */
  maxWidth?: number;
}

/** Draws one line of mixed Arabic/English text. Returns the width drawn. */
export function drawText(page: PDFPage, text: string, o: DrawOpts) {
  const bold = !!o.bold;
  let size = o.size;
  let width = measure(text, size, o.fonts, bold);
  if (o.maxWidth) {
    while (width > o.maxWidth && size > 6) {
      size -= 0.5;
      width = measure(text, size, o.fonts, bold);
    }
  }
  const align = o.align ?? (isRtl(text) ? "right" : "left");
  let x = align === "left" ? o.x : align === "right" ? o.x - width : o.x - width / 2;
  const space = (bold ? o.fonts.latinBold : o.fonts.latin).widthOfTextAtSize(" ", size);
  const color = o.color ?? rgb(0.1, 0.12, 0.16);

  visualWords(text, o.fonts.arChars).forEach((word) => {
    for (const s of word.segs) {
      const font = fontFor(s, o.fonts, bold);
      const t = s.arabicFont ? s.text : safeLatin(s.text);
      page.drawText(t, { x, y: o.y, size, font, color });
      x += font.widthOfTextAtSize(t, size);
    }
    x += space;
  });
  return width;
}
