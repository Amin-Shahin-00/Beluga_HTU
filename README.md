# Bedaya | بداية · MVP2

**Start your business in Jordan, guided by an AI copilot.**
**ابدأ مشروعك في الأردن بمساعدة مستشار ذكي.**

Bedaya is one website where a person in Jordan signs in with SANAD and gets everything needed to open a business:
- a sourced roadmap of fees, papers and offices;
- forms filled for them, which they sign with SANAD;
- funding matches;
- a brand and website;
- **Saad (سعد)**, an AI copilot that prepares the work while the owner approves every step.

Everything works in **Arabic and English**, on desktop and phone.

---

## What's new in MVP2

| | |
| --- | --- |
| **Saad, the AI copilot** | After sign-in, owners land on Saad. He studies the business and prepares, in four stages, a brief, a launch plan (where to go, what to sign and where), the paperwork, and signing. **Human in the loop:** nothing counts until the owner approves it. Every AI draft and every approval is versioned and logged. |
| **Legal structure chooser** | Saad compares the legal structures and recommends one for the business, with reasons: home business, sole proprietorship (مؤسسة فردية), LLC (ذات مسؤولية محدودة), general partnership (تضامن), limited partnership (توصية بسيطة), private shareholding (مساهمة خاصة) and non-profit (غير ربحية). The owner decides; switching rebuilds the roadmap from the official rules. |
| **Ask Saad chatbot** | A friendly character on every page opens the chat. Answers stream in Arabic or English, grounded in official data and the client's own progress. Past conversations are saved to the account. |
| **Free, local, open-source AI** | Runs **Qwen 2.5 7B** through Ollama on the laptop: no API key, no cost, no internet, and no data leaves the machine. If the model is off, every AI feature falls back to offline answers. |
| **Simpler navigation** | Eight menu sections (Saad, Roadmap, Documents & signing, Funding & support, Launch Studio, Business tools, Assistant, Notifications), with tabs inside. |
| **Redesigned SANAD sign-in** | A 3-step, bilingual screen: sign in, approve exactly what's shared, return to Bedaya. |
| **More** | Payroll with Social Security and an income-tax estimate. Admin-only staff dashboards. Brand fonts that work offline. A cleaner, production-ready interface. |

---

## Who uses it

| Party | What they do in Bedaya |
| --- | --- |
| **Business owner** | Works with Saad: legal structure, brief, plan and documents. Follows the roadmap, uploads papers (with automatic checks), signs forms with SANAD, applies to real incubators and funds, sends a bank file with selected documents, books experts, checks a location on a map, and builds a brand, designs and a website (Launch Studio). Also gets HR & payroll, domain & email, accounting, online presence and hiring tools. |
| **Bank / Incubator** | Each has its own inbox of applications sent to them. They review and decide, and the owner sees the decision. |
| **Expert** | Publishes their own free times and sees and cancels bookings. A taken slot can't be double-booked. |
| **Admin** | Manages the rules catalogue, partners and roles, sees analytics, and plays each government office on the staff dashboards (approve or return signed forms). |

---

## Quick start

**You need:** Node 20+, a Supabase project (or a local Supabase in Docker), and Ollama for the AI (optional; without it, AI features use offline answers).

```bash
git clone -b MVP2 https://github.com/Amin-Shahin-00/Beluga_HTU.git
cd Beluga_HTU
npm install
cp .env.example .env.local        # fill in the values below
npm run build && npm start         # http://localhost:3000  (or: npm run dev)
```

### 1. Database (Supabase)
1. Open your Supabase project, go to **SQL Editor**, paste **`supabase/setup-all.sql`** and run it. It creates every table and function and adds the demo accounts, and it's safe to run again.
2. Put the project's values in `.env.local`:

   | Variable | Where to find it | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project settings → API | Safe for the browser |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project settings → API keys | Safe for the browser |
   | `SUPABASE_SECRET_KEY` | Project settings → API keys | **Server only.** Never prefix with `NEXT_PUBLIC_`, never commit. Needed for "Login with SANAD". |

