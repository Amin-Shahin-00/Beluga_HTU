// Stand-in for M4's database tables. Same table names M4 will create in
// Supabase (see db/m5-tables.sql), kept in a local JSON file so the demo
// works offline. To switch: replace the functions in this file with Supabase
// calls; nothing else in lib/integrations touches storage directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { BusinessProfile, DocType, OcrResult, Payment, SanadUser, Source } from "./types";

// Vercel's project folder is read-only, so use /tmp there. /tmp is per server
// instance and gets wiped, so on Vercel data can disappear between requests
// until M4's Supabase replaces this file. Local `npm run dev` keeps .data/.
const DATA_DIR = process.env.BEDAYA_DATA_DIR ?? (process.env.VERCEL ? "/tmp/bedaya-data" : join(process.cwd(), ".data"));
const DB_FILE = join(DATA_DIR, "db.json");
const FILES_DIR = join(DATA_DIR, "files");

// ---------------------------------------------------------------- rows

export type DocumentKind = "upload" | "generated";
/** Generated forms: ready_to_sign → signed → submitted → approved | returned (returned forms can be regenerated). */
export type DocumentStatus = "uploaded" | "ready_to_sign" | "signed" | "submitted" | "approved" | "returned";
export type ReviewDecision = "approved" | "returned";

export interface DocumentRow {
  id: string;
  nationalId: string;
  kind: DocumentKind;
  /** Upload: what the user said it is. Generated: the form template key. */
  docType: DocType | string;
  title: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  ocr?: OcrResult;
  /** For generated forms: where each filled value came from. */
  fieldSources?: Record<string, Source>;
  /** For generated forms: fields left empty that the user must fill. */
  missingFields?: string[];
  /** For generated forms: the government office that receives it (OfficeKey in offices.ts). */
  office?: string;
  submittedAt?: string;
  /** The office's latest decision, shown to the user. History is in `reviews`. */
  review?: { decision: ReviewDecision; note?: string; at: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRow {
  id: string;
  documentId: string;
  nationalId: string;
  office: string;
  decision: ReviewDecision;
  note?: string;
  createdAt: string;
}

export interface SignatureRow {
  id: string;
  documentId: string;
  nationalId: string;
  provider: "mock_sanad" | "sanad";
  signatureRef: string;
  hash: string;
  signedAt: string;
}

export type NotificationEvent =
  | "step_changed"
  | "document_needed"
  | "visit_soon"
  | "forms_ready"
  | "documents_signed"
  | "forms_submitted"
  | "form_approved"
  | "form_returned";

export interface NotificationRow {
  id: string;
  nationalId: string;
  event: NotificationEvent;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface OutboxRow {
  id: string;
  channel: "email" | "whatsapp";
  to: string;
  subject?: string;
  body: string;
  /** Email: "logged" (demo, nothing sent). WhatsApp: always "would_send". */
  status: "logged" | "would_send";
  createdAt: string;
}

export interface ConsentRow {
  id: string;
  nationalId: string;
  action: "consent_given" | "consent_revoked" | "data_accessed";
  scopes: string[];
  /** Who or what read the data, e.g. "sanad_login", "form_autofill". */
  purpose: string;
  createdAt: string;
}

interface MockCodeRow {
  code: string;
  nationalId: string;
  scopes: string[];
  expiresAt: string;
  used: boolean;
}

interface Db {
  documents: DocumentRow[];
  signatures: SignatureRow[];
  notifications: NotificationRow[];
  outbox: OutboxRow[];
  consent_log: ConsentRow[];
  payments: Payment[];
  reviews: ReviewRow[];
  /** Business info the user edited. Stand-in for M4's wizard answers. */
  profiles: BusinessProfile[];
  mock_sanad_codes: MockCodeRow[];
  /** The verified record SANAD returned at the last login (IdentityProvider.exchangeCode), per national ID. */
  sanad_sessions: { nationalId: string; user: SanadUser; receivedAt: string }[];
}

const EMPTY: Db = {
  documents: [],
  signatures: [],
  notifications: [],
  outbox: [],
  consent_log: [],
  payments: [],
  reviews: [],
  profiles: [],
  mock_sanad_codes: [],
  sanad_sessions: [],
};

// ---------------------------------------------------------------- core

function load(): Db {
  if (!existsSync(DB_FILE)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_FILE, "utf8")) };
}

function save(db: Db) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function now() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

export function insert<K extends keyof Db>(table: K, row: Db[K][number]): Db[K][number] {
  const db = load();
  (db[table] as Db[K][number][]).push(row);
  save(db);
  return row;
}

export function list<K extends keyof Db>(table: K, where: (r: Db[K][number]) => boolean = () => true): Db[K] {
  return (load()[table] as Db[K][number][]).filter(where) as Db[K];
}

export function find<K extends keyof Db>(table: K, where: (r: Db[K][number]) => boolean): Db[K][number] | undefined {
  return (load()[table] as Db[K][number][]).find(where);
}

export function update<K extends keyof Db>(
  table: K,
  where: (r: Db[K][number]) => boolean,
  patch: Partial<Db[K][number]>,
): number {
  const db = load();
  let n = 0;
  (db[table] as Db[K][number][]).forEach((r, i, arr) => {
    if (where(r)) {
      arr[i] = { ...r, ...patch };
      n++;
    }
  });
  save(db);
  return n;
}

/** Wipe everything (used by the demo script for a clean run). */
export function resetStore() {
  save(structuredClone(EMPTY));
}

// ---------------------------------------------------------------- files
// Stand-in for Supabase Storage.

export function putFile(id: string, bytes: Uint8Array) {
  mkdirSync(FILES_DIR, { recursive: true });
  writeFileSync(join(FILES_DIR, id), bytes);
}

export function getFile(id: string): Uint8Array | null {
  const p = join(FILES_DIR, id);
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
}
