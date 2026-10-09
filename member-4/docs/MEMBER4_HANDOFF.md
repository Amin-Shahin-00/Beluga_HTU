# Member 4 — Bedaya backend handoff

## Source and scope

The 11-page hackathon plan assigns M4 features **1, 2, 3, 5, 6, 10, 12, 13, 15, 16, 17, 18, 22**, and database/rules/APIs/deployment. M4 also provides storage and contracts for M5 identity, OCR, signing, notifications and business plans.

M1 data and M5 modules were imported from **Amin-Shahin-00/Beluga_HTU**, branch **M5_Ameen**, pinned at **00a3d0207222073c7812e2360afbd96f0337c1b7**. Local copies: `data/m1/`, `lib/integrations/`, `docs/M5_UPSTREAM_API.md`. Local change to M5: `llm.ts` requires `BEDAYA_ALLOW_EXTERNAL_AI=true` before any external call; default tests remain offline. The data has source IDs and accessed dates; M4 has not independently re-verified every source. Amman-specific municipality/chamber information must be confirmed for other cities. Programme forms are inferred, not official application templates.

## Implemented features and practical limits

| Feature | Backend result | Demo limit |
| --- | --- | --- |
| 1 onboarding | Typed M5-compatible profile, draft save/resume, atomic submission | Input fields remain user-entered, not SANAD-verified |
| 2 roadmap | Sourced steps persisted per business, progress, next action, prerequisite locks enforced by RPC | Dependencies follow spreadsheet order; government visits are not automatically booked |
| 3 document vault/autofill | Private 10 MB PDF/JPEG/PNG storage, upload finalization, short-lived downloads, Arabic review PDF | Review PDF is a generic demo form; real government templates and actual OCR belong to integrations |
| 5 incubators | M4 ranking in M5 contract, bilingual reasons and form prefill; consented multi-application records | Stored in internal Bedaya inbox only; no external portal/email submission |
| 6 bank-ready file | ZIP containing profile, plan PDF, costs, uploaded files and readiness manifest; internal bank application | Fictional bank fixture because upstream has no bank list; no official signature verification or external bank transmission |
| 10 estimator | Fee ranges, unknown-fee list, known duration total, sources/scope warning | Lower bound is not an exact quote; monthly operating costs are not supplied |
| 12 appointments | Future demo slots, atomic booking, uniqueness against double-booking, cancellation | Fictional schedules, not real institution calendars |
| 13 home track | Home-business rules and conditions from M1/M5, conditional roadmap | Scope caution for Greater Amman data |
| 15 partner dashboard | Scoped internal inbox, review/approve/reject/request documents | Partner membership must be assigned explicitly |
| 16 admin | Protected catalog/rules/fees/partners editor and app-role management | No default admin; first admin requires project-owner SQL bootstrap. Not a Supabase-account administration API |
| 17 compliance | Month-end-safe demo calendar | Fictional review intervals; M1 must provide real sourced deadlines |
| 18 location | Static fictional zoning response, explicit unknown outside sample | Screens-only, no authoritative zoning lookup |
| 22 analytics | Fictional aggregate fixture, no personal records exposed | Screens-only, no production analytics pipeline |

`/backend` is a developer/demo bench, not M3's production wizard/design. It connects to real authenticated APIs, so M3 can reuse the contracts below. Root `/` retains login and simple business creation.

## Schema and security

Apply in order:

1. `supabase/migrations/202610090001_business_ownership.sql` (base ownership; preserves legacy rows).
2. `supabase/migrations/202610090002_member4_platform.sql` (platform tables, owner RLS, scoped partner/admin helpers, private storage, guarded RPCs).
3. `supabase/seeds/team.sql` (sourced catalog plus separately flagged fixtures). Regenerate with `npm.cmd run seed:team` for fresh future demo slots.

The current development Supabase project already has these protections and team data applied. The first migration's base protections were applied with a validated owner FK and NOT NULL owner on the empty table. Reapplying the source files is idempotent under the documented deployment order; they do not delete business data.

Tables: `businesses`, `bedaya_profiles`, `bedaya_tasks`, `bedaya_documents`, `bedaya_applications`, `bedaya_bookings`, `bedaya_catalog`, `bedaya_members`, `bedaya_audit`, `bedaya_signatures`, `bedaya_notifications`, `bedaya_consents`.

