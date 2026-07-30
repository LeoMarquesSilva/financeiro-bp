-- Importação planilha + andamentos (planilha agora, VIOS futuro).

CREATE OR REPLACE FUNCTION public.normalizar_cnj(p_cnj text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(trim(p_cnj), ''), '[^0-9]', '', 'g');
$$;

COMMENT ON FUNCTION public.normalizar_cnj(text) IS
  'Remove formatação do CNJ para comparação (somente dígitos).';

ALTER TABLE public.inadimplencia_judicializada
  ADD COLUMN IF NOT EXISTS nro_cnj text,
  ADD COLUMN IF NOT EXISTS parte_passiva text,
  ADD COLUMN IF NOT EXISTS valor_causa numeric(15, 2),
  ADD COLUMN IF NOT EXISTS status_planilha text,
  ADD COLUMN IF NOT EXISTS andamentos_resumo text,
  ADD COLUMN IF NOT EXISTS providencias_planilha text,
  ADD COLUMN IF NOT EXISTS citacao text,
  ADD COLUMN IF NOT EXISTS tribunal text,
  ADD COLUMN IF NOT EXISTS tipo_acao_planilha text,
  ADD COLUMN IF NOT EXISTS importado_em timestamptz,
  ADD COLUMN IF NOT EXISTS importado_de text,
  ADD COLUMN IF NOT EXISTS andamentos_sync_em timestamptz,
  ADD COLUMN IF NOT EXISTS andamentos_fonte text NOT NULL DEFAULT 'planilha';

COMMENT ON COLUMN public.inadimplencia_judicializada.andamentos_fonte IS
  'Origem do andamento mais recente: planilha | vios | misto';
COMMENT ON COLUMN public.inadimplencia_judicializada.andamentos_sync_em IS
  'Última sincronização de andamentos a partir do VIOS (futuro).';

DROP INDEX IF EXISTS public.inadimplencia_judicializada_grupo_chave_ativo_idx;

CREATE UNIQUE INDEX IF NOT EXISTS inadimplencia_judicializada_processo_ativo_idx
  ON public.inadimplencia_judicializada (processo_id)
  WHERE encerrado_at IS NULL;

CREATE INDEX IF NOT EXISTS inadimplencia_judicializada_nro_cnj_idx
  ON public.inadimplencia_judicializada (public.normalizar_cnj(nro_cnj));

CREATE TABLE IF NOT EXISTS public.inadimplencia_judicializada_andamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judicializada_id UUID NOT NULL REFERENCES public.inadimplencia_judicializada(id) ON DELETE CASCADE,
  processo_id      UUID NOT NULL REFERENCES public.processos_completo(id),
  data_andamento   DATE,
  descricao        TEXT NOT NULL,
  fonte            TEXT NOT NULL DEFAULT 'planilha'
    CHECK (fonte IN ('planilha', 'vios', 'manual')),
  vios_evento_id   TEXT,
  vios_sync_em     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inadimplencia_judicializada_andamentos IS
  'Histórico de andamentos por caso judicializado. vios_evento_id reservado para sync futuro do VIOS.';

CREATE INDEX IF NOT EXISTS inadimplencia_judicializada_andamentos_caso_idx
  ON public.inadimplencia_judicializada_andamentos (judicializada_id, data_andamento DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS inadimplencia_judicializada_andamentos_vios_evento_idx
  ON public.inadimplencia_judicializada_andamentos (vios_evento_id)
  WHERE vios_evento_id IS NOT NULL;

ALTER TABLE public.inadimplencia_judicializada_andamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inadimplencia_judicializada_andamentos_select ON public.inadimplencia_judicializada_andamentos;
CREATE POLICY inadimplencia_judicializada_andamentos_select
  ON public.inadimplencia_judicializada_andamentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_andamentos_write ON public.inadimplencia_judicializada_andamentos;
CREATE POLICY inadimplencia_judicializada_andamentos_write
  ON public.inadimplencia_judicializada_andamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_andamentos_select_anon ON public.inadimplencia_judicializada_andamentos;
CREATE POLICY inadimplencia_judicializada_andamentos_select_anon
  ON public.inadimplencia_judicializada_andamentos FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_andamentos_write_anon ON public.inadimplencia_judicializada_andamentos;
CREATE POLICY inadimplencia_judicializada_andamentos_write_anon
  ON public.inadimplencia_judicializada_andamentos FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.inadimplencia_judicializada_list AS
SELECT
  j.id,
  j.grupo_cliente,
  j.grupo_chave,
  j.processo_id,
  j.valor_em_aberto_auto,
  j.valor_em_aberto_ajuste,
  COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto) AS valor_em_aberto,
  j.data_judicializacao,
  j.observacoes,
  j.encerrado_at,
  j.created_by,
  j.created_at,
  j.updated_at,
  COALESCE(j.nro_cnj, p.nro_cnj) AS nro_cnj,
  p.acao,
  p.area,
  p.departamento,
  p.situacao_processo,
  p.fase_processual,
  p.advogado_responsavel,
  p.cliente AS processo_cliente,
  j.parte_passiva,
  j.valor_causa,
  j.status_planilha,
  j.andamentos_resumo,
  j.providencias_planilha,
  j.citacao,
  j.tribunal,
  j.tipo_acao_planilha,
  j.importado_em,
  j.importado_de,
  j.andamentos_sync_em,
  j.andamentos_fonte
FROM public.inadimplencia_judicializada j
JOIN public.processos_completo p ON p.id = j.processo_id;

CREATE OR REPLACE FUNCTION public.lookup_processos_por_cnj(p_cnj text)
RETURNS TABLE (
  id uuid,
  ci text,
  grupo_cliente text,
  departamento text,
  area text,
  advogado_responsavel text,
  cliente text,
  acao text,
  nro_cnj text,
  situacao_processo text,
  fase_processual text,
  pessoa_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.ci,
    p.grupo_cliente,
    p.departamento,
    p.area,
    p.advogado_responsavel,
    p.cliente,
    p.acao,
    p.nro_cnj,
    p.situacao_processo,
    p.fase_processual,
    p.pessoa_id
  FROM public.processos_completo p
  WHERE public.normalizar_cnj(p.nro_cnj) = public.normalizar_cnj(p_cnj);
$$;

COMMENT ON FUNCTION public.lookup_processos_por_cnj(text) IS
  'Busca processos VIOS pelo CNJ (comparação normalizada, somente dígitos).';
