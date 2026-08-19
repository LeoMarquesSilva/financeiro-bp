-- Série diária do SLA Protocolo (drill-down por mês no gráfico de evolução).

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  dia integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_excludente integer,
  qtd_total integer,
  pct_eficiencia numeric,
  meta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DAY FROM conclusao_completa)::integer AS dia,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'D-1'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND excludente = 'Excludente'
    )::integer AS qtd_excludente,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 IN ('D-1', 'FATAL')
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (
          WHERE fatal_apos18 = 'D-1'
            AND (excludente IS DISTINCT FROM 'Excludente')
        )::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_apos18 IN ('D-1', 'FATAL')
                  AND (excludente IS DISTINCT FROM 'Excludente')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
    AND EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes
    AND (p_area IS NULL OR area_conclusao = p_area)
    AND status = 'Concluída'
    AND etiqueta_tarefa = 'PROTOCOLO'
    AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
    AND (
      tarefa IS NULL
      OR tarefa NOT IN (
        'MATERIAL MARKETING - REELS/POST/ARTIGO',
        'PROTOCOLO DUE DILIGENCE PROSPECT',
        'PROTOCOLO DUE DILLIGENCE PROSPECT'
      )
    )
    AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_diario(integer, integer, text) IS
  'SLA Protocolo por dia civil (conclusao_completa) dentro de um mês. Mesmos filtros do mensal.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_diario(integer, integer, text)
  TO anon, authenticated;