Every private resource is scoped to auth.uid(). Composite business/user FKs prevent attaching a row to someone else's business. Profile drafts cannot overwrite submitted profiles. Task and booking tables have no direct authenticated write grants; controlled RPCs validate ownership and prerequisites. No service-role key is used. Definer functions use an empty search_path and explicit role checks. The private `bedaya-vault` bucket permits owner access and read-only partner access only to documents explicitly included in that partner's consented application snapshot. Membership cannot be self-assigned. Normal owners cannot review submissions or edit catalogs. Signed-file records are explicitly mock, not legally validated SANAD signatures.

Role bootstrap: the Supabase project owner must explicitly choose the first admin account. Do not automatically promote all users or infer admin from email/client metadata. Afterwards admins can assign existing auth users to app roles through `POST /api/platform/admin/users`. Any real partner account should be scoped to its catalog key. No account-invitation email is sent by these APIs.

## M3/M5 API contract

All routes below use the existing same-origin HttpOnly cookie session. GET responses are private/no-store. JSON mutations require `Content-Type: application/json`, reject foreign Origin, and limit the request to 64 KB. Errors use `{error}` and meaningful 400/401/403/404/409/413/415/500/503 statuses. For the original login and business API, see BACKEND_GUIDE.md.

Let **B** mean `/api/platform/businesses/{businessId}`.

| Method/path | Body or output |
| --- | --- |
| GET /api/platform/me | Auth user plus own membership |
| GET /api/platform/catalog | Sourced records and explicitly marked demo fixtures |
| GET B/onboarding | Draft/submitted profile, field origin and SANAD=false |
| POST B/onboarding/draft | Partial `{language?,personal?,business?}` |
| POST B/onboarding/submit | Full M5 `UserProfile` **without userId**; backend derives userId |
| GET B/roadmap | `{data:{steps,progress,nextAction},orderBasis}` |
| PATCH /api/platform/tasks/{taskId} | `{status:"pending"|"in_progress"|"done"}`; locked steps return 409 |
| GET B/estimate | M5 `CostData` plus `{range:{minJod,maxJod,unknownSteps},steps,estimatedDays,scopeWarning,provenance}` |
| GET B/home-track | Home facts, source list and location scope |
| GET B/incubators | M5 `matches` plus `ranked:[{incubatorId,score,needsConfirmation,...}]`; scores 0–1 |
| POST B/incubators/prefill | `{incubatorIds:[...]}` → non-official prefilled forms |
| GET B/applications | Owner application snapshots/status |
| POST B/applications | `{partnerKeys:[...],consent:true}` → internal inbox submissions, not sent externally |
| GET B/documents | Owner metadata, OCR result and warnings |
| POST B/documents/upload | `{filename,mimeType,sizeBytes,kind,expiresOn?}` → metadata plus signed upload URL/token |
| POST /api/platform/documents/{id}/finalize | `{}` after upload; checks file bytes, MIME signature and actual size |
| GET /api/platform/documents/{id}/download | Ready document only; signed URL valid 60 seconds |
| POST B/documents/autofill | `{}` → stored Arabic demo profile review PDF |
| POST /api/platform/documents/{id}/ocr | `{consent:true,result:OcrResult}` from M5; stores/checks results, does not execute OCR |
| GET B/plan | Generated M5-compatible prototype plan and conservative costs |
| GET B/plan/pdf?lang=ar or en | PDF attachment |
| GET B/bank-package | ZIP attachment, maximum 25 MB of actual documents |
| GET /api/platform/slots | Globally available fictional slots (booked slots hidden) |
| POST B/bookings | `{slotKey}` → booking ID; concurrent duplicate returns 409 |
| GET B/bookings | Owner bookings |
| POST /api/platform/bookings/{id}/cancel | `{}` → owner cancellation |
| GET B/compliance?start=YYYY-MM-DD | Demo calendar anchored to provided date or business creation date |
| POST /api/platform/location | `{area,activity}` → demo allowed=true/false/null |
| GET /api/platform/analytics | Static fictional anonymous aggregates |
| GET /api/platform/partner/inbox | Partner/admin internal inbox only |
| PATCH /api/platform/partner/applications/{id} | `{status,note?,requestedItems?}`; only the relevant partner/admin can review |
| GET /api/platform/admin/catalog | Admin catalog |
| POST /api/platform/admin/catalog | `{key,kind,payload,isDemo}`; role-checked, sourced-rule schema validated |
| GET /api/platform/admin/users | Existing application-role memberships |
| POST /api/platform/admin/users | `{userId,role:"admin"|"partner",partnerKey:null|string}` |
| POST /api/platform/identity/mock | `{consent:true}` → existing-session mock adapter; no SANAD authentication |
| POST /api/platform/signatures | `{documentId,signedDocumentId,signerName,consent:true}` → mock signing record for two owner files |
| POST /api/platform/consents | `{purpose,granted}` → own consent log |
| GET /api/platform/notifications | Own in-app notifications |
| PATCH /api/platform/notifications/{id} | `{}` → mark read |

