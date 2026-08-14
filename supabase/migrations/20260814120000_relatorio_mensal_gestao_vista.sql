-- Relatório diário = gestão à vista (mês corrente, dia 1 até hoje) — não resultado/fechamento.

UPDATE public.relatorio_mensal_config
SET mes_referencia = 'corrente'
WHERE mes_referencia = 'anterior';

ALTER TABLE public.relatorio_mensal_config
  ALTER COLUMN mes_referencia SET DEFAULT 'corrente';

COMMENT ON TABLE public.relatorio_mensal_config IS
  'Configuração singleton do envio automático diário de gestão à vista (mês corrente parcial).';

COMMENT ON COLUMN public.relatorio_mensal_config.mes_referencia IS
  'Legado — sempre corrente (gestão à vista do dia 1 até hoje).';
