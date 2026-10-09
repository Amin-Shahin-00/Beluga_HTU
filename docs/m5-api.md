# M5 AI API: request and response formats

All routes are `POST`, take and return JSON (UTF-8), and live under `/api/ai/`. Types are in [lib/integrations/types.ts](../lib/integrations/types.ts) and in the feature files linked below. A `400` returns `{ "error": "..." }`.

Every AI response has a `source` field that says where the text came from:

| `source` | Meaning |
| --- | --- |
| `mock` | Deterministic answer from Bedaya's data (default; no API key needed) |
| `llm` | Written by the model |
| `cache` | Saved model answer for an exact demo question |
| `fallback` | The model was slow, failing or refused, so the data-only answer was used |

## 1. Chat widget: `POST /api/ai/chat` (feature 8)

Request:

```json
{
  "message": "Can I run a bakery from home?",
  "history": [
    { "role": "user", "content": "Tell me about the home business license" },
    { "role": "assistant", "content": "..." }
  ],
  "lang": "en",
  "profile": { "...": "UserProfile, optional" }
}
```

- `message` (required, up to 1000 characters).
- `history` (optional): earlier turns, oldest first. The last 10 are used. Send it so follow-ups like "and how much is it?" work.
- `lang` (optional, `"ar"` or `"en"`): forces the answer language. By default the answer follows the language of `message`.
- `profile` (optional): when the wizard is done, send it so questions without a business type use the user's.

Response:

```json
{
  "answer": "Yes. Food activities allowed from home include ...",
  "lang": "en",
  "kind": "answer",
  "offices": [{ "id": "JFDA", "name": "Jordan Food and Drug Administration", "website": "https://www.jfda.jo", "phone": "Hotline 117114, WhatsApp 0795632000" }],
  "sources": [{ "id": "S1", "title": "Your guide to starting a business from home ...", "url": "https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf" }],
  "source": "mock",
  "latencyMs": 2,
  "disclaimer": "Built from official Jordanian sources accessed on 2026-10-09. Fees can change; confirm with the office before paying."
}
```

- `kind`: `answer`, or `unknown_redirect` (not in our data, so the answer points to an office, listed in `offices`), or `out_of_scope` (not about starting a business).
- UI suggestions: render `answer` with `white-space: pre-wrap` and `dir="rtl"` when `lang` is `ar`. Show `sources` as small links under the bubble, and `offices` as buttons for the website or phone. Show `disclaimer` once in the widget footer.

## 2. Document checker: `POST /api/ai/documents/check` (feature 9)

Request: `{ "profile": UserProfile, "files": OcrResult[], "today"?: "yyyy-mm-dd" }`. `files` comes straight from the partner's OCR route.

Response ([document-checker.ts](../lib/integrations/document-checker.ts)):

```json
{
  "files": [
    {
      "fileId": "10000000-...-0003",
      "fileName": "lease-contract.pdf",
      "docType": "lease_contract",
      "docName": { "en": "Lease contract, owner's written consent, or title deed", "ar": "..." },
      "status": "error",
      "warnings": [
        {
          "id": "10000000-...-0003:expired",
          "code": "expired",
          "severity": "error",
          "docId": "lease_contract",
          "fileId": "10000000-...-0003",
          "message": { "en": "Your lease contract ... expired on 2026-08-31. ...", "ar": "..." },
          "details": { "expiryDate": "2026-08-31", "today": "2026-10-09" }
        }
      ]
    }
  ],
  "missing": [
    {
      "id": "missing:jfda_approval", "code": "missing", "severity": "info", "docId": "jfda_approval",
      "docName": { "en": "JFDA approval for home food production", "ar": "..." },
      "message": { "en": "You'll get the JFDA approval ... Nothing to upload yet.", "ar": "..." },
      "neededFor": [{ "stepId": "home_business_license", "title": { "en": "...", "ar": "..." } }],
      "obtainedAt": { "stepId": "jfda_home_food_license", "title": { "...": "" }, "office": { "...": "" } }
    }
  ],
  "summary": { "files": 3, "ok": 1, "expired": 1, "blurry": 1, "missing": 2, "comingLater": 1 },
  "source": "mock"
}
```

- Show `files[].warnings` next to each uploaded file, and `missing` as a checklist.
- `status`: `ok` (green), `warning` (amber, e.g. blurry: re-upload), `error` (red, e.g. expired: blocks a step).
- `missing[].severity`: `error` means the user must bring it; `info` (with `obtainedAt`) means they'll get it at a later step.
- Blurry means OCR `confidence < 0.6` or `imageQuality < 0.5` (`BLUR_THRESHOLDS` in types.ts).

## 3. Incubator matches: `POST /api/ai/incubators/match` (feature 5)

Request: `{ "profile": UserProfile, "ranked"?: [{ "incubatorId": "inc_women_makers", "score": 0.92 }] }`. `ranked` is M4's ranking, in order. Without it, a stand-in ranker is used.

Response: `{ "matches": IncubatorMatch[], "source": "mock" }`, where:

```json
{ "incubatorId": "inc_women_makers", "name": { "en": "Women Makers Jordan", "ar": "صانعات الأردن" }, "score": 11,
  "reason": { "en": "Women Makers Jordan fits you because ...", "ar": "صانعات الأردن: يناسبك هذا البرنامج لأنه ..." },
  "maxFundingJod": 5000, "applicationDeadline": "2026-10-30" }
```

Unknown incubator ids in `ranked` are dropped.

## 4. One-click multi-apply: `POST /api/ai/incubators/prefill` (feature 5)

Request: `{ "profile": UserProfile, "incubatorIds": ["inc_women_makers", "inc_zarqa_green"] }`

Response: `{ "applications": PrefilledApplication[] }`. Each application has its incubator's form fields with values filled in:

```json
{ "incubatorId": "inc_women_makers", "name": { "...": "" }, "readyToSubmit": true, "missingRequired": [],
  "fields": [
    { "key": "applicant_full_name_ar", "label": { "ar": "الاسم الرباعي", "en": "Full name (Arabic)" }, "type": "text", "required": true,
      "value": "ليلى أحمد محمود الخطيب", "origin": "profile", "from": "personal.fullNameAr" }
  ] }
```

`origin` is `profile` (copied), `derived` (computed or shortened, e.g. a pitch cut to the field's max length), or `empty` (the user fills it in). Show the form for review before submitting.

## 5. Business plan: `POST /api/ai/business-plan` (feature 14)

Request: `{ "profile": UserProfile, "costs": CostData }`, where `costs` is feature 10's output (see [feature10-costs.layla.json](../lib/integrations/fixtures/feature10-costs.layla.json)).

Response: `BusinessPlan` ([business-plan.ts](../lib/integrations/business-plan.ts)) has `title`, `business`, `market` (all bilingual), `costs` (lines and totals), `funding` (own capital, needed to launch, gap, break-even months, bilingual summary), `timeline` (roadmap steps with dates; `durationKnown: false` means the duration is an estimate), and `source`.

## 6. Business plan PDF: `POST /api/ai/business-plan/pdf`

Request: `{ "plan": BusinessPlan }` (preferred, the plan the user is looking at) or `{ "profile", "costs" }`. Returns `application/pdf` as an attachment. The PDF is English-only for now (pdf-lib can't shape Arabic); it switches to the partner's shared pdf-lib helper when that lands.
