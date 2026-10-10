# Bedaya | بداية

One website that helps people in Jordan start a business. You sign in with SANAD (simulated) and answer a few questions. Bedaya then gives you:

- a sourced roadmap with fees, times and papers;
- a document vault with automatic reading and checks;
- auto-filled government forms you sign in one go;
- matching with real incubators and funds;
- a bank-ready file, bookings and a business plan;
- an Arabic/English assistant.

This branch (`integrated`) merges every team branch into one Next.js app.

| Part | Member | Where it lives now |
| --- | --- | --- |
| Interface design (layout, screens, copy, styles) | Member 2 | `app/site.css`, `public/bedaya/` (logo, font, icons). The original prototype is in `member-2/`. |
| Frontend behaviour: validation, chat provenance/retry, search/filters, file checks, contextual chat replies | Member 3 | `public/bedaya/js/*` and `lib/integrations/assistant/conversation.ts`. The original Flask app is in `member-3/` (reference). |
| Backend: accounts, business, onboarding, roadmap, bookings, applications, bank file, partner/admin (Supabase) | Member 4 | `app/api/auth`, `app/api/business`, `app/api/platform`, `lib/platform`, `lib/supabase`, `supabase/` |
| AI: assistant, document checker, incubator matching, business plan + PDF, official data | Member 5 (Ameen) | `app/api/ai/*`, `lib/integrations/` (assistant, knowledge, incubators, business-plan…), `data/m1/` |
| Accounts per party, SANAD sign-up, experts, map location, Launch Studio, Startup services | Integration | `lib/account.ts`, `app/api/{account,experts,location,workspace,studio,services,sites}`, `lib/studio`, `lib/services`, `app/s`, `proxy.ts`, `public/bedaya/js/{studio,services}.js` |
| Identity, documents, forms and signing: SANAD mock, OCR mock, PDF forms, sign/submit, office review, notifications | Member 5 (Abdullah) | `app/api/sanad|documents|profile|notifications|staff|einvoicing`, `lib/integrations/{sanad,ocr,pdf,documents,store,notify}`, `app/dashboard`, `app/mock-sanad` |

## Run it

Use Node 20 or later.

```
npm install
cp .env.example .env.local      # then fill in the Supabase URL and publishable key (see below)
npm run dev                     # http://localhost:3000
```

### The database (Member 4's Supabase)

Accounts, roadmaps, bookings, applications, expert availability, Launch Studio drafts and published websites are stored in Supabase.

1. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Also set `SUPABASE_SECRET_KEY`. It is **server-only**: it must never be prefixed `NEXT_PUBLIC_` or put in code. "Login with SANAD" needs it to open the account linked to a national ID.
2. The quickest way is to paste **`supabase/setup-all.sql`** into the Supabase SQL Editor and run it. It holds everything below in the right order and is safe to re-run; rebuild it with `npm run db:bundle` after changing a migration or seed. Or run the files one by one, in order:
   - `supabase/migrations/202610090001_business_ownership.sql`
   - `supabase/migrations/202610090002_member4_platform.sql`
   - `supabase/migrations/202610100001_parties_studio_services.sql` (roles per party, SANAD identities, experts, versioned drafts, websites, map zones)
   - `supabase/migrations/202610110001_assistant_chats.sql` (saved assistant conversations)
   - `supabase/seeds/team.sql`
   - `supabase/seeds/accounts.sql` (the demo accounts below; safe to re-run)

   Re-run `npm run seed:team` first if the demo appointment slots are in the past.
3. Admins assign partner (bank/incubator) and expert roles from **Management**.

Without Supabase the site still runs in demo mode. The assistant, documents, forms and signing work, and a banner explains that accounts need the database.

