// Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, commas and newlines inside quotes.
import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export function readCsv(url) {
  const [header, ...rows] = parseCsv(readFileSync(url, "utf8").replace(/^﻿/, ""));
  return rows.map((cells, n) => {
    if (cells.length !== header.length) {
      throw new Error(`${url.pathname}: row ${n + 2} has ${cells.length} columns, expected ${header.length}`);
    }
    return Object.fromEntries(header.map((key, i) => [key, cells[i].trim()]));
  });
}
