# Member 3 - Bedaya frontend and chat connection

Member 3's Flask frontend is in **bedaya_project/**. The repository root retains Member 5's existing Next.js API service from M5_Ameen (base commit 00a3d02). It uses Member 1's data under data/m1/. The frontend remains Python + Flask + HTML + CSS + vanilla JavaScript.

## Run the connected demo

Two terminals are needed. The Node service is a teammate dependency; it does not replace the frontend.

Terminal 1, in the repository root (Node 20+ installed):

```sh
npm install
LLM_PROVIDER=mock WATCHPACK_POLLING=true npm run dev -- --webpack --hostname 127.0.0.1 --port 3000
```

Terminal 2:

```sh
cd bedaya_project
python -m pip install -r requirements.txt
BEDAYA_API_BASE_URL=http://127.0.0.1:3000 PORT=5002 python bedaya.py
```

Open http://127.0.0.1:5002. Keep both terminals open. These environment-variable commands are for macOS/Linux; on Windows PowerShell set `$env:BEDAYA_API_BASE_URL="http://127.0.0.1:3000"`, `$env:PORT="5002"`, and `$env:LLM_PROVIDER="mock"` in the appropriate terminal before running the commands without inline environment assignments.

## Member 3 work

- Eight responsive frontend screens: home, demo login, questionnaire, dashboard, documents, assistant, support, funding.
- Fixed shared layout collision causing narrow overlapping cards.
- Chat adapter for confirmed POST /api/ai/chat: history, source labels, safe source/office links, loading, retry, timeout/offline states.
- Local data-mode dialogue improvements in lib/integrations/assistant/conversation.ts: greetings, business-idea clarification, budget questions, thanks, and ambiguous cost follow-ups. These are rule-based prompts, not live AI.
- Questionnaire data and selected files are not automatically forwarded to the service.

Roadmap and support screens remain generic demonstrations. Documents remain local selection/preview. Sign-in is simulated. Chat is team-data mode by default; live model configuration belongs to Member 5 and secrets must stay server-side. Do not commit real .env files.

## Checks

```sh
cd bedaya_project
python -m unittest discover -s tests -v
```

At repository root:

```sh
npm run typecheck
npm run test:assistant
npm run test:conversation
```

Verified: 8 Flask tests; TypeScript check; 20 existing assistant tests; 10 additional conversation/API scenarios. See bedaya_project/README.md for detailed frontend guidance. Existing PDF study guide is an older snapshot and is not the current integration documentation.

---

## Member 5 service documentation

# Bedaya: M5 AI features (Ameen)

The AI features of Bedaya, a helper for people starting a business in Jordan:

| # | Feature | Status | Code |
| --- | --- | --- | --- |
| 8 | AI assistant (Arabic and English, answers only from official data) | Live | [lib/integrations/assistant/](lib/integrations/assistant/) |
| 9 | Document checker (missing, expired, blurry) | Live | [document-checker.ts](lib/integrations/document-checker.ts) |
| 5 | Incubator matching: "why this matches you", plus one-click multi-apply | Live | [incubators.ts](lib/integrations/incubators.ts) |
| 14 | One-page business plan + PDF in Arabic or English | Prototype | [business-plan.ts](lib/integrations/business-plan.ts) |

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

The steps, fees, times, offices and documents come from official Jordanian sources, accessed on 2026-10-09 ([data/m1/sources.json](data/m1/sources.json)). The main source is MIT's **eRegulations investor guide** ([jordan.eregulations.org](https://jordan.eregulations.org)), which lists every step with its office, papers, fee and time. The GAM home-business guide, the Amman Chamber of Commerce, JEDCO and news from JFDA and Jordan News fill the gaps.

