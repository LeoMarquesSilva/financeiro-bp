-- SLA Protocolo mensal: filtro de ano sargable + índice parcial.
-- EXTRACT(YEAR FROM conclusao_completa) impedia o índice e estourava
-- statement_timeout (57014) no cron das 08:00 do relatório gestão à vista.

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_protocolo_concluida_conclusao_idx
  ON public.sp_tarefas_historico (conclusao_completa)
  WHERE etiqueta_tarefa = 'PROTOCOLO' AND status = 'Concluída';

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
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
SET statement_timeout = '30s'
AS $$
  SELECT
    EXTRACT(MONTH FROM conclusao_completa)::integer AS mes,
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
  WHERE conclusao_completa >= make_date(p_ano, 1, 1)::timestamptz
    AND conclusao_completa < make_date(p_ano + 1, 1, 1)::timestamptz
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
    AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) IS
  'SLA de Protocolo mensal (sp_tarefas_historico): D-1 vs FATAL. Filtro de ano por intervalo em conclusao_completa (índice) + exclusão de onboarding.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text)
  TO anon, authenticated;
