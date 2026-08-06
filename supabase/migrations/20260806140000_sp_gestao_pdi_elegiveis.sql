-- Gestão de PDI — espelho da aba "Elegíveis" da planilha
-- "Base de Gestão de PDI.xlsx" (SharePoint Controladoria).
-- Sync: scripts/sharepoint/sync-sharepoint.mjs (fonte gestao_pdi).

CREATE TABLE public.sp_gestao_pdi_elegiveis (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ano                    INTEGER NOT NULL,
  mes                    INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area                   TEXT,
  colaborador            TEXT NOT NULL,
  estrutura              TEXT,
  progresso              NUMERIC(10, 2),
  evidencias_execucao    TEXT,
  one_a_one              NUMERIC(10, 2),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sp_gestao_pdi_elegiveis_ano_mes_colaborador_key
    UNIQUE (ano, mes, colaborador)
);

CREATE INDEX sp_gestao_pdi_elegiveis_ano_mes_idx
  ON public.sp_gestao_pdi_elegiveis (ano, mes);
CREATE INDEX sp_gestao_pdi_elegiveis_area_idx
  ON public.sp_gestao_pdi_elegiveis (area);
CREATE INDEX sp_gestao_pdi_elegiveis_colaborador_idx
  ON public.sp_gestao_pdi_elegiveis (colaborador);

COMMENT ON TABLE public.sp_gestao_pdi_elegiveis IS
  'Espelho normalizado da aba Elegíveis de Base de Gestão de PDI.xlsx (site Controladoria). Uma linha por colaborador × mês (Jun–Dez): progresso, evidências de execução e 1:1.';

COMMENT ON COLUMN public.sp_gestao_pdi_elegiveis.progresso IS
  '% de progresso do PDI no mês (valor da planilha).';
COMMENT ON COLUMN public.sp_gestao_pdi_elegiveis.evidencias_execucao IS
  'Flag textual da planilha (ex.: Sim / Não).';
COMMENT ON COLUMN public.sp_gestao_pdi_elegiveis.one_a_one IS
  'Contagem/flag de 1:1 no mês (valor numérico da planilha).';

CREATE TRIGGER sp_gestao_pdi_elegiveis_updated_at
  BEFORE UPDATE ON public.sp_gestao_pdi_elegiveis
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.sp_gestao_pdi_elegiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.sp_gestao_pdi_elegiveis
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.sp_gestao_pdi_elegiveis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
