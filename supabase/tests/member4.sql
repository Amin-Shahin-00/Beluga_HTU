-- Test fixture changes stay inside this transaction and are rolled back.
begin;
do $$ declare uid uuid; bid bigint; begin
 select id into uid from auth.users order by created_at limit 1;
 if uid is null then raise exception 'Needs one existing confirmed test account'; end if;
 perform set_config('bedaya.test_owner',uid::text,true);
 insert into public.businesses(name,type,city,user_id) values('M4 transactional test','Test','Amman',uid) returning id into bid;
 perform set_config('bedaya.test_business',bid::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bedaya.test_owner'),'role','authenticated')::text,true);
select public.bedaya_submit(current_setting('bedaya.test_business')::bigint,'{"language":"ar","personal":{"fullNameAr":"ليلى أحمد محمود الخطيب","fullNameEn":"Layla Ahmad Mahmoud Al-Khatib","nationalId":"","birthDate":"1999-03-14","gender":"female","phone":"+962790000001","email":"layla@example.test","city":"Amman"},"business":{"nameAr":"حلويات ليلى","nameEn":"Layla''s Sweets","sector":"food","description":"Homemade Jordanian sweets (maamoul, knafeh trays) sold by pre-order on Instagram and WhatsApp.","descriptionAr":"حلويات أردنية منزلية (معمول وصواني كنافة) تُباع بالطلب المسبق عبر إنستغرام وواتساب.","legalForm":"home_business","homeBased":true,"premises":"rented","stage":"prototype","employeesPlanned":1,"wantsTradeName":true,"startupCapitalJod":1500,"fundingNeededJod":5000,"targetCustomers":"Families and offices in West Amman ordering for Eid, weddings and events.","targetCustomersAr":"العائلات والمكاتب في غرب عمّان التي تطلب للأعياد والأعراس والمناسبات.","plannedLaunch":"2026-12"}}'::jsonb);
do $$ declare first_task uuid; last_task uuid; slot text; booking uuid; begin
 if (select count(*) from public.bedaya_tasks where business_id=current_setting('bedaya.test_business')::bigint)<>9 then raise exception 'Expected 9 Layla steps'; end if;
 select id into first_task from public.bedaya_tasks where business_id=current_setting('bedaya.test_business')::bigint and cardinality(dependencies)=0;
 select id into last_task from public.bedaya_tasks where business_id=current_setting('bedaya.test_business')::bigint and step_key='social_security';
 begin perform public.bedaya_update_task(last_task,'done');raise exception 'Locked step was allowed';exception when raise_exception then if SQLERRM='Locked step was allowed' then raise;end if;end;
 perform public.bedaya_update_task(first_task,'done');
 if not exists(select 1 from public.bedaya_tasks where id=first_task and status='done') then raise exception 'Owner progress failed';end if;
 if not exists(select 1 from public.bedaya_notifications where user_id=auth.uid() and type='step_done') then raise exception 'Notification trigger failed';end if;
 perform set_config('bedaya.test_task',first_task::text,true);
 select key into slot from public.bedaya_available_slots() limit 1;
 if slot is null then raise exception 'No future demo slot available';end if;
 booking:=public.bedaya_book(current_setting('bedaya.test_business')::bigint,slot);
 begin perform public.bedaya_book(current_setting('bedaya.test_business')::bigint,slot);raise exception 'Double booking was allowed';exception when unique_violation then null;end;
 perform public.bedaya_cancel_booking(booking);
 if not exists(select 1 from public.bedaya_available_slots() where key=slot) then raise exception 'Cancellation did not release slot';end if;
 begin perform public.bedaya_submit(current_setting('bedaya.test_business')::bigint,'{"language":"ar","personal":{"fullNameAr":"ليلى أحمد محمود الخطيب","fullNameEn":"Layla Ahmad Mahmoud Al-Khatib","nationalId":"","birthDate":"1999-03-14","gender":"female","phone":"+962790000001","email":"layla@example.test","city":"Amman"},"business":{"nameAr":"حلويات ليلى","nameEn":"Layla''s Sweets","sector":"food","description":"Homemade Jordanian sweets (maamoul, knafeh trays) sold by pre-order on Instagram and WhatsApp.","descriptionAr":"حلويات أردنية منزلية (معمول وصواني كنافة) تُباع بالطلب المسبق عبر إنستغرام وواتساب.","legalForm":"home_business","homeBased":true,"premises":"rented","stage":"prototype","employeesPlanned":1,"wantsTradeName":true,"startupCapitalJod":1500,"fundingNeededJod":5000,"targetCustomers":"Families and offices in West Amman ordering for Eid, weddings and events.","targetCustomersAr":"العائلات والمكاتب في غرب عمّان التي تطلب للأعياد والأعراس والمناسبات.","plannedLaunch":"2026-12"}}'::jsonb);raise exception 'Repeated submission was allowed';exception when raise_exception then if SQLERRM='Repeated submission was allowed' then raise;end if;end;
 begin perform public.bedaya_set_member(auth.uid(),'admin',null);raise exception 'Owner could self-promote';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.bedaya_tasks where business_id=current_setting('bedaya.test_business')::bigint) then raise exception 'Cross-user task leak';end if;
 if exists(select 1 from public.bedaya_profiles where business_id=current_setting('bedaya.test_business')::bigint) then raise exception 'Cross-user profile leak';end if;
 begin perform public.bedaya_update_task(current_setting('bedaya.test_task')::uuid,'pending');raise exception 'Cross-user task mutation allowed';exception when insufficient_privilege then null;end;
 begin perform public.bedaya_book(current_setting('bedaya.test_business')::bigint,'slot-demo-1');raise exception 'Cross-user booking allowed';exception when insufficient_privilege then null;end;
 begin insert into public.bedaya_profiles(business_id,user_id,answers) values(current_setting('bedaya.test_business')::bigint,current_setting('bedaya.test_owner')::uuid,'{}');raise exception 'Forged profile ownership allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform id from public.bedaya_tasks;raise exception 'Anonymous tasks allowed';exception when insufficient_privilege then null;end;
 begin perform public.bedaya_submit(current_setting('bedaya.test_business')::bigint,'{"language":"ar","personal":{"fullNameAr":"ليلى أحمد محمود الخطيب","fullNameEn":"Layla Ahmad Mahmoud Al-Khatib","nationalId":"","birthDate":"1999-03-14","gender":"female","phone":"+962790000001","email":"layla@example.test","city":"Amman"},"business":{"nameAr":"حلويات ليلى","nameEn":"Layla''s Sweets","sector":"food","description":"Homemade Jordanian sweets (maamoul, knafeh trays) sold by pre-order on Instagram and WhatsApp.","descriptionAr":"حلويات أردنية منزلية (معمول وصواني كنافة) تُباع بالطلب المسبق عبر إنستغرام وواتساب.","legalForm":"home_business","homeBased":true,"premises":"rented","stage":"prototype","employeesPlanned":1,"wantsTradeName":true,"startupCapitalJod":1500,"fundingNeededJod":5000,"targetCustomers":"Families and offices in West Amman ordering for Eid, weddings and events.","targetCustomersAr":"العائلات والمكاتب في غرب عمّان التي تطلب للأعياد والأعراس والمناسبات.","plannedLaunch":"2026-12"}}'::jsonb);raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: sourced roadmap, prerequisites, owner progress, notifications, duplicate submission rejection, booking/cancellation, cross-user isolation, anonymous rejection, and no self-promotion' as verification;
rollback;
