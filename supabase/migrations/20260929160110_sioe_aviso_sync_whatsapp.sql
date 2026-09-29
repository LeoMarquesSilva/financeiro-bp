-- Segredo do cron do aviso de atualização do SIOE (WhatsApp).
-- O valor nasce aqui e vai para o Vault; não fica no git.

CREATE TABLE public.sioe_aviso_config (
  id integer PRIMARY KEY CHECK (id = 1),
  cron_secret text NOT NULL
);

COMMENT ON TABLE public.sioe_aviso_config IS
  'Segredo do pg_cron que avisa no WhatsApp quando a carga do SIOE não rodou.';

ALTER TABLE public.sioe_aviso_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sioe_aviso_config FROM anon, authenticated;
GRANT SELECT ON public.sioe_aviso_config TO service_role;

DO $$
DECLARE
  segredo text := encode(gen_random_bytes(32), 'hex');
  existing_job bigint;
BEGIN
  INSERT INTO public.sioe_aviso_config (id, cron_secret)
  VALUES (1, segredo);

  PERFORM vault.create_secret(segredo, 'sioe_aviso_cron_secret');
  PERFORM vault.create_secret(
    'https://pzfxmlidwdmsqfwrxdbd.supabase.co/functions/v1/sioe-aviso-sync',
    'sioe_aviso_sync_url'
  );

  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'sioe-aviso-sync-checar';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  -- 11:50, 15:50, 17:50 e 20:50 UTC = 08:50, 12:50, 14:50 e 17:50 em Brasília.
  -- A carga começa no minuto 17; esta conferência só avisa se ela não deixou log.
  PERFORM cron.schedule(
    'sioe-aviso-sync-checar',
    '50 11,15,17,20 * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sioe_aviso_sync_url' LIMIT 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sioe_aviso_cron_secret' LIMIT 1)
        ),
        body := jsonb_build_object('modo', 'checar'),
        timeout_milliseconds := 30000
      );
    $cron$
  );
END $$;