To test with a local Supabase instead (Docker + [Supabase CLI](https://supabase.com/docs/guides/local-development)):

1. Run `supabase init`.
2. Copy `supabase/migrations/*` into its `supabase/migrations/`.
3. Join `supabase/seeds/team.sql` and `supabase/seeds/accounts.sql` into `supabase/seed.sql`.
4. Run `supabase start`.
5. Put the printed API URL, publishable key and secret key in `.env.local`.

## Demo logins

Every party has its own account. The login screen never lists them.

| Party | Email | Password | What they see |
| --- | --- | --- | --- |
| Business owner (Layla) | `layla.demo@example.com` | `Layla2026!` | Owner workspace; linked to SANAD ID 9990000001 |
| Business owner (Omar) | `omar.demo@example.com` | `Omar2026!` | Owner workspace; linked to SANAD ID 9990000002 |
| Bank | `bank.demo@example.com` | `Bank2026!` | Bank inbox (the fictional Demo Bank) |
| Incubator | `incubator.demo@example.com` | `Incubator2026!` | Incubator inbox (JEDCO HBB) |
| Expert | `expert.demo@example.com` | `Expert2026!` | Expert dashboard (Sara Ali) |
| Expert | `expert2.demo@example.com` / `expert3.demo@example.com` | `Expert2026!` | Omar Khalil / Rana Masri |
| Admin | `admin.demo@example.com` | `Admin2026!` | Management, analytics, all inboxes, staff dashboards |

**Mock SANAD identities.** The SANAD password for all three is `Sanad2026!`.

| National ID | Person |
| --- | --- |
| `9990000001` | Layla, Irbid (has an account) |
| `9990000002` | Omar, Amman (has an account) |
| `9990000003` | Rami, Zarqa (no account yet: use him to try **Create account with SANAD**) |

**Login with SANAD** opens the account linked to that national ID. With no linked account, Bedaya offers to create one: SANAD fills in the name, national ID, birth date, phone and address, marked "Verified by SANAD", and you add only an email and password.

## Demo walkthrough

1. **Sign in.** On `/`, use **Login with SANAD** (ID + SANAD password, then approve) or **Sign in with email**. Each account sees only its own data. Sign out clears the session completely.
2. **Owner: answer the wizard.** **Create my roadmap** saves the profile and builds the sourced roadmap.
3. **Documents and signatures.** Upload or try the samples. Sign all forms with SANAD; signed forms are copied into the vault.
4. **Bank file.** Tick the documents to send (signed ones start ticked). **Select all** and the counter stay in sync, and only the ticked files are shared or zipped.
5. **Experts.** Pick an expert to see only their free times, then book. A taken time is refused. Experts manage their own hours in their dashboard. Funding/partner visits stay under **Appointments**.
6. **Location.** Type the address (prefilled from SANAD), place the pin on the map, save it to the business, and check it against the demo zones using the business's own activity.
7. **Launch Studio.**
   - Brand kit: names with meanings, colours with a contrast check, fonts and tone, 4 logos (PNG/SVG), and a brand-guide PDF. Every part is an editable draft with saved versions and approval.
   - Designs: posts, profile and cover images, business card, flyer, menu and shop sign as PNG/PDF.
   - Website: edit by chat or directly, preview on phone or desktop, and publish to `/s/<name>` and `<name>.localhost`.
8. **Startup services.**
   - HR: employees, roles, contract PDFs and leave. Payroll covers Social Security (7.5% employee, 14.25% employer, due by the 15th of the next month) and an income-tax withholding estimate: 12 × salary minus the JOD 9,000 personal exemption (18,000 with dependants), taxed 5–30%. Social Security reminders are included.
   - Domain and email: name ideas, a demo purchase, and DNS records for Google, Microsoft or Zoho.
   - Accounting and branded invoices.
   - Online-presence texts.
   - Hiring: job ad, CV ranking and interview questions.
9. **Bank / incubator / expert / admin.** Sign in with their accounts above. Each lands on its own dashboard, and owner pages are closed to them. Every page has a breadcrumb and **Back to main page**, and the logo always goes home.

Other pages, each with a back bar:
- `/dashboard`: staff dashboards for the government offices, SANAD and the Bedaya team. Sign in with the **admin** account first: in this demo the admin plays each office, and nobody else can open these dashboards. Without Supabase (demo mode) they stay open.
- `/mock-sanad/login`: the mock SANAD sign-in, clearly labelled as a demo, in Arabic or English. It runs in 3 steps: sign in with national ID and SANAD password, approve exactly what Bedaya receives, then return to Bedaya.
- Developer benches: `/ai-bench`, `/m5-demo` and `/backend`.

## The AI Copilot (human in the loop)

After signing in, a business owner lands on the **AI Copilot**. It studies their business (profile, SANAD identity, roadmap, documents) and prepares the work in four stages. Nothing counts until the owner approves it:

1. **Understand**: a one-page business brief (legal path, what's needed, cost and time, risks). The owner can approve it, edit it themselves, or ask the AI to change it.
2. **Plan**: every step with where to go, how (e-sign with SANAD in Bedaya, in person, or at a shop), what to sign, the papers, fees, timing and a tip, plus AI recommendations. Each step is approved or skipped by the owner.
3. **Documents**: the AI drafts the paperwork it can write (activity description, trade-name options, landlord approval letter, home-business commitments, JFDA product sheet, funding letter). Bedaya fills the official forms, and the owner reviews and approves each one. Approved documents download as branded PDFs.
4. **Sign & submit**: only after approval does the owner sign with SANAD.

Every AI draft and every human edit or approval is saved as a version and shown in an activity log (`AI` / `You`). The copilot uses the same local model as the chatbot, and offline templates when the model is off.

## The AI assistant (chatbot)

The **Assistant** page, with past conversations saved to the account, and the **Ask Bedaya** character on every other page, is a chatbot that guides clients through the process in Arabic or English.

- **Grounded, not trained.** Each answer is built from Bedaya's official data, retrieved for the question (fees, papers, offices, timings, sources). It also uses the signed-in client's own situation, read on the server: their business, roadmap progress, next step, the papers still needed, total fees and matching funding programmes. The model writes the answer; the facts come from the data. Nothing is fine-tuned, so when a fee changes you update the data and the chatbot follows.
- **Open-source and local by default.** It runs Qwen 2.5 7B through [Ollama](https://ollama.com) on the laptop's GPU. It's free, needs no API key and no internet, and nothing leaves the machine. Answers stream word by word.
- **Always answers.** If the model is off or slow, the chatbot falls back to Bedaya's offline engine, which still answers personally (next step, total fees, missing papers, funding matches).
- **Safe output.** Model text is escaped. Only bold, lists and links to known Bedaya pages are rendered, and official sources are listed under each answer.

Setup on a new machine:
```
winget install Ollama.Ollama      # or download from ollama.com
ollama pull qwen2.5:7b            # about 4.7 GB; runs on a 6 GB GPU
```
Then set `LLM_PROVIDER=ollama` in `.env.local` and restart. To use Claude instead (paid), set `LLM_PROVIDER=anthropic`, `LLM_API_KEY` and `BEDAYA_ALLOW_EXTERNAL_AI=true`.

## Tests

```
npm run check:data         # Member 1 data references
npm run typecheck
npm run test:assistant     # 20 assistant questions (target 18)
npm run test:conversation  # Member 3's conversation cases
npm run test:features      # checker, matching, prefill, business plan, PDFs
npm run build
```
## What is real and what is simulated

- **Real:** fees, steps, times, offices and required papers come from official Jordanian sources (MIT eRegulations, GAM, JFDA, the chambers, ISTD, SSC); see `data/m1/sources.json`. The support programmes are real (JEDCO, DEF, Orange Corners, Oasis500, QRCE, iPARK, Luminus).
- **Simulated, and labelled on screen:**
  - SANAD login and signatures.
  - OCR.
  - Government form templates ("DEMO FORM - NOT OFFICIAL").
  - The demo bank, appointment and expert slots, compliance dates, zoning areas on the map, and analytics.
  - Domain availability and purchase, and published-site hosting (local subdomains).
  - Email/WhatsApp sending, which is only logged.
- **AI:** works with no API key. `LLM_PROVIDER=mock` answers from the data, and the Launch Studio uses offline generators. `LLM_PROVIDER=ollama` runs a free open-source model locally (see the AI assistant section above). `LLM_PROVIDER=anthropic` uses Claude and needs `LLM_API_KEY` and `BEDAYA_ALLOW_EXTERNAL_AI=true`. All of these are environment variables. Logos from the model are rebuilt by an allow-list SVG sanitiser. The 14 brand fonts are served from `public/vendor/fonts` (SIL Open Font Licence; `scripts/fetch-fonts.mjs` downloaded them). Logos, designs, PDFs and published sites keep their fonts offline; only the street-map tiles need internet. Websites are JSON that fills Bedaya's template, never model-written HTML.

## More documentation

- **AI API:** [docs/m5-api.md](docs/m5-api.md)
- **Identity and documents API:** [docs/m5-identity-api.md](docs/m5-identity-api.md)
- **Backend:** [docs/member-4/MEMBER4_HANDOFF.md](docs/member-4/MEMBER4_HANDOFF.md) and [BACKEND_GUIDE.md](docs/member-4/BACKEND_GUIDE.md)
- **Judge Q&A:** [docs/judge-answers.md](docs/judge-answers.md)
- **Design:** [member-2/README.md](member-2/README.md)
