-- Eficiência Protocolo: excludente manual em sp_protocolos.
--
-- Mesmo mecanismo do SLA Protocolo e do SLA Vistagem: a linha continua no banco e
-- no racional, mas não entra na % (nem no total, nem como inconsistência).
-- A marcação é manual (migration), e o sync do SharePoint não envia essas colunas,
-- então o upsert não apaga a marca.
--
-- Só as funções de Eficiência Protocolo (jurídico) mudam. Os indicadores de
-- Operações Legais (SLA D1 e inconsistência da controladoria) seguem iguais.

ALTER TABLE public.sp_protocolos
  ADD COLUMN IF NOT EXISTS excludente text NOT NULL DEFAULT 'Não',
  ADD COLUMN IF NOT EXISTS excludente_motivo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sp_protocolos_excludente_check'
      AND conrelid = 'public.sp_protocolos'::regclass
  ) THEN
    ALTER TABLE public.sp_protocolos
      ADD CONSTRAINT sp_protocolos_excludente_check
      CHECK (excludente IN ('Excludente', 'Não'));
  END IF;
END $$;

COMMENT ON COLUMN public.sp_protocolos.excludente IS
  'Excludente = fora da Eficiência Protocolo (continua no racional). Marcação manual da controladoria; o sync não altera.';
COMMENT ON COLUMN public.sp_protocolos.excludente_motivo IS
  'Por que o pedido de protocolo foi marcado como excludente.';

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(p_ano integer, p_area text DEFAULT NULL::text)
 RETURNS TABLE(mes integer, total integer, sem_inconsistencia integer, pct_eficiencia numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH excl AS MATERIALIZED (
    SELECT chave, vigencia_inicio, vigencia_fim, origem
    FROM public.eficiencia_onboarding_exclusao_chaves
  )
  SELECT
    EXTRACT(MONTH FROM t.data_criada)::integer AS mes,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE t.status_inconsistencia = 'EFICIÊNCIA') AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE t.status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia
  FROM sp_protocolos t
  CROSS JOIN LATERAL (
    SELECT public.eficiencia_onboarding_grupo_chave(t.cliente) AS k
  ) s
  WHERE t.data_criada >= make_date(p_ano, 1, 1)
    AND t.data_criada < make_date(p_ano + 1, 1, 1)
    AND (p_area IS NULL OR t.area = p_area)
    AND (t.area IS NULL OR t.area NOT IN ('Operações Legais', 'Tributário'))
    AND t.excludente IS DISTINCT FROM 'Excludente'
    AND NOT EXISTS (
      SELECT 1
      FROM excl c
      WHERE t.data_criada BETWEEN c.vigencia_inicio AND c.vigencia_fim
        AND s.k <> ''
        AND (
          (
            c.origem = 'grupo'
            AND (
              c.chave = s.k
              OR s.k LIKE c.chave || ' %'
              OR c.chave LIKE s.k || ' %'
            )
          )
          OR (c.origem = 'pessoa' AND c.chave = s.k)
        )
    )
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_diario(p_ano integer, p_mes integer, p_area text DEFAULT NULL::text)
 RETURNS TABLE(dia integer, total integer, pct_eficiencia numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    EXTRACT(DAY FROM data_criada)::integer AS dia,
    COUNT(*)::integer AS total,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND EXTRACT(MONTH FROM data_criada)::integer = p_mes
    AND (p_area IS NULL OR area = p_area)
    AND area IS NOT NULL
    AND area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
    AND excludente IS DISTINCT FROM 'Excludente'
    AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  GROUP BY 1
  HAVING COUNT(*) > 0
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(p_ano integer, p_meses integer[] DEFAULT NULL::integer[], p_area text DEFAULT NULL::text)
 RETURNS TABLE(usuario text, qtd_inconsistencia integer, pct_do_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT criado_por AS usuario FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area) AND criado_por IS NOT NULL
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND excludente IS DISTINCT FROM 'Excludente'
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ), total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT usuario, COUNT(*)::integer, ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2)
  FROM base GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_grupo(p_ano integer, p_meses integer[] DEFAULT NULL::integer[], p_area text DEFAULT NULL::text)
 RETURNS TABLE(grupo_cliente text, qtd_inconsistencia integer, pct_do_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(trim(public.receita_grupo_cliente_canonico(cliente)), ''),
        '(sem grupo)'
      ) AS grupo_cliente
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND excludente IS DISTINCT FROM 'Excludente'
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    grupo_cliente,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_tipo(p_ano integer, p_meses integer[] DEFAULT NULL::integer[], p_area text DEFAULT NULL::text)
 RETURNS TABLE(tipo_inconsistencia text, qtd_inconsistencia integer, pct_do_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(trim(inconsistencia_juridico), ''),
        '(sem tipo)'
      ) AS tipo_inconsistencia
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND excludente IS DISTINCT FROM 'Excludente'
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    tipo_inconsistencia,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

-- 97 pedidos de 16 a 26/10/2026, todos com "Erro na Petição" (95 apontados pela
-- revisão da Fênix IA). Lista enviada pela controladoria em 16/11/2026.
UPDATE public.sp_protocolos
SET excludente = 'Excludente',
    excludente_motivo = 'Retirado da Eficiência Protocolo a pedido da controladoria em 16/11/2026 (lote de pedidos de 16 a 26/10/2026 com "Erro na Petição").'
WHERE sp_id IN (
  58643, 58609, 58585, 58558, 58491, 58498, 58489, 58404, 58587, 58638,
  58576, 58691, 58637, 58621, 58568, 58548, 58551, 58414, 58549, 58422,
  58616, 58423, 58415, 58703, 58536, 58502, 58494, 58441, 58435, 58430,
  58447, 58661, 58501, 58421, 58528, 58640, 58594, 58533, 58412, 58408,
  58417, 58653, 58656, 58654, 58570, 58619, 58620, 58546, 58480, 58476,
  58459, 58440, 58438, 58457, 58460, 58671, 58645, 58547, 58554, 58541,
  58450, 58442, 58409, 58526, 58474, 58683, 58672, 58662, 58649, 58571,
  58471, 58426, 58377, 58395, 58392, 58618, 58486, 58631, 58629, 58651,
  58534, 58500, 58465, 58614, 58681, 58563, 58522, 58540, 58453, 58420,
  58375, 58397, 58648, 58468, 58443, 58407, 58384
);
