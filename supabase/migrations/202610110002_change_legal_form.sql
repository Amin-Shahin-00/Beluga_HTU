-- Bedaya: the owner can change the legal structure chosen in onboarding (Saad's "legal structure" step).
-- The roadmap is rebuilt from the official rules for the new structure. Refused once any step is done,
-- so real progress is never lost. Apply after 202610110001_assistant_chats.sql. Idempotent.
begin;

create or replace function public.bedaya_change_legal_form(p_business bigint, p_legal_form text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); answers jsonb; begin
  if uid is null or not exists (select 1 from public.businesses where id = p_business and user_id = uid) then raise insufficient_privilege; end if;
  if p_legal_form not in ('home_business', 'sole_proprietorship', 'llc') then raise exception 'Invalid legal form'; end if;
  if exists (select 1 from public.bedaya_tasks where business_id = p_business and status = 'done') then
    raise exception 'Steps already completed' using hint = 'The structure can only change before any step is done.';
  end if;
  select p.answers into answers from public.bedaya_profiles p where p.business_id = p_business and p.user_id = uid for update;
  if answers is null then raise exception 'No profile'; end if;
  answers := jsonb_set(answers, '{business,legalForm}', to_jsonb(p_legal_form));
  answers := jsonb_set(answers, '{business,homeBased}', to_jsonb(p_legal_form = 'home_business'));
  delete from public.bedaya_tasks where business_id = p_business and user_id = uid;
  perform public.bedaya_submit(p_business, answers);
  insert into public.bedaya_audit(user_id, event, details) values (uid, 'legal_form_changed', jsonb_build_object('businessId', p_business, 'legalForm', p_legal_form));
end $$;

revoke all on function public.bedaya_change_legal_form(bigint, text) from public, anon;
grant execute on function public.bedaya_change_legal_form(bigint, text) to authenticated;

commit;