### Profile and document identity

M5 `UserProfile` is kept intact when returned; requests omit `userId`. `personal.nationalId` may be blank in the demo and is not used to authenticate. Internal keys remain Supabase auth UUIDs. No government identifier is placed in URLs, storage paths, logs or membership checks. Fields are entered by the user; source metadata labels this. Storage path is `{authUUID}/{businessId}/{documentUUID}.{ext}`.

M5 draft-table mapping:

| M5 draft | M4 table/contract |
| --- | --- |
| documents | bedaya_documents (`filename`, `kind`, `ocr_result`, `warnings`); OCR result retains M5 fileId/fileName |
| signatures | bedaya_signatures; references original and uploaded signed owner document; provider=mock |
| notifications | bedaya_notifications; in_app only; completion trigger creates messages |
| consent_log | bedaya_consents plus action-specific bedaya_audit; no IP/user-agent fingerprinting |

### Live versus prototype data

The source repository has no bank list, actual appointment slots, legal post-opening deadlines, official zoning fixtures, real form templates, or approved external submission endpoints. Those gaps stay labeled as prototype/screens-only or incomplete external integration. No email, WhatsApp, bank message or incubator message is sent. Production AI is disabled unless an operator deliberately enables it and adds a separate provider-consent flow.

## Verification

Commands:

```powershell
npm.cmd run check:data
npm.cmd run test:platform
npm.cmd run test:features
npm.cmd run test:assistant
npm.cmd run lint
npm.cmd run build
npm.cmd run start -- --port 3011 --hostname 127.0.0.1
npm.cmd run test:http
```

Run `supabase/tests/member4.sql` in SQL Editor for transactional DB assertions. It creates demo rows, tests protected RPCs/roles and then rolls back. Cross-user identity is simulated through claims inside SQL; it is not a second real account login. A repeatable real-two-account test remains available in `scripts/check-isolation.mjs` with local ignored .env.test credentials.

Status observed during implementation: data references passed; M4 rule/validation/date/file/PDF tests passed; M5 feature checks passed; assistant 20/20 passed; production build/TypeScript passed; lint passed after console fixes; 17 anonymous HTTP checks passed; actual Supabase assertions passed for 9-step roadmap, prerequisite locking, owner progress, completion notifications, repeat submission rejection, booking uniqueness/cancellation, private row isolation, anonymous rejection and self-promotion rejection.

Security audit: runtime dependencies had 0 known vulnerabilities at the audit performed. Five high alerts remain in the dev ESLint dependency chain via braces 3.0.3. No compatible patch was available; no forced version downgrade was applied.

## Deployment handoff

The backend source is published in Amin-Shahin-00/Beluga_HTU, branch M4_Bedaya, under member-4/. Existing team files and the M5 branch were preserved. Vercel deployment is not published. To deploy:

1. Use the M4_Bedaya branch, or coordinate merging it with M3. Do not overwrite the M5 branch.
2. Import that repository into Vercel, choose Next.js, set Root Directory to member-4, and add only the Supabase URL/publishable key from your local config in Vercel Environment Variables.
3. Keep `LLM_PROVIDER=mock`, `BEDAYA_ALLOW_EXTERNAL_AI=false` for the demo; no model key is required.
4. Apply the two migrations and team seed to the target Supabase project if it differs from the current development project.
5. Set Supabase Auth Site URL and allowed redirects to the deployed origin. Keep email confirmation enabled.
6. Re-run authenticated save/read, private uploads, Arabic PDF/ZIP, partner/admin authorization, anonymous rejection and actual two-account isolation on the deployed origin.

The Amiri fonts and SIL OFL license are included and traced into the server build through next.config.ts. .env.example contains placeholders; never commit .env.local/.env.test. No service-role key is needed. Publish only after the account owner completes GitHub/Vercel account setup and agrees to the platform's terms.
