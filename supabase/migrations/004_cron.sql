-- =====================================================================
-- CareBridge — programare automată (OPȚIONAL)
-- Necesită extensia pg_cron: Dashboard → Database → Extensions → pg_cron.
-- Fără ea, aplicația apelează process_due_activities() din browser
-- la fiecare 5 minute cât timp un utilizator este conectat.
-- =====================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'carebridge-due-activities',
  '*/5 * * * *',
  $$ select public.process_due_activities(); $$
);

-- Curățarea notificărilor citite mai vechi de 90 de zile (zilnic, 03:15)
select cron.schedule(
  'carebridge-cleanup-notifications',
  '15 3 * * *',
  $$ delete from public.notifications where is_read and created_at < now() - interval '90 days'; $$
);
