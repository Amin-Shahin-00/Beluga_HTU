-- Member 4: additive schema. Fictional demo catalogs are seeded separately.
begin;
create unique index if not exists businesses_id_owner_idx on public.businesses(id,user_id);
create table if not exists public.bedaya_catalog (
  key text primary key check(length(key) between 1 and 80),
  kind text not null check(kind in ('rules','partner','slot','compliance','location')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  is_demo boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.bedaya_members (
  user_id uuid primary key references auth.users(id),
  role text not null check(role in ('admin','partner')),
  partner_key text references public.bedaya_catalog(key),
  check(role='admin' or partner_key is not null)
);
create or replace function public.bedaya_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.bedaya_members where user_id=(select auth.uid()) and role='admin');
$$;
create or replace function public.bedaya_is_partner(p_key text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.bedaya_members where user_id=(select auth.uid()) and role='partner' and partner_key=p_key);
$$;
revoke all on function public.bedaya_is_admin(), public.bedaya_is_partner(text) from public,anon;
grant execute on function public.bedaya_is_admin(), public.bedaya_is_partner(text) to authenticated;

create table if not exists public.bedaya_profiles (
  business_id bigint primary key,
  user_id uuid not null references auth.users(id),
  answers jsonb not null default '{}' check(jsonb_typeof(answers)='object'),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key(business_id,user_id) references public.businesses(id,user_id)
);
create table if not exists public.bedaya_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null,
  user_id uuid not null,
  step_key text not null,
  title_ar text not null,
  title_en text not null,
  office text not null,
  documents jsonb not null default '[]',
  dependencies text[] not null default '{}',
  fee_min numeric check(fee_min>=0),
  fee_max numeric check(fee_max>=0),
  days integer check(days>=0),
  details jsonb not null default '{}',
  online boolean not null default false,
  is_demo boolean not null default true,
  status text not null default 'pending' check(status in ('pending','in_progress','done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(business_id,user_id) references public.businesses(id,user_id),
  unique(business_id,step_key)
);
create table if not exists public.bedaya_documents (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null,
  user_id uuid not null,
  kind text not null check(kind in ('identity','address','registration','license','other','generated','signed')),
  filename text not null check(length(filename) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  status text not null default 'pending' check(status in ('pending','ready')),
  expires_on date,
  ocr_result jsonb,
  warnings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  foreign key(business_id,user_id) references public.businesses(id,user_id),
  check(split_part(storage_path,'/',1)=user_id::text and split_part(storage_path,'/',2)=business_id::text)
);
create table if not exists public.bedaya_applications (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null,
  user_id uuid not null,
  partner_key text not null references public.bedaya_catalog(key),
  kind text not null check(kind in ('incubator','bank')),
  payload jsonb not null,
  consent boolean not null check(consent),
  status text not null default 'submitted' check(status in ('submitted','in_review','needs_documents','approved','rejected')),
  review_note text not null default '',
  requested_items jsonb not null default '[]',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(business_id,user_id) references public.businesses(id,user_id),
  unique(business_id,partner_key)
);
create table if not exists public.bedaya_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null,
  user_id uuid not null,
  slot_key text not null references public.bedaya_catalog(key),
  status text not null default 'booked' check(status in ('booked','cancelled')),
  created_at timestamptz not null default now(),
  foreign key(business_id,user_id) references public.businesses(id,user_id)
);
create unique index if not exists bedaya_active_slot_idx on public.bedaya_bookings(slot_key) where status='booked';
create table if not exists public.bedaya_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  event text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.bedaya_catalog enable row level security;
alter table public.bedaya_members enable row level security;
alter table public.bedaya_profiles enable row level security;
alter table public.bedaya_tasks enable row level security;
alter table public.bedaya_documents enable row level security;
alter table public.bedaya_applications enable row level security;
alter table public.bedaya_bookings enable row level security;
alter table public.bedaya_audit enable row level security;
revoke all on public.bedaya_catalog,public.bedaya_members,public.bedaya_profiles,public.bedaya_tasks,public.bedaya_documents,public.bedaya_applications,public.bedaya_bookings,public.bedaya_audit from anon,authenticated;
grant select on public.bedaya_catalog,public.bedaya_members,public.bedaya_profiles,public.bedaya_tasks,public.bedaya_documents,public.bedaya_applications,public.bedaya_bookings,public.bedaya_audit to authenticated;
grant insert,update on public.bedaya_catalog to authenticated;
grant insert,update on public.bedaya_profiles to authenticated;
grant insert on public.bedaya_documents,public.bedaya_applications,public.bedaya_audit to authenticated;
grant update(status,expires_on,ocr_result,warnings) on public.bedaya_documents to authenticated;
grant update(status,review_note,requested_items,reviewed_at) on public.bedaya_applications to authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='bedaya_catalog') then
    create policy catalog_read on public.bedaya_catalog for select to authenticated using(true);
    create policy catalog_admin on public.bedaya_catalog for all to authenticated using(public.bedaya_is_admin()) with check(public.bedaya_is_admin());
    create policy membership_read on public.bedaya_members for select to authenticated using(user_id=(select auth.uid()) or public.bedaya_is_admin());
    create policy profile_owner_read on public.bedaya_profiles for select to authenticated using(user_id=(select auth.uid()));
    create policy profile_owner_draft_insert on public.bedaya_profiles for insert to authenticated with check(user_id=(select auth.uid()) and submitted_at is null);
    create policy profile_owner_draft_update on public.bedaya_profiles for update to authenticated using(user_id=(select auth.uid()) and submitted_at is null) with check(user_id=(select auth.uid()) and submitted_at is null);
    create policy task_owner_read on public.bedaya_tasks for select to authenticated using(user_id=(select auth.uid()));
    create policy document_owner on public.bedaya_documents for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
    create policy application_read on public.bedaya_applications for select to authenticated using(user_id=(select auth.uid()) or public.bedaya_is_partner(partner_key) or public.bedaya_is_admin());
    create policy application_owner_insert on public.bedaya_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='submitted' and review_note='' and requested_items='[]'::jsonb and reviewed_at is null and consent);
    create policy application_partner_review on public.bedaya_applications for update to authenticated using(public.bedaya_is_partner(partner_key) or public.bedaya_is_admin()) with check(public.bedaya_is_partner(partner_key) or public.bedaya_is_admin());
    create policy booking_owner_read on public.bedaya_bookings for select to authenticated using(user_id=(select auth.uid()));
    create policy audit_read on public.bedaya_audit for select to authenticated using(user_id=(select auth.uid()) or public.bedaya_is_admin());
    create policy audit_insert on public.bedaya_audit for insert to authenticated with check(user_id=(select auth.uid()));
  end if;
