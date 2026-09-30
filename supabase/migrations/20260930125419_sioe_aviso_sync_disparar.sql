-- O cron do GitHub Actions atrasa a carga da manhã.
-- Este horário (08:17, 12:17, 14:17 e 17:17 em Brasília) pede a carga na hora.

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'sioe-aviso-sync-disparar';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'sioe-aviso-sync-disparar',
    '17 11,15,17,20 * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sioe_aviso_sync_url' LIMIT 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sioe_aviso_cron_secret' LIMIT 1)
        ),
        body := jsonb_build_object('modo', 'disparar'),
        timeout_milliseconds := 30000
      );
    $cron$
  );
END $$;
