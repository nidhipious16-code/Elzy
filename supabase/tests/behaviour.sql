-- Behaviour tests for the CRM schema. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP 1
create or replace function pg_temp.act_as(u uuid) returns void language sql as
$$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false) $$;
create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(ok, false) then raise exception 'FAILED: %', msg; end if; raise notice 'ok: %', msg; end $$;

-- seed (as superuser)
insert into teams (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'North'),
  ('00000000-0000-0000-0000-0000000000a2', 'South');
insert into regions (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Kerala');
insert into auth.users (id) select ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 7) n;
insert into profiles (id, full_name, phone, team_id, capacity) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', '+910000000001', null, 30),
  ('00000000-0000-0000-0000-000000000002', 'Manager North', '+910000000002', '00000000-0000-0000-0000-0000000000a1', 30),
  ('00000000-0000-0000-0000-000000000003', 'Rep A', '+910000000003', '00000000-0000-0000-0000-0000000000a1', 2),
  ('00000000-0000-0000-0000-000000000004', 'Rep B', '+910000000004', '00000000-0000-0000-0000-0000000000a1', 4),
  ('00000000-0000-0000-0000-000000000005', 'Rep South', '+910000000005', '00000000-0000-0000-0000-0000000000a2', 10),
  ('00000000-0000-0000-0000-000000000006', 'Demo Mgr', '+910000000006', null, 30),
  ('00000000-0000-0000-0000-000000000007', 'Caller', '+910000000007', '00000000-0000-0000-0000-0000000000a1', 5);
update profiles set is_available = false where full_name = 'Caller';
insert into user_roles values
  ('00000000-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'sales_manager'),
  ('00000000-0000-0000-0000-000000000003', 'sales_person'),
  ('00000000-0000-0000-0000-000000000004', 'sales_person'),
  ('00000000-0000-0000-0000-000000000005', 'sales_person'),
  ('00000000-0000-0000-0000-000000000006', 'demo_manager'),
  ('00000000-0000-0000-0000-000000000007', 'call_executive');

set role authenticated;

-- 1. auto-assign by bandwidth within the North team
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
insert into leads (full_name, phone, team_id, source)
select 'Lead ' || n, '+9199000000' || lpad(n::text, 2, '0'), '00000000-0000-0000-0000-0000000000a1', 'manual'
from generate_series(1, 6) n;
select pg_temp.check((select count(*) from leads where assigned_to = '00000000-0000-0000-0000-000000000003') = 2, 'Rep A (capacity 2) gets 2 leads');
select pg_temp.check((select count(*) from leads where assigned_to = '00000000-0000-0000-0000-000000000004') = 4, 'Rep B (capacity 4) gets 4 leads');
select pg_temp.check((select count(*) from leads where assigned_to = '00000000-0000-0000-0000-000000000007') = 0, 'unavailable caller gets none');

-- 7th lead: everyone in North is full, so it stays unassigned and managers are told
insert into leads (full_name, phone, team_id) values ('Overflow', '+919900000099', '00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select assigned_to is null from leads where full_name = 'Overflow'), 'overflow lead stays unassigned');

-- 2. RLS: a rep only sees their own leads; another team's rep sees none
select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from leads) = 2, 'Rep A sees only their 2 leads');
select pg_temp.check((select count(*) from tasks where kind = 'follow_up') = 2, 'Rep A has a call task per new lead');
select pg_temp.check((select count(*) from notifications) = 2, 'Rep A got 2 assignment notifications');
select pg_temp.act_as('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from leads) = 0, 'South rep sees no North leads');
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from leads) = 7, 'North manager sees all 7 team leads');
select pg_temp.check((select count(*) from notifications where title = 'Lead could not be assigned') = 1, 'manager told about overflow');

-- 3. rep cannot reassign, can move status; converted needs a value
select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
do $$ begin
  update leads set assigned_to = '00000000-0000-0000-0000-000000000004' where full_name = 'Lead 1' or full_name = 'Lead 2';
  raise exception 'FAILED: rep reassigned a lead';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: rep cannot reassign (%)', sqlerrm;
