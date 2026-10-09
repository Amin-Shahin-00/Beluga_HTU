# M5 identity, documents and signing: API for M3 (frontend)

The other half of M5. Ameen's AI routes are in [m5-api.md](m5-api.md). Shared types are in [lib/integrations/types.ts](../lib/integrations/types.ts).

All routes are JSON unless noted. Every route except login and e-invoicing needs the user to be signed in, through a cookie set by the SANAD callback. Without it you get `401 { "error": "Not signed in..." }`. M4 replaces the cookie with Supabase auth in [lib/session.ts](../lib/session.ts).

## Login with SANAD (feature 7)

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/sanad/login?return=/roadmap` | Point the "Login with SANAD" button here. It goes to the mock SANAD page, then back to `return`, signed in. |
| GET | `/api/sanad/me` | The signed-in user. Each field is `{ value, source }`, where `source` is `verified_by_sanad`, `typed_by_user` or `read_by_ocr`. Show a "verified" badge for `verified_by_sanad`. |
| POST | `/api/sanad/me` `{ "action": "logout" }` | Signs out. |
| GET | `/api/consent` | The user's consent and data-access log, for a privacy screen. |
| POST | `/api/consent` `{ "action": "revoke" }` | Withdraws consent for all SANAD data and signs out. The next login asks for consent again. |

The mock SANAD page is `/mock-sanad/login`. It always shows a red "MOCK SANAD" banner.

## Business info

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/profile` | Business info, each field `{ value, source }`. A stand-in for M4's wizard answers. |
| POST | `/api/profile` `{ businessNameAr?, businessNameEn?, activityAr?, activityEn?, address?, capitalJod?, partners? }` | Saves the user's corrections, which get the source `typed_by_user`. Legal form and home-based can't be changed here. Generate again afterwards to update unsigned forms. |
| GET | `/api/profile/user-profile` | The same user as the shared `UserProfile`, ready to send to Ameen's `/api/ai/*` routes (assistant, incubators, business plan). |

## Document vault and OCR (feature 3)

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/documents/upload` | `multipart/form-data` with `file` (PNG, JPEG, WEBP or PDF, max 10 MB) and an optional `docType` (any `DocType`, e.g. `national_id`, `lease_contract`, `property_ownership_document`, `property_owner_approval`). Returns `201 { document }`, where `document.ocr` is the shared `OcrResult` and `document.ocr.fileId` is `document.id`. |
| GET | `/api/documents` | All the user's documents: uploads and generated forms. Each has `fileUrl` and `status`. Forms also have `officeName { ar, en }`, `signature` once signed, and `review` once an office decided. |
| GET | `/api/documents/:id/file` | The file itself (a PDF opens in the browser). Add `?download=1` to download. After signing it returns the signed PDF. |
| GET | `/api/documents/ocr` | `{ files: OcrResult[] }`: every upload's OCR result, plus the pledge forms signed in Bedaya. Send `files` to `POST /api/ai/documents/check`. |
| GET | `/api/documents/check` | Ameen's document checker run on this user's own files and profile. The response is the same as `POST /api/ai/documents/check`: missing, expired and blurry documents. |

Blurry means `confidence < 0.6` or `imageQuality < 0.5` (`BLUR_THRESHOLDS`). The mock OCR picks its result from the file name: `blurry` gives a blurry result, `expired` gives a past expiry date, and a file under 8 KB gives a readable but "fair" image.

## Auto-fill forms (feature 3)

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/documents/generate` | Fills every form this user's case needs. Returns `{ generated, keptSigned }`. Each form has `fieldSources` (where each value came from), `missingFields` (show these in red) and `office`. |

| Form | Who needs it | Office |
| --- | --- | --- |
| `trade_registration` | Sole proprietorship (including home-based) | `MIT` |
| `company_registration` | LLC | `CCD` |
| `vocational_license` | Everyone | `GAM` in Amman, `IRBID` in Irbid |
| `declaration_pledge` | Home-based | Municipality (`GAM` / `IRBID`) |
| `inspection_pledge` | Home-based food (ISIC 10xx/11xx) | `JFDA` |
| `tax_registration` | Everyone | `ISTD` |

