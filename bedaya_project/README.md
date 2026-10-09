# Bedaya | بداية

A frontend-only hackathon demo for exploring a business journey in Jordan. Uses the existing `bedaya.py` entry point, Flask, Jinja, CSS, and vanilla JavaScript. No database or live AI.

## Run in PyCharm

Open this existing project folder. Choose a Python interpreter in PyCharm settings, then run these commands in the project terminal:

```sh
python -m pip install -r requirements.txt
python bedaya.py
```

Open http://127.0.0.1:5000. Stop with Ctrl+C. The development server binds only to your computer and debug is disabled. If port 5000 is occupied, use `PORT=5001 python bedaya.py` on macOS/Linux and open http://127.0.0.1:5001.

## Demo walkthrough and routes

1. `/` → Get started → `/login`: simulated sign-in; no real credentials.
2. Continue as demo guest → `/questionnaire`: three steps with required-field and budget validation.
3. Submit → `/dashboard`: local business summary and interactive sample roadmap.
4. `/documents`: select a sample PDF/image (up to 5 MB); images preview locally. Remove resets the picker. No upload or verification.
5. `/assistant`: connects through Flask to Member 5’s confirmed `/api/ai/chat` endpoint. Sends question and last 10 messages only. Displays answer provenance, source links, loading, retry and offline states. Requires Member 5’s service to run.
6. `/incubators`: invented examples with search, city/focus filters, empty state, and local shortlist.
7. `/funding`: preparation checklist and a draft preview. Nothing is submitted.

The Arabic toggle translates navigation and key headings and sets RTL. Supporting copy/forms remain English: this is partial localization, not a complete Arabic translation.

## How the files work

- `bedaya.py`: Flask receives a URL and renders a template. It performs no business decisions.
- `templates/base.html`: common navigation, footer, stylesheet, and script. Each page extends this layout and supplies its content block.
- `templates/index.html`, `login.html`, `questionnaire.html`, `dashboard.html`: core journey.
- Other templates: document, chat, support, funding, and 404 screens.
- `static/style.css`: modern green design, focus styles, responsive layouts.
- `static/app.js`: small browser interactions. Uses textContent for user-provided text to prevent HTML injection.
- `services/mock_data.py`: separate sample roadmap, illustrative costs, invented support entries.
- `services/api_client.py`: proposed contracts and an explicit unavailable-service fallback. It makes no network calls.
- `tests/test_routes.py`: lightweight route and demo-boundary checks.

## Mock versus real

Every roadmap and cost is illustrative, not researched legal advice. SANAD is not integrated. Chat now uses Member 5’s service when configured. Their default is a deterministic data engine (`source=mock`), not live AI. Live AI requires their own server configuration; the UI labels live, cached, data, and fallback answers. Support names are invented. No real bank, upload, signing, OCR, authentication, or eligibility engine exists. Questionnaire, checklist, language, and shortlist state use this browser tab's sessionStorage; chat and selected file content remain in page memory. Use fictional details only. If storage is disabled, page interactions work, but details may not follow navigation. Close the tab to end the demo session. Reset on the dashboard clears roadmap/funding progress; edit business details to change the sample summary.

## Integration handoff

Roadmap/document/incubator placeholders below remain **proposed and unconfirmed**. The chat endpoint has been confirmed from M5_Ameen commit 00a3d02: POST /api/ai/chat. `BEDAYA_API_BASE_URL` now enables the chat adapter only. Requests occur when the user presses Send or a suggestion; no selected files or questionnaire details are sent. Other feature helpers remain placeholders.

Member 4 must confirm:
- `POST /api/roadmap`: request fields currently `idea`, `type`, `city`, `budget`, `model`, `partners`, `description`; clarify budget number/currency and accepted enum values. Supply response schemas with stable task IDs, titles, descriptions, verified cost provenance, statuses, and business summary.
- `GET /api/incubators`: confirm search/city/type filter names, pagination, verified organization fields, real links, and matching explanation.
- API base URL/version, authentication method (including any actual SANAD authorization), session lifecycle, CORS if needed, validation, privacy/storage behavior, error schemas, timeouts, and an example success/error payload for each endpoint.

