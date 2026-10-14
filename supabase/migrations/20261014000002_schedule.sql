-- Run follow-up checks every 15 minutes with pg_cron (enabled on Supabase).
-- Skipped quietly where pg_cron is not installed, such as the local test database.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('crm-followup-checks', '*/15 * * * *', 'select public.run_followup_checks()');
  else
    raise notice 'pg_cron not available; schedule run_followup_checks() another way';
  end if;
end $$;
