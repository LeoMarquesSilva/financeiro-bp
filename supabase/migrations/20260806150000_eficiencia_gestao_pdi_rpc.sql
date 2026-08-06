-- Gestão de PDI — KPI a partir de sp_gestao_pdi_elegiveis
-- Regra (a partir de jul/2026):
--   Apta = (progresso ≠ mês anterior) AND evidências = 'Sim' AND 1:1 >= 1
--   Caso contrário = desvio
-- Junho/2026: meta fixada em 100% (baseline do BI).

CREATE OR REPLACE FUNCTION public.eficiencia_gestao_pdi_avaliacao(p_ano integer)
RETURNS TABLE (
  ano integer,
  mes integer,
  area text,
  colaborador text,
  estrutura text,
  progresso numeric,
  progresso_anterior numeric,
  evidencias_execucao text,
  one_a_one numeric,
  mudou_progresso boolean,
  tem_evidencia boolean,
  tem_1a1 boolean,
  apta boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      e.ano,
      e.mes,
      e.area,
      e.colaborador,
      e.estrutura,
      e.progresso,
      lag(e.progresso) OVER (
        PARTITION BY e.colaborador, e.ano
        ORDER BY e.mes
      ) AS progresso_anterior,
      e.evidencias_execucao,
      e.one_a_one
    FROM public.sp_gestao_pdi_elegiveis e
    WHERE e.ano = p_ano
  )
  SELECT
    b.ano,
    b.mes,
    b.area,
    b.colaborador,
    b.estrutura,
    b.progresso,
    b.progresso_anterior,
    b.evidencias_execucao,
    b.one_a_one,
    (b.progresso_anterior IS NOT NULL AND b.progresso IS DISTINCT FROM b.progresso_anterior)
      AS mudou_progresso,
    (lower(trim(coalesce(b.evidencias_execucao, ''))) = 'sim') AS tem_evidencia,
    (coalesce(b.one_a_one, 0) >= 1) AS tem_1a1,
    CASE
      -- Junho: baseline 100% (todos contam como aptos no KPI mensal)
      WHEN b.mes = 6 THEN true
      ELSE (
        b.progresso_anterior IS NOT NULL
        AND b.progresso IS DISTINCT FROM b.progresso_anterior
        AND lower(trim(coalesce(b.evidencias_execucao, ''))) = 'sim'
        AND coalesce(b.one_a_one, 0) >= 1
      )
    END AS apta
  FROM base b;
$$;

COMMENT ON FUNCTION public.eficiencia_gestao_pdi_avaliacao(integer) IS
  'Avaliação linha a linha Gestão de PDI: apta/desvio. Junho sempre apta (baseline 100%).';

CREATE OR REPLACE FUNCTION public.eficiencia_gestao_pdi_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  elegiveis integer,
  aptas integer,
  desvios integer,
  pct_aptas numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.mes,
    COUNT(*)::integer AS elegiveis,
    COUNT(*) FILTER (WHERE a.apta)::integer AS aptas,
    COUNT(*) FILTER (WHERE NOT a.apta)::integer AS desvios,
    CASE
      WHEN a.mes = 6 THEN 100::numeric
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (WHERE a.apta) / COUNT(*),
        2
      )
    END AS pct_aptas
  FROM public.eficiencia_gestao_pdi_avaliacao(p_ano) a
  WHERE p_area IS NULL OR a.area = p_area
  GROUP BY a.mes
  ORDER BY a.mes;
$$;

COMMENT ON FUNCTION public.eficiencia_gestao_pdi_mensal(integer, text) IS
  '% aptas / elegíveis por mês. Junho fixo 100%. Filtro p_area opcional.';

CREATE OR REPLACE FUNCTION public.eficiencia_gestao_pdi_detalhe(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  area text,
  colaborador text,
  estrutura text,
  progresso numeric,
  progresso_anterior numeric,
  evidencias_execucao text,
  one_a_one numeric,
  mudou_progresso boolean,
  tem_evidencia boolean,
  tem_1a1 boolean,
  apta boolean,
  status text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.mes,
    a.area,
    a.colaborador,
    a.estrutura,
    a.progresso,
    a.progresso_anterior,
    a.evidencias_execucao,
    a.one_a_one,
    a.mudou_progresso,
    a.tem_evidencia,
    a.tem_1a1,
    a.apta,
    CASE WHEN a.apta THEN 'Apta' ELSE 'Desvio' END AS status
  FROM public.eficiencia_gestao_pdi_avaliacao(p_ano) a
  WHERE (p_area IS NULL OR a.area = p_area)
    AND (p_meses IS NULL OR a.mes = ANY (p_meses))
  ORDER BY a.mes, a.apta DESC, a.colaborador;
$$;

COMMENT ON FUNCTION public.eficiencia_gestao_pdi_detalhe(integer, integer[], text) IS
  'Detalhe colaborador×mês Gestão de PDI (apta/desvio) para aba e drill-down.';

GRANT EXECUTE ON FUNCTION public.eficiencia_gestao_pdi_avaliacao(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_gestao_pdi_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_gestao_pdi_detalhe(integer, integer[], text) TO anon, authenticated;

-- Alinha área da planilha ao filtro Eficiência (Contratos e Societário → Contratos)
UPDATE public.sp_gestao_pdi_elegiveis
SET area = 'Contratos'
WHERE area ILIKE 'Contratos%'
  AND area IS DISTINCT FROM 'Contratos';
