-- Bedaya: separate party accounts, SANAD identity links, expert availability, Launch Studio,
-- published websites, startup-services workspace and map-based location zones.
-- Apply after 202610090002_member4_platform.sql. Idempotent; never deletes business data.
begin;

-- ---------------------------------------------------------------- 1. roles: admin, partner (bank/incubator), expert
alter table public.bedaya_members drop constraint if exists bedaya_members_role_check;
alter table public.bedaya_members drop constraint if exists bedaya_members_check;
alter table public.bedaya_members add constraint bedaya_members_role_check check (role in ('admin','partner','expert'));
alter table public.bedaya_members add constraint bedaya_members_check check (role <> 'partner' or partner_key is not null);

-- ---------------------------------------------------------------- 2. account ↔ SANAD identity (one national ID per account)
create table if not exists public.bedaya_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  national_id text not null unique check (national_id ~ '^\d{10}$'),
  verified jsonb not null default '{}',   -- SANAD fields, each { value, source: "verified_by_sanad" }
  provider text not null default 'mock_sanad',
  created_at timestamptz not null default now()
);
alter table public.bedaya_identities enable row level security;
revoke all on public.bedaya_identities from anon, authenticated;
grant select on public.bedaya_identities to authenticated;
drop policy if exists bedaya_identity_owner on public.bedaya_identities;
create policy bedaya_identity_owner on public.bedaya_identities for select to authenticated using ((select auth.uid()) = user_id);
-- Writes happen only on the server (service role) after a verified SANAD callback.

-- ---------------------------------------------------------------- 3. experts and their own availability
create table if not exists public.bedaya_experts (
  key text primary key check (key ~ '^[a-z0-9-]{2,60}$'),
  user_id uuid unique references auth.users(id) on delete set null,
  name_ar text not null, name_en text not null,
  title_ar text not null, title_en text not null,
  fee_jod numeric not null default 0 check (fee_jod >= 0),
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.bedaya_expert_slots (
  id uuid primary key default gen_random_uuid(),
  expert_key text not null references public.bedaya_experts(key) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 240),
  status text not null default 'open' check (status in ('open','booked')),
  booked_by uuid references auth.users(id),
  business_id bigint,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (expert_key, starts_at)
);
alter table public.bedaya_experts enable row level security;
alter table public.bedaya_expert_slots enable row level security;
revoke all on public.bedaya_experts, public.bedaya_expert_slots from anon, authenticated;
grant select on public.bedaya_experts, public.bedaya_expert_slots to authenticated;
drop policy if exists bedaya_experts_read on public.bedaya_experts;
create policy bedaya_experts_read on public.bedaya_experts for select to authenticated using (true);
drop policy if exists bedaya_expert_slots_read on public.bedaya_expert_slots;
create policy bedaya_expert_slots_read on public.bedaya_expert_slots for select to authenticated using (
  status = 'open' or booked_by = (select auth.uid())
  or expert_key in (select key from public.bedaya_experts where user_id = (select auth.uid()))
);

create or replace function public.bedaya_my_expert_key() returns text
language sql stable security definer set search_path='' as $$
  select key from public.bedaya_experts where user_id = (select auth.uid());
$$;

