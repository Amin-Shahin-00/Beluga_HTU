-- M5 tables requested from M4 (Postgres). Dummy draft until M4 sends the real migration.
-- One file for both M5 halves: Ameen's AI features and the identity/documents/signing part.
-- Until M4 lands, lib/integrations/store.ts keeps the same tables in .data/db.json
-- (rewrite only store.ts against these tables; nothing else touches storage).
--
-- Users: user_id references M4's users table (add the foreign key once its name is known).
-- national_id is the SANAD key every M5 row also carries, so SANAD data, consent and
-- signatures line up with the person even before M4's user ids exist.

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  national_id     text not null,
  kind            text not null default 'upload' check (kind in ('upload', 'generated')),
  doc_type        text not null,                 -- DocType in lib/integrations/types.ts (uploads), or the form template key (generated)
  title           text not null default '',
  file_name       text not null,
  storage_path    text not null,                 -- Supabase Storage path
  mime_type       text not null,
  ocr_result      jsonb,                         -- OcrResult from the OCR route (uploads)
  warnings        jsonb not null default '[]',   -- document checker output for this file
  field_sources   jsonb,                         -- generated forms: { fieldKey: 'verified_by_sanad' | 'typed_by_user' | 'read_by_ocr' }
  missing_fields  text[],                        -- generated forms: fields the user still has to fill
  office          text,                          -- generated forms: receiving office, M1 office id (MIT, CCD, GAM, ISTD, JFDA) or IRBID
  submitted_at    timestamptz,
  review          jsonb,                         -- office's latest decision { decision, note, at }; history in reviews
  status          text not null default 'uploaded' check (status in (
                    'uploaded', 'checked', 'rejected',                           -- uploads
                    'ready_to_sign', 'signed', 'submitted', 'approved', 'returned' -- generated forms
                  )),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists documents_user_idx on documents (national_id);
create index if not exists documents_office_idx on documents (office, status);

create table if not exists signatures (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,
  national_id      text not null,
  document_id      uuid not null references documents (id) on delete cascade,
  provider         text not null check (provider in ('mock_sanad', 'sanad', 'drawn')),
  signature_ref    text,                       -- reference from SANAD (mock: MOCK-SIG-...)
  hash             text not null,              -- SHA-256 of the signed PDF
  signer_name      text not null,
  signature_path   text,                       -- PNG of a drawn signature (provider 'drawn' only)
  signed_pdf_path  text,
  ip_address       inet,
  signed_at        timestamptz not null default now()
);

-- Every approve/return decision a government office made on a form.
create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents (id) on delete cascade,
  national_id  text not null,
  office       text not null,
  decision     text not null check (decision in ('approved', 'returned')),
  note         text,
  created_at   timestamptz not null default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  national_id text,
  channel     text not null default 'in_app' check (channel in ('in_app', 'sms', 'email', 'whatsapp')),
  type        text not null,                   -- step_changed, document_needed, visit_soon, forms_ready, documents_signed,
                                               -- forms_submitted, form_approved, form_returned, document_warning, step_done, deadline
  title_ar    text not null,
  title_en    text not null,
  body_ar     text not null,
  body_en     text not null,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on notifications (national_id) where read_at is null;

-- Email and WhatsApp messages. Demo: 'logged' / 'would_send', nothing is sent.
create table if not exists outbox (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('email', 'whatsapp', 'sms')),
  "to"        text not null,
  subject     text,
  body        text not null,
  status      text not null,                   -- logged | would_send | sent | failed
  created_at  timestamptz not null default now()
);

-- Consent before SANAD data is used, and one row for every read of it.
create table if not exists consent_log (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid,
  national_id           text,
  action                text not null default 'consent_given' check (action in ('consent_given', 'consent_revoked', 'data_accessed')),
  scopes                text[] not null default '{}', -- SANAD scopes: identity | contact | address
  purpose               text not null,         -- sanad_login, profile_view, form_autofill, e_signature, gov_review:<office>,
                                               -- ocr_processing, ai_assistant, incubator_share
  granted               boolean not null default true,
  consent_text_version  text not null default 'v1',
  ip_address            inet,
  user_agent            text,
  created_at            timestamptz not null default now()
);
create index if not exists consent_log_user_idx on consent_log (national_id, purpose, created_at desc);

-- Business info the user corrected on the client dashboard. M4: merge into the
-- wizard answers table if you have one; fields are { value, source }.
create table if not exists profiles (
  national_id  text primary key,
  user_id      uuid,
  data         jsonb not null,
  updated_at   timestamptz not null default now()
);

-- Government fees paid through SANAD's payment gateway (mock today).
create table if not exists payments (
  payment_id   text primary key,
  national_id  text not null,
  amount_jod   numeric(10, 3) not null,
  description  text not null,
  status       text not null check (status in ('pending', 'paid', 'failed')),
  created_at   timestamptz not null default now()
);

-- Seed: Layla (user 00000000-0000-4000-8000-000000000001), same files as lib/integrations/fixtures/ocr-results.layla.json
insert into documents (id, user_id, national_id, doc_type, file_name, storage_path, mime_type, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '9991012345', 'national_id', 'layla-national-id.jpg', 'uploads/layla/national-id.jpg', 'image/jpeg', 'uploaded'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '9991012345', 'registration_certificate', 'commercial-register.jpg', 'uploads/layla/commercial-register.jpg', 'image/jpeg', 'uploaded'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '9991012345', 'lease_contract', 'lease-contract.pdf', 'uploads/layla/lease-contract.pdf', 'application/pdf', 'uploaded')
on conflict (id) do nothing;

insert into consent_log (user_id, national_id, purpose, granted, consent_text_version) values
  ('00000000-0000-4000-8000-000000000001', '9991012345', 'ocr_processing', true, 'v1'),
  ('00000000-0000-4000-8000-000000000001', '9991012345', 'ai_assistant', true, 'v1'),
  ('00000000-0000-4000-8000-000000000001', '9991012345', 'incubator_share', true, 'v1');

insert into notifications (user_id, national_id, type, title_ar, title_en, body_ar, body_en) values
  ('00000000-0000-4000-8000-000000000001', '9991012345', 'step_done', 'تم رفع الوثائق', 'Documents uploaded', 'رفعتِ ٣ وثائق، وسنراجعها الآن.', 'You uploaded 3 documents; we are checking them now.');