end $$;

create temp table my_lead as select id from leads order by full_name limit 1;
update leads set status = 'not_responsive' where id = (select id from my_lead);
select pg_temp.check((select count(*) from tasks where lead_id = (select id from my_lead) and done_at is null) = 1, 'not responsive: one open retry task');
select pg_temp.check((select title from tasks where lead_id = (select id from my_lead) and done_at is null) = 'Try calling again', 'retry task title');

-- complete the retry task 3 times: attempts reach max, manager alerted
update tasks set done_at = now() where lead_id = (select id from my_lead) and done_at is null;
update tasks set done_at = now() where lead_id = (select id from my_lead) and done_at is null;
update tasks set done_at = now() where lead_id = (select id from my_lead) and done_at is null;
select pg_temp.check((select follow_up_attempts from leads where id = (select id from my_lead)) = 3, 'three attempts counted');
select pg_temp.check((select count(*) from tasks where lead_id = (select id from my_lead) and done_at is null) = 0, 'no more retries after max');

do $$ begin
  update leads set status = 'converted' where id = (select id from my_lead);
  raise exception 'FAILED: converted without value';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: converted needs a value (%)', sqlerrm;
end $$;

update leads set status = 'demo_agreed' where id = (select id from my_lead);
select pg_temp.act_as('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from leads) = 1, 'demo manager sees the demo_agreed lead');
select pg_temp.check((select count(*) from notifications where title = 'Demo to arrange') = 1, 'demo manager notified');
update leads set status = 'demo_scheduled', demo_at = now() + interval '3 days', demo_manager_id = auth.uid() where id = (select id from my_lead);
select pg_temp.check((select count(*) from tasks where kind = 'demo_reminder') = 1, 'demo manager has a reminder');
update leads set status = 'demo_done' where id = (select id from my_lead);

select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
update leads set status = 'converted', deal_value = 50000 where id = (select id from my_lead);
select pg_temp.check((select is_closed and closed_at is not null from leads where id = (select id from my_lead)), 'converted lead is closed');
select pg_temp.check((select count(*) from tasks where lead_id = (select id from my_lead) and done_at is null) = 0, 'no open reminders on a closed lead');
do $$ begin
  update leads set status = 'new' where id = (select id from my_lead);
  raise exception 'FAILED: rep reopened a closed lead';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: rep cannot reopen (%)', sqlerrm;
end $$;

-- 4. dashboard respects RLS and filters
select pg_temp.check((dashboard_stats() ->> 'total')::int = 2, 'rep dashboard counts own leads');
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select pg_temp.check((dashboard_stats() ->> 'revenue')::numeric = 50000, 'manager dashboard revenue');
select pg_temp.check((dashboard_stats(p_status => 'new') ->> 'total')::int = 6, 'status filter');
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select pg_temp.check((dashboard_stats(p_team => '00000000-0000-0000-0000-0000000000a2') ->> 'total')::int = 0, 'team filter');

-- 5. capacity frees up -> cron retry assigns the overflow lead
reset role;
select run_followup_checks();
select pg_temp.check((select assigned_to is not null from leads where full_name = 'Overflow'), 'overflow lead assigned once capacity freed');

-- 6. privacy erase
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
do $$ begin
  perform erase_lead_personal_data((select id from my_lead));
  raise exception 'FAILED: rep erased data';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: only admin erases (%)', sqlerrm;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select erase_lead_personal_data((select id from my_lead));
select pg_temp.check((select phone is null and full_name = 'Erased customer' from leads where id = (select id from my_lead)), 'personal data erased');
select pg_temp.check((select bool_and(details = '{"erased": true}' or action = 'erase_personal_data') from audit_log where entity = 'leads' and entity_id = (select id::text from my_lead)), 'audit copies scrubbed');

-- 7. anon sees nothing
reset role;
set role anon;
do $$ begin
  perform count(*) from leads;
  raise exception 'FAILED: anon read leads';
exception when insufficient_privilege then raise notice 'ok: anon blocked';
end $$;
reset role;
\echo ALL TESTS PASSED
