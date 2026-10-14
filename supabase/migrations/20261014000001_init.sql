-- Elzy: initial schema
-- Teams, users and roles, leads, the lead workflow, auto-assignment, follow-ups,
-- targets, notifications and the audit log. Every table uses row-level security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'admin', 'sales_manager', 'sales_person', 'call_executive', 'demo_manager'
);

create type public.lead_source as enum (
  'facebook', 'instagram', 'whatsapp', 'website', 'call', 'manual', 'import'
);

create type public.lead_status as enum (
  'new',
  'responsive',
  'not_responsive',
  'demo_agreed',
  'demo_scheduled',
  'demo_done',
  'converted',
  'declined'
);

create type public.activity_type as enum (
  'created', 'status_change', 'note', 'call', 'assignment', 'follow_up', 'demo'
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null unique,
  team_id uuid references public.teams (id) on delete set null,
  -- null region means the person can take leads from any region
  region_id uuid references public.regions (id) on delete set null,
  -- maximum number of open leads this person should hold at once
  capacity integer not null default 30 check (capacity > 0),
  is_available boolean not null default true,
  is_active boolean not null default true,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(r public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = r and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role('admin'); $$;

create or replace function public.my_team()
returns uuid
language sql stable security definer set search_path = public
as $$ select team_id from public.profiles where id = auth.uid(); $$;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  source public.lead_source not null default 'manual',
  campaign text,
  product_id uuid references public.products (id) on delete set null,
  region_id uuid references public.regions (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  status public.lead_status not null default 'new',
  is_closed boolean generated always as (status in ('converted', 'declined')) stored,
  deal_value numeric(14, 2) check (deal_value is null or deal_value >= 0),
  decline_reason text,
  demo_at timestamptz,
  demo_manager_id uuid references public.profiles (id) on delete set null,
  follow_up_attempts integer not null default 0,
  -- privacy: how and when the customer agreed to be contacted
  consent_given boolean not null default false,
  consent_note text,
  notes text,
  external_id text, -- id from Meta / website, used to ignore duplicate webhooks
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint lead_has_contact check (phone is not null or email is not null)
);

create unique index leads_external_id_key on public.leads (source, external_id)
  where external_id is not null;
create index leads_phone_idx on public.leads (phone);
create index leads_assigned_idx on public.leads (assigned_to) where not is_closed;
create index leads_team_idx on public.leads (team_id);
create index leads_status_idx on public.leads (status);
create index leads_created_idx on public.leads (created_at);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type public.activity_type not null,
  from_status public.lead_status,
  to_status public.lead_status,
  body text,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  kind text not null default 'manual' check (kind in ('manual', 'follow_up', 'demo_reminder')),
  due_at timestamptz not null,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_open_idx on public.tasks (assigned_to, due_at) where done_at is null;

-- Auto follow-up rules: when a lead enters `status`, create a task after `delay_hours`.
-- When a lead has been followed up `max_attempts` times, its manager is alerted.
create table public.followup_rules (
  id uuid primary key default gen_random_uuid(),
  status public.lead_status not null unique,
  delay_hours integer not null check (delay_hours >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  task_title text not null,
  is_active boolean not null default true
);

create table public.app_settings (
  id boolean primary key default true check (id), -- single row
  stale_lead_days integer not null default 3 check (stale_lead_days > 0),
  demo_reminder_hours integer not null default 24 check (demo_reminder_hours >= 0)
);
insert into public.app_settings default values;

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  user_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  revenue_target numeric(14, 2) not null default 0 check (revenue_target >= 0),
  conversion_target integer not null default 0 check (conversion_target >= 0),
  constraint target_owner check ((user_id is null) <> (team_id is null))
);
create unique index targets_user_month_key on public.targets (user_id, month) where user_id is not null;
create unique index targets_team_month_key on public.targets (team_id, month) where team_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Keys used by the website form / external systems to post leads.
-- Only a SHA-256 hash of the key is stored.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Visibility helper for leads
-- ---------------------------------------------------------------------------
create or replace function public.can_see_lead(l public.leads)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin()
    or l.assigned_to = auth.uid()
    or l.demo_manager_id = auth.uid()
    or (public.has_role('sales_manager') and l.team_id is not distinct from public.my_team())
    or (public.has_role('demo_manager')
        and l.status in ('demo_agreed', 'demo_scheduled', 'demo_done')
        and (public.my_team() is null or l.team_id is not distinct from public.my_team()));
$$;

create or replace function public.can_manage_lead(l public.leads)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or (public.has_role('sales_manager') and l.team_id is not distinct from public.my_team());
$$;

-- ---------------------------------------------------------------------------
-- Auto-assignment by bandwidth
-- Picks the available, active sales person or call executive (same team and
-- region when the lead has them) with the lowest open-leads / capacity ratio.
-- Ties go to whoever was assigned least recently (round robin).
-- ---------------------------------------------------------------------------
create or replace function public.pick_assignee(p_team uuid, p_region uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.id
  from public.profiles p
  left join lateral (
    select count(*) as open_leads
    from public.leads l
    where l.assigned_to = p.id and not l.is_closed
  ) load on true
  where p.is_active
    and p.is_available
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.role in ('sales_person', 'call_executive')
    )
    and (p_team is null or p.team_id = p_team)
    and (p_region is null or p.region_id is null or p.region_id = p_region)
    and load.open_leads < p.capacity
  order by (load.open_leads::numeric / p.capacity) asc,
           p.last_assigned_at asc nulls first,
           p.id
  limit 1;
$$;

create or replace function public.leads_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  if new.assigned_to is null then
    -- serialise auto-assignment so two leads at the same moment don't both
    -- go to the same "least loaded" person
    perform pg_advisory_xact_lock(hashtext('crm_lead_assignment'));
    new.assigned_to := public.pick_assignee(new.team_id, new.region_id);
  end if;
  if new.team_id is null and new.assigned_to is not null then
    select team_id into new.team_id from public.profiles where id = new.assigned_to;
  end if;
  return new;
end;
$$;

create trigger leads_before_insert
before insert on public.leads
for each row execute function public.leads_before_insert();

-- ---------------------------------------------------------------------------
-- Follow-ups and notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_lead uuid, p_title text, p_body text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, lead_id, title, body)
  select p_user, p_lead, p_title, p_body where p_user is not null;
$$;

create or replace function public.notify_managers(p_team uuid, p_lead uuid, p_title text, p_body text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, lead_id, title, body)
  select distinct p.id, p_lead, p_title, p_body
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where p.is_active
    and (
      (ur.role = 'sales_manager' and p.team_id is not distinct from p_team)
      or (ur.role = 'admin' and p_team is null)
    );
$$;

-- Applies the follow-up rule for the lead's current status.
create or replace function public.schedule_followup(l public.leads)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.followup_rules;
begin
  if l.is_closed or l.assigned_to is null then
    return;
  end if;
  select * into r from public.followup_rules where status = l.status and is_active;
  if not found then
    return;
  end if;
  if l.follow_up_attempts >= r.max_attempts then
    perform public.notify_managers(l.team_id, l.id,
      'Lead needs attention',
      format('%s has been followed up %s times without progress.', l.full_name, l.follow_up_attempts));
    return;
  end if;
  insert into public.tasks (lead_id, assigned_to, title, kind, due_at)
  values (l.id, l.assigned_to, r.task_title, 'follow_up', now() + make_interval(hours => r.delay_hours));
end;
$$;

create or replace function public.leads_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.lead_activities (lead_id, actor_id, type, to_status, body)
  values (new.id, new.created_by, 'created', new.status, 'Lead added from ' || new.source);
  if new.assigned_to is not null then
    insert into public.lead_activities (lead_id, actor_id, type, body)
    values (new.id, new.created_by, 'assignment',
            'Assigned to ' || (select full_name from public.profiles where id = new.assigned_to));
    update public.profiles set last_assigned_at = now() where id = new.assigned_to;
    perform public.notify(new.assigned_to, new.id, 'New lead assigned', new.full_name);
  else
    perform public.notify_managers(new.team_id, new.id, 'Lead could not be assigned',
      new.full_name || ' is waiting: nobody available has free capacity.');
  end if;
  perform public.schedule_followup(new);
  return new;
end;
$$;

create trigger leads_after_insert
after insert on public.leads
for each row execute function public.leads_after_insert();

-- Guards fields per role, stamps timestamps and records closures.
create or replace function public.leads_before_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  manager boolean := public.can_manage_lead(old);
begin
  if auth.uid() is not null and not manager then
    if new.assigned_to is distinct from old.assigned_to
       or new.team_id is distinct from old.team_id then
      raise exception 'Only a manager or admin can reassign a lead';
    end if;
    if old.is_closed then
      raise exception 'This lead is closed. Ask a manager to reopen it.';
    end if;
  end if;

  if new.status = 'converted' and new.deal_value is null then
    raise exception 'Enter the deal value to mark a lead as converted';
  end if;
  if new.status = 'declined' and coalesce(btrim(new.decline_reason), '') = '' then
    raise exception 'Enter a reason to mark a lead as declined';
  end if;
  if new.status = 'demo_scheduled' and new.demo_at is null then
    raise exception 'Pick a demo date and time';
  end if;

  if new.status is distinct from old.status then
    new.closed_at := case when new.status in ('converted', 'declined') then now() end;
    -- attempts count follow-ups at the current stage, so a new stage starts again
    new.follow_up_attempts := 0;
  end if;

  new.updated_at := now();
  new.last_activity_at := now();
  return new;
end;
$$;

create trigger leads_before_update
before update on public.leads
for each row execute function public.leads_before_update();

create or replace function public.leads_after_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  settings public.app_settings;
begin
  select * into settings from public.app_settings;

  if new.status is distinct from old.status then
    insert into public.lead_activities (lead_id, actor_id, type, from_status, to_status)
    values (new.id, auth.uid(), 'status_change', old.status, new.status);

    -- open follow-ups from the previous stage are no longer relevant, and a
    -- closed lead needs no reminders at all
    update public.tasks set done_at = now()
    where lead_id = new.id and done_at is null
      and (kind = 'follow_up' or new.status in ('converted', 'declined'));

    perform public.schedule_followup(new);

    if new.status = 'demo_agreed' then
      -- every demo manager for this team (or with no team) hears about it
      insert into public.notifications (user_id, lead_id, title, body)
      select distinct p.id, new.id, 'Demo to arrange', new.full_name
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'demo_manager'
      where p.is_active and (p.team_id is null or p.team_id is not distinct from new.team_id);
    end if;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_activities (lead_id, actor_id, type, body)
    values (new.id, auth.uid(), 'assignment',
            'Reassigned to ' || coalesce((select full_name from public.profiles where id = new.assigned_to), 'nobody'));
    update public.tasks set assigned_to = new.assigned_to
    where lead_id = new.id and done_at is null and assigned_to = old.assigned_to and new.assigned_to is not null;
    perform public.notify(new.assigned_to, new.id, 'Lead assigned to you', new.full_name);
  end if;

  if new.demo_at is distinct from old.demo_at and new.demo_at is not null then
    insert into public.lead_activities (lead_id, actor_id, type, body)
    values (new.id, auth.uid(), 'demo', 'Demo set for ' || to_char(new.demo_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') || ' IST');
    -- a rescheduled demo replaces any earlier reminder
    update public.tasks set done_at = now()
    where lead_id = new.id and kind = 'demo_reminder' and done_at is null;
    insert into public.tasks (lead_id, assigned_to, title, kind, due_at)
    select new.id, u, 'Demo reminder: ' || new.full_name, 'demo_reminder',
           greatest(now(), new.demo_at - make_interval(hours => settings.demo_reminder_hours))
    from unnest(array[new.assigned_to, new.demo_manager_id]) as u
    where u is not null
    group by u;
  end if;

  return new;
end;
$$;

create trigger leads_after_update
after update on public.leads
for each row execute function public.leads_after_update();

-- When a follow-up task is completed without the status moving on,
-- count the attempt and schedule the next one.
create or replace function public.tasks_after_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  l public.leads;
begin
  if new.kind = 'follow_up' and old.done_at is null and new.done_at is not null and new.lead_id is not null then
    -- a status change closes old follow-ups itself; only count manual completions
    if pg_trigger_depth() > 1 then
      return new;
    end if;
    update public.leads
    set follow_up_attempts = follow_up_attempts + 1, last_activity_at = now()
    where id = new.lead_id and not is_closed
    returning * into l;
    if found then
      insert into public.lead_activities (lead_id, actor_id, type, body)
      values (l.id, auth.uid(), 'follow_up', 'Follow-up done: ' || new.title);
      perform public.schedule_followup(l);
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_after_update
after update on public.tasks
for each row execute function public.tasks_after_update();

-- Run every hour from pg_cron: alert on overdue tasks and leads with no activity.
create or replace function public.run_followup_checks()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  settings public.app_settings;
begin
  select * into settings from public.app_settings;

  -- overdue tasks: one reminder per task per day
  insert into public.notifications (user_id, lead_id, title, body)
  select t.assigned_to, t.lead_id, 'Follow-up overdue', t.title
  from public.tasks t
  where t.done_at is null
    and t.due_at < now()
    and not exists (
      select 1 from public.notifications n
      where n.user_id = t.assigned_to and n.lead_id is not distinct from t.lead_id
        and n.title = 'Follow-up overdue' and n.created_at > now() - interval '1 day'
    );

  -- stale open leads: tell the team's managers once per stale period
  insert into public.notifications (user_id, lead_id, title, body)
  select distinct p.id, l.id, 'No activity on lead',
         format('%s has had no activity for %s days.', l.full_name, settings.stale_lead_days)
  from public.leads l
  join public.profiles p on p.is_active
  join public.user_roles ur on ur.user_id = p.id
  where not l.is_closed
    and l.last_activity_at < now() - make_interval(days => settings.stale_lead_days)
    and ((ur.role = 'sales_manager' and p.team_id is not distinct from l.team_id)
         or (ur.role = 'admin' and l.team_id is null))
    and not exists (
      select 1 from public.notifications n
      where n.user_id = p.id and n.lead_id = l.id and n.title = 'No activity on lead'
        and n.created_at > now() - make_interval(days => settings.stale_lead_days)
    );

  -- unassigned leads: retry assignment now that someone may have capacity
  update public.leads l
  set assigned_to = a.assignee
  from (
    select id, public.pick_assignee(team_id, region_id) as assignee
    from public.leads
    where assigned_to is null and not is_closed
  ) a
  where l.id = a.id and a.assignee is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(rec->>'id', rec->>'user_id'),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else rec end
  );
  return null;
end;
$$;

create trigger audit_leads after insert or update or delete on public.leads
for each row execute function public.audit_trigger();
create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function public.audit_trigger();
create trigger audit_user_roles after insert or update or delete on public.user_roles
for each row execute function public.audit_trigger();
create trigger audit_targets after insert or update or delete on public.targets
for each row execute function public.audit_trigger();
create trigger audit_api_keys after insert or update or delete on public.api_keys
for each row execute function public.audit_trigger();

-- Privacy: permanently remove a customer's personal data on request (admin only).
-- The lead row is kept for reporting, with personal fields wiped.
create or replace function public.erase_lead_personal_data(p_lead uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can erase customer data';
  end if;
  update public.leads
  set full_name = 'Erased customer',
      phone = null,
      email = 'erased+' || id || '@invalid',
      notes = null,
      consent_note = null,
      external_id = null
  where id = p_lead;
  update public.lead_activities set body = null where lead_id = p_lead and type in ('note', 'call');
  -- the audit trail must not keep a copy of the erased data
  update public.audit_log set details = jsonb_build_object('erased', true)
  where entity = 'leads' and entity_id = p_lead::text;
  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), 'erase_personal_data', 'leads', p_lead::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard metrics (security invoker: the caller only sees leads RLS allows)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_product uuid default null,
  p_region uuid default null,
  p_status public.lead_status default null,
  p_source public.lead_source default null,
  p_team uuid default null,
  p_user uuid default null
)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with f as (
    select * from public.leads l
    where (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at < p_to)
      and (p_product is null or l.product_id = p_product)
      and (p_region is null or l.region_id = p_region)
      and (p_status is null or l.status = p_status)
      and (p_source is null or l.source = p_source)
      and (p_team is null or l.team_id = p_team)
      and (p_user is null or l.assigned_to = p_user)
  ),
  month_targets as (
    select coalesce(sum(t.revenue_target), 0) as revenue_target,
           coalesce(sum(t.conversion_target), 0) as conversion_target
    from public.targets t
    where t.month = date_trunc('month', coalesce(p_from, now()))::date
      and (
        (p_user is not null and t.user_id = p_user)
        or (p_user is null and p_team is not null and t.team_id = p_team)
        or (p_user is null and p_team is null and t.team_id is not null)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'open', (select count(*) from f where not is_closed),
    'converted', (select count(*) from f where status = 'converted'),
    'declined', (select count(*) from f where status = 'declined'),
    'demos', (select count(*) from f where status in ('demo_scheduled', 'demo_done', 'converted') and demo_at is not null),
    'revenue', (select coalesce(sum(deal_value), 0) from f where status = 'converted'),
    'revenue_target', (select revenue_target from month_targets),
    'conversion_target', (select conversion_target from month_targets),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from f group by status) s),
    'by_source', (select coalesce(jsonb_object_agg(source, n), '{}') from (select source, count(*) n from f group by source) s),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'leads', n, 'converted', c) order by d), '[]')
               from (select created_at::date d, count(*) n, count(*) filter (where status = 'converted') c from f group by 1) s),
    'leaderboard', (select coalesce(jsonb_agg(row_to_json(x) order by x.revenue desc, x.converted desc), '[]') from (
        select p.id, p.full_name,
               count(*) as leads,
               count(*) filter (where f.status = 'converted') as converted,
               coalesce(sum(f.deal_value) filter (where f.status = 'converted'), 0) as revenue
        from f join public.profiles p on p.id = f.assigned_to
        group by p.id, p.full_name
      ) x)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.products enable row level security;
alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.tasks enable row level security;
alter table public.followup_rules enable row level security;
alter table public.app_settings enable row level security;
alter table public.targets enable row level security;
alter table public.notifications enable row level security;
alter table public.api_keys enable row level security;
alter table public.audit_log enable row level security;

-- Reference data: everyone signed in can read, admins write.
create policy "read teams" on public.teams for select to authenticated using (true);
create policy "admin teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read products" on public.products for select to authenticated using (true);
create policy "admin products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read regions" on public.regions for select to authenticated using (true);
create policy "admin regions" on public.regions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read rules" on public.followup_rules for select to authenticated using (true);
create policy "admin rules" on public.followup_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read settings" on public.app_settings for select to authenticated using (true);
create policy "admin settings" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: colleagues' names are visible; only admins edit. People can toggle
-- their own availability through set_my_availability().
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "admin profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.set_my_availability(p_available boolean)
returns void
language sql security definer set search_path = public
as $$ update public.profiles set is_available = p_available where id = auth.uid(); $$;

create policy "read roles" on public.user_roles for select to authenticated using (true);
create policy "admin roles" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Leads
create policy "see leads" on public.leads for select to authenticated
  using (public.can_see_lead(leads));
create policy "add leads" on public.leads for insert to authenticated
  with check (
    public.is_admin()
    or public.has_role('sales_manager')
    or public.has_role('sales_person')
    or public.has_role('call_executive')
  );
