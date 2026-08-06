-- Gestão de PDI — espelho das abas "Desvio …" / Análise Desvios
-- (Base de Gestão de PDI.xlsx). Sync: fonte gestao_pdi.

CREATE TABLE public.sp_gestao_pdi_desvios (
  id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ano                        INTEGER NOT NULL,
  mes                        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area                       TEXT,
  colaborador                TEXT NOT NULL,
  estrutura                  TEXT,
  progresso_anterior         NUMERIC(10, 2),
  progresso                  NUMERIC(10, 2),
  evidencias_execucao        TEXT,
  one_a_one                  NUMERIC(10, 2),
  desvio_criterio_apuracao   TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sp_gestao_pdi_desvios_ano_mes_colaborador_key
    UNIQUE (ano, mes, colaborador)
);

CREATE INDEX sp_gestao_pdi_desvios_ano_mes_idx
  ON public.sp_gestao_pdi_desvios (ano, mes);
CREATE INDEX sp_gestao_pdi_desvios_colaborador_idx
  ON public.sp_gestao_pdi_desvios (colaborador);

COMMENT ON TABLE public.sp_gestao_pdi_desvios IS
  'Espelho das abas Desvio* de Base de Gestão de PDI.xlsx (análise de desvios / critério de apuração).';

COMMENT ON COLUMN public.sp_gestao_pdi_desvios.desvio_criterio_apuracao IS
  'Texto da coluna "Desvio Critério de Puração" da planilha.';

CREATE TRIGGER sp_gestao_pdi_desvios_updated_at
  BEFORE UPDATE ON public.sp_gestao_pdi_desvios
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.sp_gestao_pdi_desvios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.sp_gestao_pdi_desvios
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.sp_gestao_pdi_desvios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