end $$;

create or replace function public.bedaya_condition(p_condition text,p_answers jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case p_condition
 when 'always' then true
 when 'optional' then coalesce((p_answers#>>'{business,wantsTradeName}')::boolean,false)
 when 'if_trade_name' then coalesce((p_answers#>>'{business,wantsTradeName}')::boolean,false)
 when 'if_food' then p_answers#>>'{business,sector}'='food'
 when 'if_employees' then coalesce((p_answers#>>'{business,employeesPlanned}')::int,0)>0
 when 'if_rented' then coalesce(p_answers#>>'{business,premises}','rented')='rented'
 when 'if_male_born_1989_plus' then p_answers#>>'{personal,gender}'='male' and coalesce(nullif(substring(p_answers#>>'{personal,birthDate}',1,4),''),'0')::int>=1989
 else false end;
$$;
revoke all on function public.bedaya_condition(text,jsonb) from public,anon;
grant execute on function public.bedaya_condition(text,jsonb) to authenticated;
create or replace function public.bedaya_submit(p_business bigint,p_answers jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); rules jsonb; step jsonb; previous_key text; docs jsonb; begin
  if uid is null or not exists(select 1 from public.businesses where id=p_business and user_id=uid) then raise insufficient_privilege; end if;
  p_answers := jsonb_set(p_answers,'{userId}',to_jsonb(uid::text),true);
  if jsonb_typeof(p_answers)<>'object' or coalesce(p_answers#>>'{business,legalForm}','') not in ('home_business','sole_proprietorship','llc') or coalesce(p_answers#>>'{personal,city}','')='' then raise exception 'Invalid onboarding'; end if;
  select payload into rules from public.bedaya_catalog where key='rules-team-v1' and kind='rules';
  if rules is null then raise exception 'Rules catalog missing'; end if;
  insert into public.bedaya_profiles(business_id,user_id,answers) values(p_business,uid,p_answers) on conflict(business_id) do nothing;
  perform 1 from public.bedaya_profiles where business_id=p_business for update;
  if exists(select 1 from public.bedaya_tasks where business_id=p_business) then raise exception 'Roadmap already submitted'; end if;
  update public.bedaya_profiles set answers=p_answers,submitted_at=now(),updated_at=now() where business_id=p_business;
  for step in select value from jsonb_array_elements(rules->'steps') loop
    if step->>'legalForm'=p_answers#>>'{business,legalForm}' and public.bedaya_condition(step->>'condition',p_answers) then
      select coalesce(jsonb_agg(d->>'docId'),'[]') into docs from jsonb_array_elements(step->'requiredDocs') d where public.bedaya_condition(d->>'condition',p_answers);
      insert into public.bedaya_tasks(business_id,user_id,step_key,title_ar,title_en,office,documents,dependencies,fee_min,fee_max,days,details,is_demo)
      values(p_business,uid,step->>'key',step#>>'{title,ar}',step#>>'{title,en}',step->>'officeId',docs,case when previous_key is null then '{}'::text[] else array[previous_key] end,(step#>>'{fee,minJod}')::numeric,(step#>>'{fee,maxJod}')::numeric,(step#>>'{days,value}')::integer,step,false);
      previous_key := step->>'key';
    end if;
  end loop;
end $$;
create or replace function public.bedaya_update_task(p_task uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare task public.bedaya_tasks; begin
  select * into task from public.bedaya_tasks where id=p_task and user_id=auth.uid();
  if task.id is null then raise insufficient_privilege; end if;
  perform 1 from public.bedaya_profiles where business_id=task.business_id for update;
  if p_status not in ('pending','in_progress','done') then raise exception 'Invalid status'; end if;
  if p_status<>'pending' and exists(select 1 from unnest(task.dependencies) dep where not exists(select 1 from public.bedaya_tasks t where t.business_id=task.business_id and t.step_key=dep and t.status='done')) then raise exception 'Complete prerequisite steps first'; end if;
  if p_status<>'done' and exists(select 1 from public.bedaya_tasks t where t.business_id=task.business_id and task.step_key=any(t.dependencies) and t.status<>'pending') then raise exception 'Dependent steps already started'; end if;
  update public.bedaya_tasks set status=p_status,completed_at=case when p_status='done' then now() else null end where id=p_task;
end $$;
create or replace function public.bedaya_book(p_business bigint,p_slot text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; slot jsonb; begin
  if not exists(select 1 from public.businesses where id=p_business and user_id=auth.uid()) then raise insufficient_privilege; end if;
  select payload into slot from public.bedaya_catalog where key=p_slot and kind='slot' for update;
  if slot is null or (slot->>'starts_at')::timestamptz<=now() then raise exception 'Slot unavailable'; end if;
  insert into public.bedaya_bookings(business_id,user_id,slot_key) values(p_business,auth.uid(),p_slot) returning id into result;
  return result;
end $$;
create or replace function public.bedaya_cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.bedaya_bookings set status='cancelled' where id=p_booking and user_id=auth.uid();
  if not found then raise insufficient_privilege; end if;
end $$;
create or replace function public.bedaya_available_slots() returns table(key text,payload jsonb)
language sql stable security definer set search_path='' as $$
  select c.key,c.payload from public.bedaya_catalog c where auth.uid() is not null and c.kind='slot' and (c.payload->>'starts_at')::timestamptz>now() and not exists(select 1 from public.bedaya_bookings b where b.slot_key=c.key and b.status='booked') order by c.payload->>'starts_at';
$$;
create or replace function public.bedaya_set_member(p_user uuid,p_role text,p_partner text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if not public.bedaya_is_admin() then raise insufficient_privilege; end if;
  if p_role not in ('admin','partner') then raise exception 'Invalid role'; end if;
  if p_role='partner' and not exists(select 1 from public.bedaya_catalog where key=p_partner and kind='partner') then raise exception 'Unknown partner'; end if;
  if p_user=auth.uid() and p_role<>'admin' and (select count(*) from public.bedaya_members where role='admin')<=1 then raise exception 'Cannot remove last admin'; end if;
  insert into public.bedaya_members(user_id,role,partner_key) values(p_user,p_role,case when p_role='partner' then p_partner else null end) on conflict(user_id) do update set role=excluded.role,partner_key=excluded.partner_key;
  insert into public.bedaya_audit(user_id,event,details) values(auth.uid(),'admin_role_change',jsonb_build_object('userId',p_user,'role',p_role,'partner',p_partner));
end $$;
revoke all on function public.bedaya_available_slots(),public.bedaya_set_member(uuid,text,text) from public,anon;
grant execute on function public.bedaya_available_slots(),public.bedaya_set_member(uuid,text,text) to authenticated;
revoke all on function public.bedaya_submit(bigint,jsonb),public.bedaya_update_task(uuid,text),public.bedaya_book(bigint,text),public.bedaya_cancel_booking(uuid) from public,anon;
grant execute on function public.bedaya_submit(bigint,jsonb),public.bedaya_update_task(uuid,text),public.bedaya_book(bigint,text),public.bedaya_cancel_booking(uuid) to authenticated;

create unique index if not exists bedaya_documents_id_owner_idx on public.bedaya_documents(id,user_id);
create table if not exists public.bedaya_signatures (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 document_id uuid not null, signed_document_id uuid not null, signer_name text not null,
 provider text not null default 'mock' check(provider='mock'), signed_at timestamptz not null default now(),
 foreign key(document_id,user_id) references public.bedaya_documents(id,user_id),
 foreign key(signed_document_id,user_id) references public.bedaya_documents(id,user_id),
 unique(document_id)
);
create table if not exists public.bedaya_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 channel text not null default 'in_app' check(channel='in_app'), type text not null,
 title_ar text not null, title_en text not null, body_ar text not null, body_en text not null,
 read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.bedaya_consents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 purpose text not null check(purpose in ('ocr_processing','ai_assistant','incubator_share','e_signature','mock_identity')),
 granted boolean not null, consent_text_version text not null default 'v1', created_at timestamptz not null default now()
);
alter table public.bedaya_signatures enable row level security;
alter table public.bedaya_notifications enable row level security;
alter table public.bedaya_consents enable row level security;
revoke all on public.bedaya_signatures,public.bedaya_notifications,public.bedaya_consents from anon,authenticated;
grant select,insert on public.bedaya_signatures,public.bedaya_consents to authenticated;
grant select on public.bedaya_notifications to authenticated;
grant update(read_at) on public.bedaya_notifications to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='bedaya_signatures') then
  create policy signatures_owner on public.bedaya_signatures for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
  create policy notifications_owner on public.bedaya_notifications for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
  create policy consents_owner on public.bedaya_consents for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
 end if;
end $$;
create or replace function public.bedaya_notify_task() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.status='done' and old.status<>'done' then
  insert into public.bedaya_notifications(user_id,type,title_ar,title_en,body_ar,body_en) values(new.user_id,'step_done','اكتملت خطوة','Step completed',new.title_ar,new.title_en);
 end if;
 return new;
end $$;
revoke all on function public.bedaya_notify_task() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='bedaya_task_notification') then
  create trigger bedaya_task_notification after update on public.bedaya_tasks for each row execute function public.bedaya_notify_task();
 end if;
end $$;

create or replace function public.bedaya_shared_document(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bedaya_documents d join public.bedaya_applications a on a.business_id=d.business_id and a.user_id=d.user_id
 where d.storage_path=p_path and d.status='ready' and a.consent and (a.payload->'documentIds') ? d.id::text and public.bedaya_is_partner(a.partner_key));
$$;
revoke all on function public.bedaya_shared_document(text) from public,anon;
grant execute on function public.bedaya_shared_document(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bedaya-vault','bedaya-vault',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and policyname='bedaya_vault_owner') then
    create policy bedaya_vault_owner on storage.objects for all to authenticated using(bucket_id='bedaya-vault' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='bedaya-vault' and (storage.foldername(name))[1]=(select auth.uid())::text);
    create policy bedaya_vault_partner_read on storage.objects for select to authenticated using(bucket_id='bedaya-vault' and public.bedaya_shared_document(name));
    create policy bedaya_vault_guard on storage.objects as restrictive for all to authenticated using(bucket_id<>'bedaya-vault' or (storage.foldername(name))[1]=(select auth.uid())::text or public.bedaya_shared_document(name)) with check(bucket_id<>'bedaya-vault' or (storage.foldername(name))[1]=(select auth.uid())::text);
    create policy bedaya_vault_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'bedaya-vault') with check(bucket_id<>'bedaya-vault');
  end if;
end $$;
commit;