create policy "update leads" on public.leads for update to authenticated
  using (public.can_see_lead(leads))
  with check (public.can_see_lead(leads) or public.can_manage_lead(leads));
-- No delete policy: leads are never deleted, personal data is erased instead.

-- Activities follow lead visibility; people can only add notes/calls as themselves.
create policy "see activities" on public.lead_activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "add activities" on public.lead_activities for insert to authenticated
  with check (
    actor_id = auth.uid()
    and type in ('note', 'call')
    and exists (select 1 from public.leads l where l.id = lead_id)
  );

-- Tasks
create policy "see tasks" on public.tasks for select to authenticated
  using (
    assigned_to = auth.uid()
    or public.is_admin()
    or (lead_id is not null and exists (select 1 from public.leads l where l.id = lead_id and public.can_manage_lead(l)))
  );
create policy "add tasks" on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and (assigned_to = auth.uid() or public.is_admin() or public.has_role('sales_manager'))
    and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id))
  );
create policy "update tasks" on public.tasks for update to authenticated
  using (assigned_to = auth.uid() or public.is_admin())
  with check (assigned_to = auth.uid() or public.is_admin());

-- Targets: admins set all; managers set their team's people and team; everyone reads their own.
create policy "see targets" on public.targets for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (public.has_role('sales_manager') and (
          team_id = public.my_team()
          or user_id in (select id from public.profiles where team_id = public.my_team())))
  );