**Local Supabase instead.** Install the [Supabase CLI](https://supabase.com/docs/guides/local-development) and run `supabase init` and `supabase start`. Then copy `supabase/migrations/*` in, and put the printed URL and keys in `.env.local`.

### 2. AI (optional, free)
```bash
winget install Ollama.Ollama      # or download from https://ollama.com
ollama pull qwen2.5:7b            # ~4.7 GB, runs on a 6 GB GPU (or CPU, slower)
```
Then in `.env.local`:
```
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b
```
The other providers:
- `LLM_PROVIDER=mock`: offline answers only.
- `LLM_PROVIDER=anthropic`: Claude. Paid; needs `LLM_API_KEY` and `BEDAYA_ALLOW_EXTERNAL_AI=true`.

Every key lives in environment variables, never in the code. See `.env.example` for all settings.

---

## Demo logins

The login screen never lists these; they're only here.

| Party | Email | Password |
| --- | --- | --- |
| Business owner (Layla, home bakery in Irbid) | `layla.demo@example.com` | `Layla2026!` |
| Business owner (Omar) | `omar.demo@example.com` | `Omar2026!` |
| Bank (Partner Bank) | `bank.demo@example.com` | `Bank2026!` |
| Incubator (JEDCO HBB) | `incubator.demo@example.com` | `Incubator2026!` |
| Expert (Sara Ali) | `expert.demo@example.com` | `Expert2026!` |
| Experts (Omar Khalil / Rana Masri) | `expert2.demo@example.com` / `expert3.demo@example.com` | `Expert2026!` |
| Admin | `admin.demo@example.com` | `Admin2026!` |

**SANAD (mock) identities.** The SANAD password for all three is `Sanad2026!`.

| National ID | Person | What happens |
| --- | --- | --- |
| `9990000001` | Layla | Opens Layla's account |
| `9990000002` | Omar | Opens Omar's account |
| `9990000003` | Rami | No account yet: **Create account with SANAD** fills his verified details; he only adds an email and password |

---

## A 5-minute demo

1. **Login with SANAD** as `9990000001` / `Sanad2026!`, then approve. Layla lands on **Saad**: "Hi Layla, I'm Saad. I've studied Layla's Home Bakery."
2. **Legal structure:** Saad compares the options and recommends a home business for her, with reasons. Open "Other structures" to show partnerships, shareholding and non-profit.
3. **Study my business:** Saad writes a brief. **Ask AI to change** it ("make it shorter"), then **Approve**.
4. **Build my plan:** each step says where to go, how to sign (SANAD in Bedaya or in person), papers, fees and a tip. Approve the steps.
5. **Documents:** Saad writes the landlord approval letter. Review it, approve it and download the branded PDF. Prepare the official forms and approve them, then **Go to signing** and sign with SANAD.
6. **Ask Saad** (the character in the corner): "How much will all the fees cost me?" The answer streams with exact numbers from official data.
7. **Launch Studio:** generate a brand, logos and a website, and publish it live.
8. Sign in as the **bank** or the **admin** to show the other side of the platform.

---

## How Saad's AI works

- **Grounded, not trained.** Saad doesn't rely on what the model "remembers". Each answer is built from Bedaya's official data (fees, papers, offices, timings, with sources), retrieved for the question, plus the client's own situation read on the server. When a fee changes, you update the data; nothing needs retraining.
- **Exact numbers.** When Bedaya can compute an answer (total fees, next step, missing papers, funding matches), the model only rephrases that verified answer.
- **Human in the loop.** In the copilot, the AI only drafts. The owner approves, edits, or asks for changes. Approvals are versioned, and an activity log shows what the AI did and what the owner did. Only approved forms go to signing.
- **Stays on topic.** Off-topic requests (poems, sports…) get a polite refusal without calling the model.
- **Safe output.** Model text is escaped before display. Websites are JSON that fills Bedaya's own template, never model-written HTML. AI-made logos pass an allow-list SVG sanitiser.
- **Always works.** If the model is off or slow, offline answers take over.

---

## Project map

| Area | Where |
| --- | --- |
| Website (single-page app) | `public/bedaya/js/` (`main`, `core`, `onboarding`, `owner`, `partners`, `tools`, `staff`, `studio`, `services`, `chat`, `copilot`) and `app/site.css` |
| Saad copilot | `lib/copilot.ts`, `lib/legal-forms.ts`, `app/api/copilot/[action]` |
| Saad chatbot | `lib/integrations/assistant/` (`chatbot.ts`, `engine.ts`), `app/api/ai/chat/*`, `app/api/ai/chats` |
| AI provider layer | `lib/integrations/llm.ts` (Ollama, Claude or offline) |
| Accounts, roles, SANAD linking | `lib/account.ts`, `app/api/account/*`, `app/mock-sanad` |
| Platform backend (roadmap, documents, applications, bookings) | `app/api/platform`, `lib/platform`, `lib/supabase` |
| Identity, forms, signing, office review | `lib/integrations/{sanad,ocr,pdf,documents,store}`, `app/dashboard` |
| Launch Studio and published sites | `lib/studio`, `app/api/studio`, `app/s/[slug]`, `proxy.ts` |
| Business tools | `lib/services`, `app/api/services`, `public/bedaya/js/services.js` |
| Official data | `data/m1/` (rules, offices, documents, incubators, sources) and `lib/integrations/knowledge.json` |
| Database | `supabase/migrations/`, `supabase/seeds/`, `supabase/setup-all.sql` (`npm run db:bundle` rebuilds it) |

**Team.**
- Member 1: official data and rules.
- Member 2: interface design (`member-2/`).
- Member 3: frontend behaviour (`member-3/`).
- Member 4: backend and Supabase.
- Member 5 (Ameen): AI.
- Member 5 (Abdullah): identity, documents and signing.

---

## What is real and what is simulated

- **Real:**
  - fees, steps, times, offices and required papers, from official Jordanian sources (MIT eRegulations, GAM, JFDA, the chambers, ISTD, SSC; see `data/m1/sources.json`);
  - the support programmes (JEDCO, DEF, Orange Corners, Oasis500, QRCE, iPARK, Luminus);
  - the Social Security and income-tax rates;
  - the open-source AI model.
- **Simulated for the MVP:**
  - SANAD sign-in and signatures (the SANAD screens are labelled as a demo);
  - document reading (OCR);
  - government form templates (stamped "DEMO FORM – NOT OFFICIAL");
  - the partner bank, appointment slots and zoning areas;
  - domain purchase and site hosting (local subdomains);
  - email/WhatsApp sending (only logged).

---

## Tests

```bash
npm run check:data         # official data references
npm run typecheck
npm run test:assistant     # 20 assistant questions
npm run test:conversation  # conversation follow-ups
npm run test:features      # checker, matching, prefill, business plan, PDFs
npm run build
```

## More documentation
- AI API: [docs/m5-api.md](docs/m5-api.md)
- Identity and documents API: [docs/m5-identity-api.md](docs/m5-identity-api.md)
- Backend: [docs/member-4/MEMBER4_HANDOFF.md](docs/member-4/MEMBER4_HANDOFF.md) and [BACKEND_GUIDE.md](docs/member-4/BACKEND_GUIDE.md)
- Judge Q&A: [docs/judge-answers.md](docs/judge-answers.md)
- Design: [member-2/README.md](member-2/README.md)
