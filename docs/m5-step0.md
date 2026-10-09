# M5 Step 0: shared setup (Ameen + M5 partner)

Everything here is **dummy data** so both of us can build without API keys or waiting on other teams. Replace each file when the real one arrives; the shapes in `lib/integrations/types.ts` stay the same.

## 1. Tools

| Need | Decision for the hackathon | Switch later by |
| --- | --- | --- |
| OCR | `OCR_PROVIDER=mock`: the OCR route returns fixtures from `lib/integrations/fixtures/ocr-results.layla.json` | Setting `OCR_PROVIDER=tesseract` (pack `ara+eng`) or `cloud` |
| LLM | `LLM_PROVIDER=mock`: `lib/integrations/llm.ts` answers from the rules data and cached demo answers | Setting `LLM_PROVIDER` and `LLM_API_KEY` in `.env` |

The Tesseract vs cloud OCR test on a real Jordanian ID photo has **not** been run (no photo, no key). Expectation to verify if we get time: Tesseract's Arabic pack struggles with names on ID cards, and a cloud OCR reads them better.

`.env.example` has the variables. Copy it to `.env`; only one shared key, and `llm.ts` is the only file that reads it.

## 2. Folder and branches

- Code lives in `lib/integrations/` (to be merged into M3's Next.js repo).
- Branches: `m5-you` (partner) and `m5-ameen` (Ameen), both cut from `main`.

## 3. Locked data shapes (`lib/integrations/types.ts`)

- **`OcrResult`** = `{ fileId, fileName, docType, fields: { name, nationalId, expiryDate, ... }, confidence, imageQuality }`
  - Added `fileId` and `fileName` to the original shape so warnings can be shown next to each file.
  - `confidence` and `imageQuality` are 0..1. Blurry means `confidence < 0.6` or `imageQuality < 0.5`.
  - Dates are ISO `yyyy-mm-dd`.
- **`UserProfile`** = the wizard answers (`personal` + `business`). This is our guess at M4's format; Layla's sample is in `fixtures/user-profile.layla.json`.

## 4. Tables for M4 (`db/m5-tables.sql`)

`documents`, `signatures`, `notifications`, `consent_log`, plus seed rows for Layla. Message for M4:

> Hi M4, M5 needs these four tables. A Postgres draft is in `db/m5-tables.sql`. Please adapt it to your schema (the users table name and foreign keys) and tell us if any column names change.

## 5. Data from M1 (`data/m1/`)

| File | What it is |
| --- | --- |
| `rules.csv` | Steps per legal form (home business, sole proprietorship, LLC): office, required documents, fee (JOD), days |
| `offices.csv` | Office names (AR/EN), hours, website |
| `documents.csv` | Document types, issuer, whether they expire |
| `incubators.json` | 6 fictional incubators, each with its own application form fields |
| `test-questions.json` | 20 assistant test questions (AR + EN), with what a passing answer must mention |

**Fees, days and hours are placeholders.** Government websites are real, but nothing else has been checked. Message for M1:

> Hi M1, we built dummy versions of the rules spreadsheet, incubator list and 20 test questions in `data/m1/` so we could start. Please send the real ones in the same columns, or correct these files directly.

## Check

```
node scripts/check-step0.mjs
```

This confirms that every office and document ID referenced in the data exists, there are 20 questions, and the totals the tests expect (90 JOD, 14 days) match the rules.
