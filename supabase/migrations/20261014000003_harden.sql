-- Trigger functions are never called directly; Postgres only checks EXECUTE when the trigger is created.
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.leads_before_insert() from public, anon, authenticated;
revoke execute on function public.leads_after_insert() from public, anon, authenticated;
revoke execute on function public.leads_before_update() from public, anon, authenticated;
revoke execute on function public.leads_after_update() from public, anon, authenticated;
revoke execute on function public.tasks_after_update() from public, anon, authenticated;
-- Policy helpers: needed by signed-in users (row-level security calls them), never by anonymous visitors.
revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_team() from public, anon;
revoke execute on function public.can_see_lead(public.leads) from public, anon;
revoke execute on function public.can_manage_lead(public.leads) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_team() to authenticated;
grant execute on function public.can_see_lead(public.leads) to authenticated;
grant execute on function public.can_manage_lead(public.leads) to authenticated;

-- Foreign keys used in filters and policies.
create index if not exists tasks_lead_idx on public.tasks (lead_id);
create index if not exists notifications_lead_idx on public.notifications (lead_id);
create index if not exists profiles_team_idx on public.profiles (team_id);
create index if not exists leads_product_idx on public.leads (product_id);
create index if not exists leads_region_idx on public.leads (region_id);