Member 5 must confirm:
- Chat contract confirmed: `POST /api/ai/chat` accepts `message`, `history`, optional `lang`/`profile`, and returns `answer`, `lang`, `sources`, `offices`, `source`, `disclaimer`. This UI sends no profile because our questionnaire does not collect their legal-form/identity profile fields. Member 5 still needs to provide a running service URL and any authentication requirements.
- `POST /api/documents/analyze`: accepted MIME types/limits, multipart field names, consent flow, retention/deletion rules, status/job polling, analysis schema, confidence/limitations, and failure states.

Member 1 must supply verified Jordanian requirements, fee sources and dates. Member 2 can supply approved design assets. Until then, retain demo labels. Connect reviewed API calls through the integration helper; obtain explicit file-send consent in the UI, handle timeouts, and fall back visibly to demo mode. Never silently send selected documents.

## Verify

```sh
python -m unittest discover -s tests -v
```

Manual browser checklist:
- Follow home → login → questionnaire → dashboard. Try blank required fields and negative budget; Back should preserve typed values.
- Toggle roadmap items and navigate away/back; check progress/next action. Reset progress.
- Check all navigation links, keyboard focus, labels, and layouts at 390px, 768px, and desktop widths.
- Switch Arabic/English and check RTL and persistence.
- Select/remove an image and PDF. Try unsupported, empty, or >5 MB files; ensure feedback is honest.
- Try chat questions and follow-ups with Member 5’s service running; check provenance/source links. Stop the service and verify the visible offline state and retry. Clear conversation; verify blank input is blocked.
- Filter support entries to zero results; shortlist and revisit.
- Toggle funding items and open/close the preview. Verify no submission claim.

Priority 3 extras (appointments, notifications, business-plan/admin screens) are intentionally omitted to keep the core demo focused. This is a development demo, not a production deployment.


## Chat connection: two separate services

Your website stays Python/Flask. Member 5’s existing repository uses Next.js for its API service; it is not replacing your frontend. GitHub stores their code but does not automatically run the API.

Ask Member 5 to start the `M5_Ameen` branch and send the service origin. On their checkout, their documented commands are `npm install` then `npm run dev` (Node 20+). Those commands must be run in THEIR service folder, not your Flask folder. This checkout’s Node dependencies/model settings have not been runtime-verified here.

If their service runs on the same laptop at port 3000, run your frontend in PyCharm Terminal:

```sh
BEDAYA_API_BASE_URL=http://127.0.0.1:3000 PORT=5001 python bedaya.py
```

Open http://127.0.0.1:5001/assistant. Keep both services running. If Member 5 hosts it, substitute their supplied origin. `127.0.0.1` always means the current laptop; it cannot refer to your teammate’s laptop. The Python app reads environment variables directly; it does not automatically load `.env` files. `.env.example` is documentation only. Restart Flask when configuration changes.

Member 5’s service uses `LLM_PROVIDER=mock` by default, so data-only answers are correctly labeled “Team data answer · no live AI”. Live model configuration and secrets stay entirely in THEIR service. Their default model/provider settings must be confirmed by them before a live-AI demo.

No generic local response is fabricated when the service fails. The adapter validates input and response format, limits response size, and handles timeout/offline errors. Conversation history stays in page memory and is sent only with a new question. Only HTTP(S) source/office links are rendered. Local route `/api/chat` adapts to teammate route `/api/ai/chat`; it is not an AI engine.

Member 1’s source data is present inside the teammate service (`data/m1/`) and is used by their assistant. Our roadmap and support pages remain generic mock screens; they are not yet wired to verified legal steps or matching APIs. Documents remain a local picker until an OCR/checking consent flow is agreed.
