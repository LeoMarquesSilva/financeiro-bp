-- Número do processo (VIOS "Processos Lista.csv", coluna Número).
-- Processos administrativos não têm N.° CNJ; o identificador vem como
-- "Outros: 1670653/2026", "ADI: …", etc. Usado para preencher nro_cnj nas
-- tarefas quando a coluna Nro CNJ do CSV estiver vazia.

CREATE TABLE IF NOT EXISTS public.sp_processos_numero (
  ci          BIGINT PRIMARY KEY,
  numero      TEXT NOT NULL,
  numero_tipo TEXT,
  numero_raw  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sp_processos_numero_numero_idx
  ON public.sp_processos_numero (numero);

COMMENT ON TABLE public.sp_processos_numero IS
  'Espelho da coluna Número de Processos Lista.csv (VIOS). Prefixo (CNJ/Outros/…) em numero_tipo; valor limpo em numero.';

ALTER TABLE public.sp_processos_numero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sp_processos_numero_select_authenticated ON public.sp_processos_numero;
CREATE POLICY sp_processos_numero_select_authenticated
  ON public.sp_processos_numero
  FOR SELECT
  TO authenticated
  USING (true);

-- Preenche nro_cnj vazio em tarefas a partir do número do processo (ci_processo).
CREATE OR REPLACE FUNCTION public.eficiencia_backfill_nro_cnj_de_processo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_hist integer := 0;
  n_tar integer := 0;
BEGIN
  UPDATE public.sp_tarefas_historico th
  SET
    nro_cnj = p.numero,
    updated_at = now()
  FROM public.sp_processos_numero p
  WHERE th.ci_processo = p.ci
    AND (th.nro_cnj IS NULL OR btrim(th.nro_cnj) = '')
    AND p.numero IS NOT NULL
    AND btrim(p.numero) <> '';
  GET DIAGNOSTICS n_hist = ROW_COUNT;

  UPDATE public.sp_tarefas t
  SET
    nro_cnj = p.numero,
    updated_at = now()
  FROM public.sp_processos_numero p
  WHERE t.ci_processo = p.ci
    AND (t.nro_cnj IS NULL OR btrim(t.nro_cnj) = '')
    AND p.numero IS NOT NULL
    AND btrim(p.numero) <> '';
  GET DIAGNOSTICS n_tar = ROW_COUNT;

  RETURN jsonb_build_object(
    'tarefas_historico', n_hist,
    'tarefas', n_tar
  );
END;
$$;

REVOKE ALL ON FUNCTION public.eficiencia_backfill_nro_cnj_de_processo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eficiencia_backfill_nro_cnj_de_processo() TO service_role;

COMMENT ON FUNCTION public.eficiencia_backfill_nro_cnj_de_processo() IS
  'Coalesce nro_cnj vazio em sp_tarefas* com sp_processos_numero.numero (processos administrativos).';
