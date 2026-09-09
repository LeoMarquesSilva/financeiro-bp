-- Amostra de chamados FATAL persistida por competência.
-- CI que já entrou na amostra (sorteio ou chamado no RESPONSUM) não sai
-- e não é resorteado quando a população muda.

CREATE TABLE public.eficiencia_amostra_chamados (
  ano         INTEGER NOT NULL,
  mes         INTEGER NOT NULL
    CHECK (mes >= 1 AND mes <= 12),
  ci          TEXT NOT NULL,
  na_amostra  BOOLEAN NOT NULL DEFAULT false,
  snapshot    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes, ci)
);

CREATE INDEX eficiencia_amostra_chamados_ano_mes_idx
  ON public.eficiencia_amostra_chamados (ano, mes);

COMMENT ON TABLE public.eficiencia_amostra_chamados IS
  'CIs da amostra de evidências FATAL por ano/mês. Insert-only: item que entrou permanece.';
COMMENT ON COLUMN public.eficiencia_amostra_chamados.na_amostra IS
  'true = está na amostra (não sai). false = já considerado e ficou de fora do sorteio.';

ALTER TABLE public.eficiencia_amostra_chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY eficiencia_amostra_chamados_all_anon
  ON public.eficiencia_amostra_chamados FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY eficiencia_amostra_chamados_all_authenticated
  ON public.eficiencia_amostra_chamados FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
