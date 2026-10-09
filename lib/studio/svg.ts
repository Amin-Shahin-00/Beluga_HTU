// Allow-list SVG sanitiser for logos written by the language model.
// The model's SVG is rebuilt element by element: only drawing elements and presentation attributes
// survive. No scripts, event handlers, links, external references, <foreignObject>, <style> or CSS.

const ELEMENTS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan",
  "defs", "lineargradient", "radialgradient", "stop", "title", "clippath",
]);
const CASE: Record<string, string> = { lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath" };
const ATTRS = new Set([
  "viewbox", "xmlns", "width", "height", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "dx", "dy",
  "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity",
  "fill-opacity", "stroke-opacity", "transform", "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "id", "offset", "stop-color", "stop-opacity",
  "gradientunits", "gradienttransform", "fill-rule", "clip-rule", "clip-path", "direction", "preserveaspectratio",
]);
const ATTR_CASE: Record<string, string> = { viewbox: "viewBox", gradientunits: "gradientUnits", gradienttransform: "gradientTransform", preserveaspectratio: "preserveAspectRatio" };
const MAX_LENGTH = 60_000;

const escText = (s: string) => s.replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[\da-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

function safeValue(name: string, value: string): string | null {
  const v = value.trim();
  if (v.length > 4000) return null;
  if (/[<>]|javascript:|data:|expression\s*\(|@import|\\/i.test(v)) return null;
  // url() is only allowed to point inside this SVG (gradients, clip paths).
  const urls = v.match(/url\s*\(([^)]*)\)/gi) || [];
  if (urls.some((u) => !/^url\s*\(\s*['"]?#[\w-]+['"]?\s*\)$/i.test(u))) return null;
  if (name === "xmlns" && v !== "http://www.w3.org/2000/svg") return null;
  return v;
}

/** Returns a clean SVG string, or null if the input isn't a usable SVG. */
export function sanitizeSvg(input: string): string | null {
  if (typeof input !== "string" || input.length > MAX_LENGTH) return null;
  const src = input.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const out: string[] = [];
  const stack: string[] = [];
  let skipDepth = 0; // inside a removed element: drop everything until it closes
  const token = /<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(src))) {
    const [whole, rawName, rawAttrs, text] = m;
    if (text !== undefined) {
      if (!skipDepth && stack.length && /^(text|tspan|title)$/i.test(stack[stack.length - 1])) out.push(escText(text));
      continue;
    }
    const name = rawName.toLowerCase();
    const closing = whole.startsWith("</");
    const selfClosing = /\/\s*$/.test(rawAttrs);
    if (skipDepth) {
      if (closing) skipDepth--;
      else if (!selfClosing) skipDepth++;
      continue;
    }
    if (!ELEMENTS.has(name)) {
      if (!closing && !selfClosing) skipDepth = 1;
      continue;
    }
    const tag = CASE[name] ?? name;
    if (closing) {
      // close back to the matching open element
      const at = stack.lastIndexOf(tag);
      if (at === -1) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (!stack.length && tag !== "svg") continue; // must start with <svg>
    const attrs: string[] = [];
    const attr = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;
    let a: RegExpExecArray | null;
    while ((a = attr.exec(rawAttrs))) {
      const key = a[1].toLowerCase();
      if (!ATTRS.has(key)) continue;
      const value = safeValue(key, a[3] ?? a[4] ?? a[5] ?? "");
      if (value === null) continue;
      attrs.push(`${ATTR_CASE[key] ?? key}="${escAttr(value)}"`);
    }
    if (tag === "svg" && !stack.length && !attrs.some((x) => x.startsWith("xmlns="))) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
    out.push(`<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClosing ? "/>" : ">"}`);
    if (!selfClosing) stack.push(tag);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  const svg = out.join("");
  if (!svg.startsWith("<svg") || !/<(path|circle|ellipse|rect|polygon|polyline|line|text)\b/.test(svg)) return null;
  return svg;
}
