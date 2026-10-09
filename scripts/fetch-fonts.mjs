// Downloads the Launch Studio brand fonts (all SIL Open Font Licence, from Google Fonts) into
// public/vendor/fonts so logos, designs, PDFs and published sites work offline.
// Run once: node scripts/fetch-fonts.mjs   (the files are committed; no runtime download)
import fs from "node:fs";
import path from "node:path";

const FAMILIES = ["Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Reem Kufi", "Amiri", "Inter", "Poppins", "Montserrat", "Nunito", "Lora", "Playfair Display", "Work Sans"];
// Only the scripts Bedaya shows: Arabic and basic Latin.
const SUBSETS = new Set(["arabic", "latin"]);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const out = path.resolve("public/vendor/fonts");
fs.mkdirSync(out, { recursive: true });

let css = "/* Brand fonts for the Launch Studio. SIL Open Font Licence 1.1, downloaded from Google Fonts by scripts/fetch-fonts.mjs. */\n";
let bytes = 0;
for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;700&display=swap`;
  const text = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  // Blocks look like: /* arabic */ @font-face { ... src: url(https://fonts.gstatic.com/...woff2) format('woff2'); unicode-range: ... }
  for (const [, subset, block] of text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    if (!SUBSETS.has(subset)) continue;
    const src = block.match(/url\((https:[^)]+)\)/)[1];
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const file = `${family.replace(/ /g, "")}-${weight}-${subset}.woff2`;
    const target = path.join(out, file);
    if (!fs.existsSync(target)) {
      const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
      fs.writeFileSync(target, buf);
    }
    bytes += fs.statSync(target).size;
    css += `${block.replace(src, `/vendor/fonts/${file}`)}\n`;
  }
  console.log("ok", family);
}
fs.writeFileSync(path.join(out, "fonts.css"), css);
fs.writeFileSync(path.join(out, "LICENSE.txt"), "All fonts in this folder are licensed under the SIL Open Font License, Version 1.1 (https://openfontlicense.org).\nSources: Google Fonts (fonts.google.com). Families: " + FAMILIES.join(", ") + "\n");
console.log(`total ${(bytes / 1048576).toFixed(2)} MB`);
