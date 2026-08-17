-- Espelho de férias do ORQESTRAI (vacation_periods + vacation_leaves).
-- Só leitura no SIOE; origem continua no ORQESTRAI.

CREATE TABLE IF NOT EXISTS public.colaboradores_ferias (
  orqestrai_employee_id UUID PRIMARY KEY,
  full_name             TEXT NOT NULL,
  nome_chave            TEXT NOT NULL,
  vacation_exempt       BOOLEAN NOT NULL DEFAULT false,
  saldo_dias            INTEGER NOT NULL DEFAULT 0,
  gozados_ano           INTEGER NOT NULL DEFAULT 0,
  em_ferias             BOOLEAN NOT NULL DEFAULT false,
  ferias_inicio         DATE,
  ferias_fim            DATE,
  proximo_inicio        DATE,
  proximo_fim           DATE,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS colaboradores_ferias_nome_chave_idx
  ON public.colaboradores_ferias (nome_chave);

COMMENT ON TABLE public.colaboradores_ferias IS
  'Saldo e gozo de férias sincronizados do ORQESTRAI (scripts/sync-orqestrai-ferias.mjs).';

ALTER TABLE public.colaboradores_ferias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaboradores_ferias_select_authenticated ON public.colaboradores_ferias;
CREATE POLICY colaboradores_ferias_select_authenticated
  ON public.colaboradores_ferias FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS colaboradores_ferias_select_anon ON public.colaboradores_ferias;
CREATE POLICY colaboradores_ferias_select_anon
  ON public.colaboradores_ferias FOR SELECT TO anon
  USING (true);