| Step | Fee | Time | Source |
| --- | --- | --- | --- |
| Register as a trader (MIT) | 5 JOD certificate + 10 JOD (capital under 20,000; 20/30/40 above) | Same day, 15-75 min | eRegulations, GAM guide |
| Trade name (optional) | 20 JOD (+10 JOD name search) | Same visit | eRegulations, e-Gov portal |
| Amman Chamber of Industry (home food) | 40 JOD under 10,000 capital (annual + 50% registration + community fee) | Same day | eRegulations |
| Amman Chamber of Commerce (shops, LLCs) | 30 / 75 / 150 ... 2,250 JOD by capital | Same day | eRegulations, ammanchamber.org.jo |
| GAM rent-contract certificate (rented places) | 0.5% of annual rent (max 15 JOD) + 0.3% stamps | Online, same day | eRegulations |
| JFDA food approval (home food) | 100 permit + 10 per label + 90 lab tests = 200 JOD for one food type | 7-10 days | eRegulations |
| Home-based vocational licence (GAM) | 20-50 JOD | 3 working days | GAM guide, GAM news |
| Shop/office vocational licence (GAM) | 25-200 JOD fixed or 40-750 JOD by capital, + signboard 15 JOD/m² + 20% | Online, same day | eRegulations |
| LLC registration (CCD) | 0.2% of capital (min 250 JOD) + 0.3% stamps + ~60 JOD of document fees + bank fee | 1-2 days | eRegulations |
| Tax number (ISTD) | Free | Online, same day | eRegulations, ISTD |
| Business stamp | 10-20 JOD | Same day | eRegulations |
| Social security (SSC) | Free to register; contributions 21.75% of wages (news source, confirm with SSC) | 1-2 days | eRegulations, GAM guide |

Home-business rules (15% of the home, max 25 m²; 1 employee, max 3 people; no customers at home for food in Amman) come from the GAM guide.

**Incubators and funding** ([data/m1/incubators.json](data/m1/incubators.json)) are now real programmes:
- JEDCO's Home-Based Businesses grant (about 800 JOD).
- The Development and Employment Fund's interest-free home-project loans (1,000-3,000 JOD; ages 18-45; vocational-training graduates).
- Orange Corners Jordan, Oasis500, the Queen Rania Competition (QRCE at PSUT), iPARK and Luminus ShamalStart.

Their **application forms aren't public**, so the form fields are our best guess. Deadlines are "check the website". Oasis500's investment figure comes from a third-party profile.

Layla's profile, the OCR results and feature 10's non-official costs are demo fixtures.

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
  pdf-rtl.ts, arabic-shaping.ts   Arabic in pdf-lib: letter joining + right-to-left layout (our own code, no GPL)
  fonts/                 Amiri, SIL Open Font License
  fixtures/              Layla's demo data
app/api/ai/*             the HTTP routes (contract in docs/m5-api.md)
app/page.tsx             the test bench (M3 builds the real screens)
db/m5-tables.sql         tables requested from M4
docs/                    API contract, judge answers, assistant test results, sample PDF
```

## Hand-offs

- **M3 (frontend):** [docs/m5-api.md](docs/m5-api.md) has every request and response format, including the chat widget.
- **M5 partner:** the OCR route returns `OcrResult[]` exactly as in `types.ts` (with `fileId` and `fileName`). `pdf-rtl.ts` handles Arabic in pdf-lib, so reuse it for signed documents. Move `business-plan-pdf.ts` onto your helper when it lands. Call `generate()` from `llm.ts` for any AI need. The checker now expects the real GAM/JFDA forms (owner approval, declaration and pledge, inspection pledge); the two pledges can be signed in-app.
- **M4 (backend):** please adapt [db/m5-tables.sql](db/m5-tables.sql) (`documents`, `signatures`, `notifications`, `consent_log`) to your schema. Send your incubator ranking as `[{ incubatorId, score }]`, and confirm or replace the `UserProfile` shape.
- **M1 (data):** keep the spreadsheet columns as they are and run `npm run knowledge && npm run check:data && npm run test:assistant` after edits. Still worth confirming by phone: the home-licence fee for your exact profession (20-50 JOD), Oasis500's investment terms, and whether Luminus ShamalStart has an open cohort. Replace the 20 test questions with yours if they differ. [docs/judge-answers.md](docs/judge-answers.md) covers AI accuracy and privacy.
