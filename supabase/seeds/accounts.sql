-- Demo accounts: one per party, plus a second business owner (to test that accounts stay separate).
-- FICTIONAL people and @example.com emails. Passwords are listed in the README, never on screen.
-- Run after the migrations and supabase/seeds/team.sql. Safe to re-run: existing emails are kept.
begin;

create or replace function pg_temp.bedaya_demo_user(p_email text, p_password text) returns uuid
language plpgsql as $$
declare uid uuid; begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  return uid;
end $$;

do $$
declare layla uuid; omar uuid; bank uuid; incubator uuid; sara uuid; khalil uuid; rana uuid; admin uuid;
begin
  layla := pg_temp.bedaya_demo_user('layla.demo@example.com', 'Layla2026!');
  omar := pg_temp.bedaya_demo_user('omar.demo@example.com', 'Omar2026!');
  bank := pg_temp.bedaya_demo_user('bank.demo@example.com', 'Bank2026!');
  incubator := pg_temp.bedaya_demo_user('incubator.demo@example.com', 'Incubator2026!');
  sara := pg_temp.bedaya_demo_user('expert.demo@example.com', 'Expert2026!');
  khalil := pg_temp.bedaya_demo_user('expert2.demo@example.com', 'Expert2026!');
  rana := pg_temp.bedaya_demo_user('expert3.demo@example.com', 'Expert2026!');
  admin := pg_temp.bedaya_demo_user('admin.demo@example.com', 'Admin2026!');

  -- Business owners are linked to their (mock) SANAD identity by national ID.
  insert into public.bedaya_identities (user_id, national_id, verified) values
    (layla, '9990000001', '{"fullNameAr":{"value":"ليلى محمود أحمد","source":"verified_by_sanad"},"fullNameEn":{"value":"Layla Mahmoud Ahmad","source":"verified_by_sanad"},"birthDate":{"value":"1995-03-14","source":"verified_by_sanad"},"gender":{"value":"F","source":"verified_by_sanad"},"phone":{"value":"+962790000001","source":"verified_by_sanad"},"email":{"value":"layla.demo@example.com","source":"verified_by_sanad"},"city":{"value":"إربد","source":"verified_by_sanad"},"address":{"value":"إربد، حي النزهة، شارع 12، بناية 7","source":"verified_by_sanad"}}'),
    (omar, '9990000002', '{"fullNameAr":{"value":"عمر خالد يوسف","source":"verified_by_sanad"},"fullNameEn":{"value":"Omar Khaled Yousef","source":"verified_by_sanad"},"birthDate":{"value":"1990-11-02","source":"verified_by_sanad"},"gender":{"value":"M","source":"verified_by_sanad"},"phone":{"value":"+962790000002","source":"verified_by_sanad"},"email":{"value":"omar.demo@example.com","source":"verified_by_sanad"},"city":{"value":"عمّان","source":"verified_by_sanad"},"address":{"value":"عمّان، الشميساني، شارع 5، بناية 21","source":"verified_by_sanad"}}')
  on conflict do nothing;

  -- Experts (fictional) and their accounts.
  insert into public.bedaya_experts (key, user_id, name_ar, name_en, title_ar, title_en, fee_jod) values
    ('sara-ali', sara, 'سارة علي', 'Sara Ali', 'محاسبة · التسجيل الضريبي والضمان', 'Accountant · tax and social security registration', 25),
    ('omar-khalil', khalil, 'عمر خليل', 'Omar Khalil', 'مستشار قانوني · تسجيل الشركات والعقود', 'Legal advisor · company registration and contracts', 35),
    ('rana-masri', rana, 'رنا المصري', 'Rana Masri', 'مستشارة سلامة غذاء · التحضير لزيارة الغذاء والدواء', 'Food-safety consultant · JFDA inspection preparation', 30)
  on conflict (key) do update set user_id = excluded.user_id;

  insert into public.bedaya_members (user_id, role, partner_key) values
    (bank, 'partner', 'bank-demo'),
    (incubator, 'partner', 'jedco_hbb'),
    (sara, 'expert', null), (khalil, 'expert', null), (rana, 'expert', null),
    (admin, 'admin', null)
  on conflict (user_id) do update set role = excluded.role, partner_key = excluded.partner_key;

  -- Each expert's own availability for the next week (Amman time); experts edit it from their dashboard.
  insert into public.bedaya_expert_slots (expert_key, starts_at, duration_minutes)
  select e.key, (date_trunc('day', now() at time zone 'Asia/Amman') + make_interval(days => d) + make_interval(hours => h)) at time zone 'Asia/Amman', 45
    from (values ('sara-ali', 10), ('sara-ali', 13), ('omar-khalil', 11), ('omar-khalil', 15), ('rana-masri', 9), ('rana-masri', 12)) as e(key, h)
    cross join generate_series(1, 6) as d
  on conflict (expert_key, starts_at) do nothing;
end $$;

commit;
