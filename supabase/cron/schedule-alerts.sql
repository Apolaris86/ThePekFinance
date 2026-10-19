-- Schedules the check-alerts Edge Function every minute, Monday-Friday (UTC).
-- Run once in the Supabase SQL editor after deploying the function.
-- Placeholders: <PROJECT_REF> and <CRON_SECRET> (the same value set with
-- `supabase secrets set CRON_SECRET=...`). Secrets go in Vault, not in the job text.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'pek_project_url');
select vault.create_secret('<CRON_SECRET>', 'pek_cron_secret');

select cron.schedule(
  'check-alerts',
  '* * * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pek_project_url') || '/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pek_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To stop it later:  select cron.unschedule('check-alerts');
