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
| Identity, documents, forms and signing: SANAD mock, OCR mock, PDF forms, sign/submit, office review, notifications | Member 5 (Abdullah) | `app/api/sanad|documents|profile|notifications|staff|einvoicing`, `lib/integrations/{sanad,ocr,pdf,documents,store,notify}`, `app/dashboard`, `app/mock-sanad` |

## Run it

Use Node 20 or later.

```
npm install
cp .env.example .env.local      # then fill in the Supabase URL and publishable key (see below)
npm run dev                     # http://localhost:3000
```

### The database (Member 4's Supabase)

Accounts, roadmaps, bookings and applications are stored in Supabase.

1. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Member 4's project values. Never use the service-role key.
2. If the project is new, run these in the Supabase SQL Editor, in order:
   - `supabase/migrations/202610090001_business_ownership.sql`
   - `supabase/migrations/202610090002_member4_platform.sql`
   - `supabase/seeds/team.sql`

   Re-run `npm run seed:team` first if the demo appointment slots are in the past.
3. The first admin is chosen by the project owner in SQL: `insert into public.bedaya_members(user_id, role) values('<auth user id>', 'admin');`. Admins then assign partner roles from the Management screen.

Without Supabase the site still runs in demo mode: assistant, documents, forms and signing all work, and a banner explains that saving roadmaps needs the database.

To test with a local Supabase instead (Docker + [Supabase CLI](https://supabase.com/docs/guides/local-development)):

1. Run `supabase init`.
2. Copy `supabase/migrations/*` into its `supabase/migrations/`, and `supabase/seeds/team.sql` to `supabase/seed.sql`.
3. Run `supabase start`.
4. Put the printed API URL and publishable key in `.env.local`.

## Demo walkthrough

1. **Sign in with SANAD.** On `/`, click **Login with SANAD**, pick Layla, approve, review the identity and agree.
2. **Create an account and answer the wizard.** Create a Bedaya account (local Supabase needs no email confirmation), sign in, and answer the 9 questions. **Create my roadmap** saves the profile and builds the sourced roadmap.
3. **Work through the roadmap.** Start and complete steps; locked steps explain why.
4. **Documents.** Try the clear, blurry and expired ID samples. The checker flags blurry or expired files and lists what's still missing. Uploads are also copied into Member 4's private vault.
5. **Signatures.** Prepare forms, sign all with SANAD, then send them to the offices. Switch the header to **Government office (demo)** to approve or return them.
6. **Apply for support.** In **Incubators**, preview the draft forms, then apply. Then go to **Bank file** for the ZIP download and to send it.
7. **Book a visit.** In **Appointments**, book and cancel a slot.
8. **Business plan.** View it and download the PDF in Arabic or English.
9. **Assistant.** Ask about fees and documents. Follow-ups like "and how much is it?" work.
10. **Partner and admin.** With an admin account, use **Partner** in the header to review an application. The owner sees the decision under Applications.

Other pages:
- `/dashboard`: Member 5's staff dashboards for government, SANAD and admin (mock sign-in).
- `/mock-sanad/login`: the mock SANAD login.
- Developer benches: `/ai-bench` (AI features), `/m5-demo` (identity API console) and `/backend` (Member 4's API bench).

## Tests

```
npm run check:data         # Member 1 data references
npm run typecheck
npm run test:assistant     # 20 assistant questions (target 18)
npm run test:conversation  # Member 3's conversation cases
npm run test:features      # checker, matching, prefill, business plan, PDFs
npm run test:platform      # Member 4: validation, rules, ranking, dates, files, Arabic PDF
npm run build
```

## What is real and what is simulated

- **Real:** fees, steps, times, offices and required papers come from official Jordanian sources (MIT eRegulations, GAM, JFDA, the chambers, ISTD, SSC); see `data/m1/sources.json`. The support programmes are real (JEDCO, DEF, Orange Corners, Oasis500, QRCE, iPARK, Luminus).
- **Simulated, and labelled on screen:**
  - SANAD login and signatures.
  - OCR.
  - Government form templates ("DEMO FORM - NOT OFFICIAL").
  - The demo bank, appointment slots, compliance dates, zoning check and analytics.
  - Email/WhatsApp sending, which is only logged.
- **AI:** works with no API key (`LLM_PROVIDER=mock` answers from the data). Live AI needs `LLM_PROVIDER=anthropic`, `LLM_API_KEY` and `BEDAYA_ALLOW_EXTERNAL_AI=true`.

## More documentation

- **AI API:** [docs/m5-api.md](docs/m5-api.md)
- **Identity and documents API:** [docs/m5-identity-api.md](docs/m5-identity-api.md)
- **Backend:** [docs/member-4/MEMBER4_HANDOFF.md](docs/member-4/MEMBER4_HANDOFF.md) and [BACKEND_GUIDE.md](docs/member-4/BACKEND_GUIDE.md)
- **Judge Q&A:** [docs/judge-answers.md](docs/judge-answers.md)
- **Design:** [member-2/README.md](member-2/README.md)
