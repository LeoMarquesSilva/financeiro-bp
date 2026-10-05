-- PDI: Graziane fora a partir de set/2026 (licença-maternidade).
-- Percentual só com evidência, 1:1 e progresso preenchidos.
-- Desvio (0%) só entra quando o critério de apuração também está preenchido.
-- Junho permanece baseline 100%.

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
  ),
  marcado AS (
    SELECT
      b.*,
      (
        b.progresso_anterior IS NOT NULL
        AND b.progresso IS DISTINCT FROM b.progresso_anterior
      ) AS mudou_progresso,
      (lower(trim(coalesce(b.evidencias_execucao, ''))) = 'sim') AS tem_evidencia,
      (coalesce(b.one_a_one, 0) >= 1) AS tem_1a1,
      NULLIF(trim(coalesce(d.desvio_criterio_apuracao, '')), '') AS desvio_criterio
    FROM base b
    LEFT JOIN public.sp_gestao_pdi_desvios d
      ON d.ano = b.ano
     AND d.mes = b.mes
     AND lower(trim(d.colaborador)) = lower(trim(b.colaborador))
  )
  SELECT
    m.ano,
    m.mes,
    m.area,
    m.colaborador,
    m.estrutura,
    m.progresso,
    m.progresso_anterior,
    m.evidencias_execucao,
    m.one_a_one,
    m.mudou_progresso,
    m.tem_evidencia,
    m.tem_1a1,
    CASE
      WHEN m.mes = 6 THEN true
      ELSE (m.mudou_progresso AND m.tem_evidencia AND m.tem_1a1)
    END AS apta
  FROM marcado m
  WHERE NOT (
    lower(m.colaborador) LIKE '%graziane%'
    AND (m.ano > 2026 OR (m.ano = 2026 AND m.mes >= 9))
  )
  AND (
    m.mes = 6
    OR (
      NULLIF(trim(coalesce(m.evidencias_execucao, '')), '') IS NOT NULL
      AND lower(trim(m.evidencias_execucao)) NOT IN ('-', '—', '–')
      AND m.one_a_one IS NOT NULL
      AND m.progresso IS NOT NULL
      AND m.progresso_anterior IS NOT NULL
      AND (
        (m.mudou_progresso AND m.tem_evidencia AND m.tem_1a1)
        OR m.desvio_criterio IS NOT NULL
      )
    )
  );
$$;

COMMENT ON FUNCTION public.eficiencia_gestao_pdi_avaliacao(integer) IS
  'PDI: junho baseline 100%. Julho+ só entra no % com evidência, 1:1 e progresso preenchidos; desvio só com critério de apuração. Graziane fora a partir de set/2026.';
