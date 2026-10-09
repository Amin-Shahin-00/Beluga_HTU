# Bedaya: M5 AI features (Ameen)

The AI features of Bedaya, a helper for people starting a business in Jordan:

| # | Feature | Status | Code |
| --- | --- | --- | --- |
| 8 | AI assistant (Arabic and English, answers only from official data) | Live | [lib/integrations/assistant/](lib/integrations/assistant/) |
| 9 | Document checker (missing, expired, blurry) | Live | [document-checker.ts](lib/integrations/document-checker.ts) |
| 5 | Incubator matching: "why this matches you", plus one-click multi-apply | Live | [incubators.ts](lib/integrations/incubators.ts) |
| 14 | One-page business plan + PDF | Prototype | [business-plan.ts](lib/integrations/business-plan.ts) |

Everything runs **without an API key**. `LLM_PROVIDER=mock` (the default) answers from Bedaya's data with deterministic code. Set a key and every feature switches to the model, falling back to the mock answer on timeout or error. [llm.ts](lib/integrations/llm.ts) is the only file that calls an AI API.

## Run it

Use Node 20 or later (on this machine: `$env:PATH = "C:\Users\dell\.tools\node;$env:PATH"`).

```
npm install
npm run dev               # http://localhost:3000 opens the test bench for all four features
npm run test:assistant    # M1's 20 questions: pass/fail list in docs/assistant-test-results.md (target 18)
npm run test:features     # document checker, matching, prefill, business plan, PDF on Layla's data
npm run typecheck
npm run ask -- "Can I run a bakery from home?"   # ask the assistant from the terminal
```

To use a real model, set `LLM_PROVIDER=anthropic` and `LLM_API_KEY=...` in `.env` (model `claude-opus-5` by default; set `LLM_MODEL` to change it). Then run `npm run demo:cache` the night before the demo to save answers for the exact demo questions.

## Data

The fees, documents, offices and rules come from official Jordanian sources, accessed on 2026-10-09 ([data/m1/sources.json](data/m1/sources.json)):

| Fact | Value | Source | Confirmed |
| --- | --- | --- | --- |
| Sole proprietorship registration | 10-40 JOD by capital (10 JOD under 20,000) + 5 JOD certificate; min. declared capital 1,000 JOD | GAM home-business guide, e-Gov portal | Yes |
| Trade name | 10 JOD search + 20 JOD registration | e-Gov portal (read through search; portal blocks direct reads) | Partly |
| LLC registration (CCD) | 25 + 10 + 10 JOD + 0.3% of capital in stamps; min. capital 1 JOD; auditor required; lawyer above 20,000 JOD | GAM home-business guide | Yes |
| Home-based vocational licence (GAM) | 20-50 JOD by profession; 3 working days; 15% of home area, max 25 m²; 1 employee, max 3 people | GAM guide + GAM news | Yes |
| Home food | JFDA approval first: commercial register, lease or zoning plan, ID; inspection + lab samples | JFDA via Al-Mamlaka (May 2026) | Fee not published |
| Amman Chamber of Commerce | First registration 30 JOD (capital under 5,000), 75 (5,000-50,000), 150 (50,000-100,000)... | ammanchamber.org.jo | Yes |
| Tax number, social security | Process and obligations; fees not published | ISTD, GAM guide | Fees not published |

Processing days other than GAM's 3 days are **our estimates** and are labelled as such. Shop and office vocational licence fees aren't published. **The incubators are fictional** (M1 should swap in real ones), and Layla's profile, the OCR results and feature 10's costs are demo fixtures.

How the data flows: M1's spreadsheet (`data/m1/*.csv` + `facts.json`) goes through `npm run knowledge` into [lib/integrations/knowledge.json](lib/integrations/knowledge.json). Then `npm run check:data` validates every office, document, source and condition reference.

## Layout

```
data/m1/                 M1's inputs: rules.csv, offices.csv, documents.csv, facts.json, sources.json, incubators.json, test-questions.json
lib/integrations/        all M5 code (drop into M3's Next.js repo as-is)
  types.ts               shared contracts: OcrResult, UserProfile, ... (agree with the M5 partner before changing)
  llm.ts                 the only AI API caller: mock / demo cache / model with timeout + fallback
  knowledge.json/.ts     the rules, built from data/m1
  assistant/             feature 8
  document-checker.ts    feature 9
  incubators.ts          feature 5
  business-plan*.ts      feature 14 (+ temporary PDF until the partner's pdf-lib helper lands)
  fixtures/              Layla's demo data
app/api/ai/*             the HTTP routes (contract in docs/m5-api.md)
app/page.tsx             the test bench (M3 builds the real screens)
db/m5-tables.sql         tables requested from M4
docs/                    API contract, judge answers, assistant test results, sample PDF
```

## Hand-offs

- **M3 (frontend):** [docs/m5-api.md](docs/m5-api.md) has every request and response format, including the chat widget.
- **M5 partner:** the OCR route returns `OcrResult[]` exactly as in `types.ts` (with `fileId` and `fileName`). Replace the body of `business-plan-pdf.ts` with your pdf-lib helper. Call `generate()` from `llm.ts` for any AI need.
- **M4 (backend):** please adapt [db/m5-tables.sql](db/m5-tables.sql) (`documents`, `signatures`, `notifications`, `consent_log`) to your schema. Send your incubator ranking as `[{ incubatorId, score }]`, and confirm or replace the `UserProfile` shape.
- **M1 (data):** keep the spreadsheet columns as they are and run `npm run knowledge && npm run check:data && npm run test:assistant` after edits. Please call the offices marked "not published" or "estimate" and replace the 20 test questions with yours if they differ. [docs/judge-answers.md](docs/judge-answers.md) covers AI accuracy and privacy.
