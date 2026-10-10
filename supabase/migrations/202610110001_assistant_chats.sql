-- Bedaya: saved assistant conversations, so each owner can reopen past chats on any device.
-- Apply after 202610100001_parties_studio_services.sql. Idempotent.
begin;

create table if not exists public.bedaya_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (length(title) <= 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bedaya_chats_user_updated on public.bedaya_chats (user_id, updated_at desc);

alter table public.bedaya_chats enable row level security;
revoke all on public.bedaya_chats from anon, authenticated;
grant select, insert, update, delete on public.bedaya_chats to authenticated;

drop policy if exists bedaya_chats_own on public.bedaya_chats;
create policy bedaya_chats_own on public.bedaya_chats for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
