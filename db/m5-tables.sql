-- M5 tables requested from M4 (Postgres). Dummy draft until M4 sends the real migration.
-- user_id references M4's users table; add the foreign key once its name is known.

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  doc_type      text not null,                 -- matches DocType in lib/integrations/types.ts
  file_name     text not null,
  storage_path  text not null,
  mime_type     text not null,
  ocr_result    jsonb,                         -- OcrResult from the OCR route
  warnings      jsonb not null default '[]',   -- document checker output for this file
  status        text not null default 'uploaded' check (status in ('uploaded', 'checked', 'rejected', 'signed')),
  uploaded_at   timestamptz not null default now()
);
create index if not exists documents_user_idx on documents (user_id);

create table if not exists signatures (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  document_id      uuid not null references documents (id) on delete cascade,
  signer_name      text not null,
  signature_path   text not null,              -- PNG of the drawn signature
  signed_pdf_path  text,                       -- output of the pdf-lib helper
  ip_address       inet,
  signed_at        timestamptz not null default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  channel     text not null default 'in_app' check (channel in ('in_app', 'sms', 'email', 'whatsapp')),
  type        text not null,                   -- e.g. document_warning, step_done, deadline
  title_ar    text not null,
  title_en    text not null,
  body_ar     text not null,
  body_en     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on notifications (user_id) where read_at is null;

create table if not exists consent_log (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  purpose               text not null,         -- ocr_processing, ai_assistant, incubator_share, e_signature
  granted               boolean not null,
  consent_text_version  text not null,
  ip_address            inet,
  user_agent            text,
  created_at            timestamptz not null default now()
);
create index if not exists consent_log_user_idx on consent_log (user_id, purpose, created_at desc);

-- Seed: Layla (user 00000000-0000-4000-8000-000000000001), same files as lib/integrations/fixtures/ocr-results.layla.json
insert into documents (id, user_id, doc_type, file_name, storage_path, mime_type, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'national_id', 'layla-national-id.jpg', 'uploads/layla/national-id.jpg', 'image/jpeg', 'uploaded'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'registration_certificate', 'commercial-register.jpg', 'uploads/layla/commercial-register.jpg', 'image/jpeg', 'uploaded'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'lease_contract', 'lease-contract.pdf', 'uploads/layla/lease-contract.pdf', 'application/pdf', 'uploaded')
on conflict (id) do nothing;

insert into consent_log (user_id, purpose, granted, consent_text_version) values
  ('00000000-0000-4000-8000-000000000001', 'ocr_processing', true, 'v1'),
  ('00000000-0000-4000-8000-000000000001', 'ai_assistant', true, 'v1'),
  ('00000000-0000-4000-8000-000000000001', 'incubator_share', true, 'v1');

insert into notifications (user_id, type, title_ar, title_en, body_ar, body_en) values
  ('00000000-0000-4000-8000-000000000001', 'step_done', 'تم رفع الوثائق', 'Documents uploaded', 'رفعتِ ٣ وثائق، وسنراجعها الآن.', 'You uploaded 3 documents; we are checking them now.');