create or replace function public.bedaya_expert_add_slot(p_starts timestamptz, p_minutes integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare k text := public.bedaya_my_expert_key(); result uuid; begin
  if k is null then raise insufficient_privilege; end if;
  if p_starts <= now() then raise exception 'Slot must be in the future'; end if;
  insert into public.bedaya_expert_slots(expert_key, starts_at, duration_minutes) values (k, p_starts, coalesce(p_minutes, 30)) returning id into result;
  return result;
end $$;

create or replace function public.bedaya_expert_remove_slot(p_slot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare k text := public.bedaya_my_expert_key(); begin
  if k is null then raise insufficient_privilege; end if;
  delete from public.bedaya_expert_slots where id = p_slot and expert_key = k and status = 'open';
  if not found then raise exception 'Only your own free slots can be removed'; end if;
end $$;

-- Atomic: only one owner can turn an open slot into a booking (double-booking is impossible).
create or replace function public.bedaya_book_expert(p_slot uuid, p_business bigint) returns uuid
language plpgsql security definer set search_path='' as $$ begin
  if not exists (select 1 from public.businesses where id = p_business and user_id = auth.uid()) then raise insufficient_privilege; end if;
  update public.bedaya_expert_slots set status = 'booked', booked_by = auth.uid(), business_id = p_business, booked_at = now()
   where id = p_slot and status = 'open' and starts_at > now();
  if not found then raise exception 'Slot unavailable' using errcode = 'P0001'; end if;
  return p_slot;
end $$;

create or replace function public.bedaya_cancel_expert(p_slot uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.bedaya_expert_slots set status = 'open', booked_by = null, business_id = null, booked_at = null
   where id = p_slot and status = 'booked'
     and (booked_by = auth.uid() or expert_key = public.bedaya_my_expert_key());
  if not found then raise insufficient_privilege; end if;
end $$;

-- Admins can now assign the expert role too (p_partner = expert key for experts).
create or replace function public.bedaya_set_member(p_user uuid, p_role text, p_partner text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if not public.bedaya_is_admin() then raise insufficient_privilege; end if;
  if p_role not in ('admin','partner','expert') then raise exception 'Invalid role'; end if;
  if p_role = 'partner' and not exists (select 1 from public.bedaya_catalog where key = p_partner and kind = 'partner') then raise exception 'Unknown partner'; end if;
  if p_role = 'expert' and not exists (select 1 from public.bedaya_experts where key = p_partner) then raise exception 'Unknown expert'; end if;
  if p_user = auth.uid() and p_role <> 'admin' and (select count(*) from public.bedaya_members where role = 'admin') <= 1 then raise exception 'Cannot remove last admin'; end if;
  insert into public.bedaya_members(user_id, role, partner_key) values (p_user, p_role, case when p_role = 'partner' then p_partner else null end)
    on conflict (user_id) do update set role = excluded.role, partner_key = excluded.partner_key;
  if p_role = 'expert' then update public.bedaya_experts set user_id = p_user where key = p_partner; end if;
  insert into public.bedaya_audit(user_id, event, details) values (auth.uid(), 'member_role_set', jsonb_build_object('target', p_user, 'role', p_role, 'partner', p_partner));
end $$;

-- ---------------------------------------------------------------- 4. versioned workspace (Launch Studio drafts, services data)
create table if not exists public.bedaya_workspace (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  item text not null default '' check (length(item) <= 80),
  version integer not null,
  data jsonb not null,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (business_id, user_id) references public.businesses(id, user_id),
  unique (business_id, kind, item, version)
);
create index if not exists bedaya_workspace_lookup on public.bedaya_workspace (business_id, kind, item, version desc);
alter table public.bedaya_workspace enable row level security;
revoke all on public.bedaya_workspace from anon, authenticated;
grant select on public.bedaya_workspace to authenticated;
drop policy if exists bedaya_workspace_owner on public.bedaya_workspace;
create policy bedaya_workspace_owner on public.bedaya_workspace for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.bedaya_workspace_save(p_business bigint, p_kind text, p_item text, p_data jsonb, p_approved boolean) returns public.bedaya_workspace
language plpgsql security definer set search_path='' as $$
declare row public.bedaya_workspace; next_version integer; begin
  if not exists (select 1 from public.businesses where id = p_business and user_id = auth.uid()) then raise insufficient_privilege; end if;
  if octet_length(p_data::text) > 400000 then raise exception 'Draft too large'; end if;
  perform pg_advisory_xact_lock(hashtext(p_business::text || p_kind || coalesce(p_item, '')));
  select coalesce(max(version), 0) + 1 into next_version from public.bedaya_workspace where business_id = p_business and kind = p_kind and item = coalesce(p_item, '');
  insert into public.bedaya_workspace(business_id, user_id, kind, item, version, data, approved)
    values (p_business, auth.uid(), p_kind, coalesce(p_item, ''), next_version, p_data, coalesce(p_approved, false)) returning * into row;
  return row;
end $$;

-- ---------------------------------------------------------------- 5. published websites (public read, owner writes)
create table if not exists public.bedaya_sites (
  slug text primary key check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'),
  business_id bigint not null unique,
  user_id uuid not null references auth.users(id),
  data jsonb not null,
  published_at timestamptz not null default now(),
  foreign key (business_id, user_id) references public.businesses(id, user_id)
);
create table if not exists public.bedaya_site_messages (
  id uuid primary key default gen_random_uuid(),
  slug text not null references public.bedaya_sites(slug) on delete cascade on update cascade,
  name text not null check (length(name) between 1 and 120),
  contact text not null check (length(contact) between 3 and 160),
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.bedaya_sites enable row level security;
alter table public.bedaya_site_messages enable row level security;
revoke all on public.bedaya_sites, public.bedaya_site_messages from anon, authenticated;
grant select on public.bedaya_sites, public.bedaya_site_messages to authenticated;
drop policy if exists bedaya_sites_owner on public.bedaya_sites;
create policy bedaya_sites_owner on public.bedaya_sites for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists bedaya_site_messages_owner on public.bedaya_site_messages;
create policy bedaya_site_messages_owner on public.bedaya_site_messages for select to authenticated
  using (exists (select 1 from public.bedaya_sites s where s.slug = bedaya_site_messages.slug and s.user_id = (select auth.uid())));

create or replace function public.bedaya_publish_site(p_business bigint, p_slug text, p_data jsonb) returns text
language plpgsql security definer set search_path='' as $$ begin
  if not exists (select 1 from public.businesses where id = p_business and user_id = auth.uid()) then raise insufficient_privilege; end if;
  if exists (select 1 from public.bedaya_sites where slug = p_slug and business_id <> p_business) then raise exception 'Address taken' using errcode = '23505'; end if;
  if octet_length(p_data::text) > 400000 then raise exception 'Site too large'; end if;
  insert into public.bedaya_sites(slug, business_id, user_id, data, published_at) values (p_slug, p_business, auth.uid(), p_data, now())
    on conflict (business_id) do update set slug = excluded.slug, data = excluded.data, published_at = now();
  return p_slug;
end $$;

create or replace function public.bedaya_get_site(p_slug text) returns table (slug text, data jsonb, published_at timestamptz)
language sql stable security definer set search_path='' as $$
  select s.slug, s.data, s.published_at from public.bedaya_sites s where s.slug = p_slug;
$$;

create or replace function public.bedaya_site_message(p_slug text, p_name text, p_contact text, p_message text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if not exists (select 1 from public.bedaya_sites where slug = p_slug) then raise exception 'Unknown site'; end if;
  insert into public.bedaya_site_messages(slug, name, contact, message) values (p_slug, left(trim(p_name), 120), left(trim(p_contact), 160), left(trim(p_message), 2000));
end $$;

-- ---------------------------------------------------------------- grants for the new functions
revoke all on function public.bedaya_my_expert_key(), public.bedaya_expert_add_slot(timestamptz, integer), public.bedaya_expert_remove_slot(uuid),
  public.bedaya_book_expert(uuid, bigint), public.bedaya_cancel_expert(uuid), public.bedaya_workspace_save(bigint, text, text, jsonb, boolean),
  public.bedaya_publish_site(bigint, text, jsonb), public.bedaya_get_site(text), public.bedaya_site_message(text, text, text, text) from public, anon;
grant execute on function public.bedaya_my_expert_key(), public.bedaya_expert_add_slot(timestamptz, integer), public.bedaya_expert_remove_slot(uuid),
  public.bedaya_book_expert(uuid, bigint), public.bedaya_cancel_expert(uuid), public.bedaya_workspace_save(bigint, text, text, jsonb, boolean),
  public.bedaya_publish_site(bigint, text, jsonb) to authenticated;
grant execute on function public.bedaya_get_site(text), public.bedaya_site_message(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- 6. location zones for the map checker (fictional zoning)
update public.bedaya_catalog
   set payload = payload || jsonb_build_object('zones', jsonb_build_array(
     jsonb_build_object('name', 'Amman · Jabal Al-Hussein residential (demo)', 'nameAr', 'عمّان · جبل الحسين سكني (تجريبي)', 'polygon', '[[31.9660,35.9000],[31.9760,35.9000],[31.9760,35.9150],[31.9660,35.9150]]'::jsonb, 'activities', '["food","crafts","services","tech"]'::jsonb),
     jsonb_build_object('name', 'Amman · Abdali commercial (demo)', 'nameAr', 'عمّان · العبدلي تجاري (تجريبي)', 'polygon', '[[31.9580,35.9000],[31.9659,35.9000],[31.9659,35.9150],[31.9580,35.9150]]'::jsonb, 'activities', '["retail","services","tech","food"]'::jsonb),
     jsonb_build_object('name', 'Amman · Shmeisani offices (demo)', 'nameAr', 'عمّان · الشميساني مكاتب (تجريبي)', 'polygon', '[[31.9650,35.8750],[31.9760,35.8750],[31.9760,35.8999],[31.9650,35.8999]]'::jsonb, 'activities', '["services","tech"]'::jsonb),
     jsonb_build_object('name', 'Irbid · Al-Nuzha residential (demo)', 'nameAr', 'إربد · حي النزهة سكني (تجريبي)', 'polygon', '[[32.5380,35.8400],[32.5520,35.8400],[32.5520,35.8600],[32.5380,35.8600]]'::jsonb, 'activities', '["food","crafts","services"]'::jsonb),
     jsonb_build_object('name', 'Irbid · city centre commercial (demo)', 'nameAr', 'إربد · وسط البلد تجاري (تجريبي)', 'polygon', '[[32.5521,35.8400],[32.5620,35.8400],[32.5620,35.8600],[32.5521,35.8600]]'::jsonb, 'activities', '["retail","services","food","tech"]'::jsonb),
     jsonb_build_object('name', 'Zarqa · industrial (demo)', 'nameAr', 'الزرقاء · صناعي (تجريبي)', 'polygon', '[[32.0500,36.0800],[32.0700,36.0800],[32.0700,36.1000],[32.0500,36.1000]]'::jsonb, 'activities', '["retail","services","tech","crafts"]'::jsonb)
   ))
 where key = 'location-demo';

commit;