Office keys are M1's office ids. `IRBID` is ours until M1 adds municipalities outside Amman. Once signed, `declaration_pledge` and `inspection_pledge` count as provided for the document checker; they are M1's document ids of the same name.

Layla (home bakery in Irbid) gets 5 forms, and Omar (LLC in Amman) gets 3. Every PDF says "DEMO FORM - NOT OFFICIAL" until M1 sends the official forms.

## Sign all, submit, office review (feature 4)

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/documents/sign-all` `{}` | Signs every `ready_to_sign` form in one SANAD session (mock). Send `{ "documentIds": [...] }` to sign only some. Returns `{ signed: [{ documentId, title, signatureRef, hash, signedAt }] }`. |
| POST | `/api/documents/submit` | Sends every `signed` form to its office. Status becomes `submitted`. |

Form status: `ready_to_sign` → `signed` → `submitted` → `approved` or `returned`. A returned form has `review.note`. After the user fixes their info, Generate regenerates only the returned forms. Then Sign all and Submit again.

## Notifications (feature 11)

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/notifications` | `{ notifications, unread }` for the bell. Each has `titleAr`, `titleEn`, `bodyAr`, `bodyEn`, `link` and `read`. |
| POST | `/api/notifications` `{ "id"?: "..." }` | Marks one notification as read, or all of them when `id` is left out. |
| POST | `/api/notifications/send` `{ "event", "vars" }` | Fires a notification. Used by M4's roadmap and booking code. |
| GET | `/api/notifications/send` | The demo outbox: emails "logged" and WhatsApp messages "would send". Nothing is actually sent. |

| Event | vars |
| --- | --- |
| `step_changed` | `stepAr`, `stepEn`, `statusAr`, `statusEn` |
| `document_needed` | `docAr`, `docEn`, `stepAr`, `stepEn` |
| `visit_soon` | `placeAr`, `placeEn`, `date`, `time` |
| `forms_ready`, `documents_signed`, `forms_submitted` | `count` (sent automatically) |
| `form_approved`, `form_returned` | `officeAr`, `officeEn`, `formAr`, `formEn`, `note` (sent automatically by the office review) |

## E-invoicing (feature 21, screens only)

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/einvoicing` | Title, intro, 5 steps and 6 form fields (Arabic and English) for the setup page. No sign-in needed. The text is a placeholder until M1's JoFotara note. |

## Staff dashboards (MOCK sign-in)

Staff sign in by picking a role on the dashboard, which sets the cookie `bedaya_staff`. In real life each party signs in through its own system.
The roles are `gov:MIT`, `gov:CCD`, `gov:GAM`, `gov:IRBID`, `gov:ISTD`, `gov:JFDA`, `sanad` and `admin`. A wrong role gets `403`, and no role gets `401`.

| Method | Route | Role | What it does |
| --- | --- | --- | --- |
| GET / POST / DELETE | `/api/staff/session` | any | Who is signed in / sign in with `{ role }` / sign out. |
| GET | `/api/staff/gov/documents` | `gov:*` | The forms sent to this office only, with the applicant's name and a signature check. `signature.valid` means the PDF hasn't changed since signing. |
| GET | `/api/staff/gov/documents/:id/file` | `gov:*` | The signed PDF. Each open shows in the applicant's access log as `gov_review:<office>`. |
| POST | `/api/staff/gov/documents/:id/review` `{ decision: "approved" \| "returned", note? }` | `gov:*` | Approves the form, or returns it with a note (the note is required to return). The applicant is notified. |
| GET | `/api/staff/sanad` | `sanad` | MoDEE's side: login codes, consents, Bedaya's data use, signatures issued. |
| GET | `/api/staff/admin` | `admin` | Applicants' progress and warnings, totals and the message outbox. No files. |
| POST | `/api/staff/admin` `{ "action": "reset" }` | `admin` | Wipes all demo data. |

## Screens (prototypes; M3 builds the real ones)

- `/dashboard` explains who controls what and links to the four party dashboards: `/dashboard/client`, `/dashboard/government`, `/dashboard/sanad` and `/dashboard/admin`.
- `/m5-demo` is a one-page test console for every route above.
- `/mock-sanad/login` is the mock SANAD login and consent screen.

These pages are Arabic-first (right to left). Their styles are in [app/m5.css](../app/m5.css), scoped under `.m5`, so they don't affect other pages.
