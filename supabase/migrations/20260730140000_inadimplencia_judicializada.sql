-- Inadimplência judicializada: casos antigos com processo VIOS vinculado.

CREATE TABLE IF NOT EXISTS public.inadimplencia_judicializada (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_cliente          TEXT NOT NULL,
  grupo_chave            TEXT NOT NULL,
  processo_id            UUID NOT NULL REFERENCES public.processos_completo(id),
  valor_em_aberto_auto   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  valor_em_aberto_ajuste NUMERIC(15, 2),
  data_judicializacao    DATE,
  observacoes            TEXT,
  encerrado_at           TIMESTAMPTZ,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inadimplencia_judicializada IS
  'Casos de inadimplência judicializada: grupo + processo VIOS, valor híbrido (auto + ajuste manual).';

CREATE UNIQUE INDEX IF NOT EXISTS inadimplencia_judicializada_grupo_chave_ativo_idx
  ON public.inadimplencia_judicializada (grupo_chave)
  WHERE encerrado_at IS NULL;

CREATE INDEX IF NOT EXISTS inadimplencia_judicializada_processo_idx
  ON public.inadimplencia_judicializada (processo_id);

CREATE INDEX IF NOT EXISTS inadimplencia_judicializada_encerrado_idx
  ON public.inadimplencia_judicializada (encerrado_at);

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
  p.nro_cnj,
  p.acao,
  p.area,
  p.departamento,
  p.situacao_processo,
  p.fase_processual,
  p.advogado_responsavel,
  p.cliente AS processo_cliente
FROM public.inadimplencia_judicializada j
JOIN public.processos_completo p ON p.id = j.processo_id;

COMMENT ON VIEW public.inadimplencia_judicializada_list IS
  'Lista de inadimplência judicializada com dados do processo VIOS e valor exibido (ajuste ou auto).';

ALTER TABLE public.inadimplencia_judicializada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inadimplencia_judicializada_select_authenticated ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_select_authenticated
  ON public.inadimplencia_judicializada FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_insert_authenticated ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_insert_authenticated
  ON public.inadimplencia_judicializada FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_update_authenticated ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_update_authenticated
  ON public.inadimplencia_judicializada FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_select_anon ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_select_anon
  ON public.inadimplencia_judicializada FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_insert_anon ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_insert_anon
  ON public.inadimplencia_judicializada FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS inadimplencia_judicializada_update_anon ON public.inadimplencia_judicializada;
CREATE POLICY inadimplencia_judicializada_update_anon
  ON public.inadimplencia_judicializada FOR UPDATE TO anon USING (true) WITH CHECK (true);