create policy "set targets" on public.targets for all to authenticated
  using (
    public.is_admin()
    or (public.has_role('sales_manager') and (
          team_id = public.my_team()
          or user_id in (select id from public.profiles where team_id = public.my_team())))
  )
  with check (
    public.is_admin()
    or (public.has_role('sales_manager') and (
          team_id = public.my_team()
          or user_id in (select id from public.profiles where team_id = public.my_team())))
  );

-- Notifications: only your own.
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "read own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- API keys and audit log: admins only (inserts happen via the service role / triggers).
create policy "admin api keys" on public.api_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin audit" on public.audit_log for select to authenticated using (public.is_admin());

-- Lock down helper functions that must not be callable from the API.
revoke execute on function public.pick_assignee(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.notify_managers(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.schedule_followup(public.leads) from public, anon, authenticated;
revoke execute on function public.run_followup_checks() from public, anon, authenticated;
revoke execute on function public.erase_lead_personal_data(uuid) from public, anon;
revoke execute on function public.set_my_availability(boolean) from public, anon;
revoke execute on function public.dashboard_stats(timestamptz, timestamptz, uuid, uuid, public.lead_status, public.lead_source, uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Default follow-up rules
-- ---------------------------------------------------------------------------
insert into public.followup_rules (status, delay_hours, max_attempts, task_title) values
  ('new', 1, 3, 'Call the new lead'),
  ('not_responsive', 24, 3, 'Try calling again'),
  ('responsive', 24, 3, 'Follow up and offer a demo'),
  ('demo_agreed', 24, 2, 'Fix a demo date'),
  ('demo_done', 48, 3, 'Follow up after the demo');

grant execute on function public.erase_lead_personal_data(uuid) to authenticated;
grant execute on function public.set_my_availability(boolean) to authenticated;
grant execute on function public.dashboard_stats(timestamptz, timestamptz, uuid, uuid, public.lead_status, public.lead_source, uuid, uuid) to authenticated;
