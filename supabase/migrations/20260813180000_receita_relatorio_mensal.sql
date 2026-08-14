-- Envio automático de e-mail — resultado do mês (config, destinatários, log + cron hourly)

CREATE TABLE public.relatorio_mensal_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  hora_local time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  mes_referencia text NOT NULL DEFAULT 'anterior'
    CHECK (mes_referencia IN ('anterior', 'corrente')),
  secoes jsonb NOT NULL DEFAULT '{
    "indicadores_operacionais": true,
    "receita_visao_mes": true,
    "receita_composicao": true,
    "receita_inad_grupos": true,
    "receita_grafico_resumo": true,
    "eficiencia_overview": true
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.relatorio_mensal_config IS
  'Configuração singleton do envio automático diário do relatório mensal (gerentes/sócios).';

INSERT INTO public.relatorio_mensal_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.relatorio_mensal_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  email text NOT NULL,
  area_key text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX relatorio_mensal_destinatarios_ativo_idx
  ON public.relatorio_mensal_destinatarios (ativo)
  WHERE ativo = true;

COMMENT ON TABLE public.relatorio_mensal_destinatarios IS
  'Destinatários do relatório mensal. area_key opcional: digest focado na área + consolidado.';

CREATE TABLE public.relatorio_mensal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sucesso', 'erro')),
  erro text,
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual', 'teste')),
  destinatario_id uuid REFERENCES public.relatorio_mensal_destinatarios (id) ON DELETE SET NULL
);

CREATE INDEX relatorio_mensal_log_enviado_em_idx
  ON public.relatorio_mensal_log (enviado_em DESC);

COMMENT ON TABLE public.relatorio_mensal_log IS
  'Histórico de envios do relatório mensal por destinatário.';

-- RLS: somente admin ativo
ALTER TABLE public.relatorio_mensal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_mensal_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_mensal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY relatorio_mensal_config_select_admin
  ON public.relatorio_mensal_config FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_config_update_admin
  ON public.relatorio_mensal_config FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_destinatarios_select_admin
  ON public.relatorio_mensal_destinatarios FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_destinatarios_insert_admin
  ON public.relatorio_mensal_destinatarios FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_destinatarios_update_admin
  ON public.relatorio_mensal_destinatarios FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_destinatarios_delete_admin
  ON public.relatorio_mensal_destinatarios FOR DELETE TO authenticated
  USING (public.current_user_is_admin());

CREATE POLICY relatorio_mensal_log_select_admin
  ON public.relatorio_mensal_log FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

GRANT SELECT, UPDATE ON public.relatorio_mensal_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorio_mensal_destinatarios TO authenticated;
GRANT SELECT ON public.relatorio_mensal_log TO authenticated;

-- Cron hourly — edge function decide se é hora de enviar (hora_local na config)
-- Secrets no Vault (não versionados):
-- select vault.create_secret('https://<project>.supabase.co/functions/v1/relatorio-mensal-enviar', 'relatorio_mensal_enviar_url');
-- select vault.create_secret('<segredo-forte>', 'relatorio_mensal_cron_secret');
-- select vault.create_secret('<publishable-ou-anon-key>', 'supabase_publishable_key');

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'relatorio-mensal-hourly';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
  PERFORM cron.schedule(
    'relatorio-mensal-hourly',
    '0 * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'relatorio_mensal_enviar_url' LIMIT 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'relatorio_mensal_cron_secret' LIMIT 1)
        ),
        body := jsonb_build_object('modo', 'cron'),
        timeout_milliseconds := 300000
      );
    $cron$
  );
END;
$$;
