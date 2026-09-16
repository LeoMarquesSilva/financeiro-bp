-- Overview: anti-join materializado nas exclusões de onboarding + ano sargable.
-- A função escalar eficiencia_onboarding_exclui ainda varria o lookup por linha
-- (~0,8–1,3s por RPC). CTE MATERIALIZED calcula as chaves uma vez.

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
  WITH excl AS MATERIALIZED (
    SELECT chave, vigencia_inicio, vigencia_fim, origem
    FROM public.eficiencia_onboarding_exclusao_chaves
  )
  SELECT
    EXTRACT(MONTH FROM t.conclusao_completa)::integer AS mes,
    COUNT(DISTINCT t.ci) FILTER (
      WHERE t.fatal_apos18 = 'D-1'
        AND (t.excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_d1,
    COUNT(DISTINCT t.ci) FILTER (
      WHERE t.fatal_apos18 = 'FATAL'
        AND (t.excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_fatal,
    COUNT(DISTINCT t.ci) FILTER (
      WHERE t.fatal_apos18 = 'FATAL'
        AND t.excludente = 'Excludente'
    )::integer AS qtd_excludente,
    COUNT(DISTINCT t.ci) FILTER (
      WHERE t.fatal_apos18 IN ('D-1', 'FATAL')
        AND (t.excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT t.ci) FILTER (
          WHERE t.fatal_apos18 = 'D-1'
            AND (t.excludente IS DISTINCT FROM 'Excludente')
        )::numeric
          / NULLIF(
              COUNT(DISTINCT t.ci) FILTER (
                WHERE t.fatal_apos18 IN ('D-1', 'FATAL')
                  AND (t.excludente IS DISTINCT FROM 'Excludente')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia,
    MAX(t.meta_d1) AS meta
  FROM sp_tarefas_historico t
  CROSS JOIN LATERAL (
    SELECT public.eficiencia_onboarding_grupo_chave(t.grupo_cliente) AS k
  ) s
  WHERE t.conclusao_completa >= make_date(p_ano, 1, 1)::timestamptz
    AND t.conclusao_completa < make_date(p_ano + 1, 1, 1)::timestamptz
    AND (p_area IS NULL OR t.area_conclusao = p_area)
    AND t.status = 'Concluída'
    AND t.etiqueta_tarefa = 'PROTOCOLO'
    AND (t.area_conclusao IS NULL OR t.area_conclusao NOT IN ('Tributário', 'Operações Legais'))
    AND (
      t.tarefa IS NULL
      OR t.tarefa NOT IN (
        'MATERIAL MARKETING - REELS/POST/ARTIGO',
        'PROTOCOLO DUE DILIGENCE PROSPECT',
        'PROTOCOLO DUE DILLIGENCE PROSPECT'
      )
    )
    AND (t.tarefa_pai IS NULL OR t.tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
    AND NOT EXISTS (
      SELECT 1
      FROM excl c
      WHERE t.conclusao_completa::date BETWEEN c.vigencia_inicio AND c.vigencia_fim
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

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  dentro_prazo integer,
  fora_prazo integer,
  pct_dentro_prazo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH excl AS MATERIALIZED (
    SELECT chave, vigencia_inicio, vigencia_fim, origem
    FROM public.eficiencia_onboarding_exclusao_chaves
  )
  SELECT
    EXTRACT(MONTH FROM t.data_conclusao)::integer AS mes,
    COUNT(DISTINCT t.ci) FILTER (WHERE t.fatal_sem18_d1 ILIKE 'dentro do prazo') AS dentro_prazo,
    COUNT(DISTINCT t.ci) FILTER (WHERE t.fatal_sem18_d1 ILIKE 'fora do prazo') AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT t.ci) FILTER (WHERE t.fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT t.ci) FILTER (
                WHERE t.fatal_sem18_d1 ILIKE 'dentro do prazo' OR t.fatal_sem18_d1 ILIKE 'fora do prazo'
              ),
              0
            ) * 100,
        0
      ), 2
    ) AS pct_dentro_prazo
  FROM sp_tarefas t
  CROSS JOIN LATERAL (
    SELECT public.eficiencia_onboarding_grupo_chave(t.grupo_cliente) AS k
  ) s
  WHERE t.data_conclusao >= make_date(p_ano, 1, 1)
    AND t.data_conclusao < make_date(p_ano + 1, 1, 1)
    AND (p_area IS NULL OR p_area = 'Operações Legais' OR t.area_conclusao = p_area)
    AND (t.area_conclusao IS NULL OR t.area_conclusao <> 'Tributário')
    AND t.tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
    AND NOT EXISTS (
      SELECT 1
      FROM excl c
      WHERE t.data_conclusao BETWEEN c.vigencia_inicio AND c.vigencia_fim
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

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (mes integer, total integer, vistado_d1 integer, pct_d1 numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH excl AS MATERIALIZED (
    SELECT chave, vigencia_inicio, vigencia_fim, origem
    FROM public.eficiencia_onboarding_exclusao_chaves
  )
  SELECT
    EXTRACT(MONTH FROM t.disponibilizado_vistagem)::integer AS mes,
    COUNT(*) FILTER (WHERE t.vistado_d1 IS NOT NULL) AS total,
    COUNT(*) FILTER (WHERE t.vistado_d1 = 'Sim') AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE t.vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE t.vistado_d1 IS NOT NULL), 0) * 100,
        0
      ), 2
    ) AS pct_d1
  FROM sp_publicacoes t
  CROSS JOIN LATERAL (
    SELECT public.eficiencia_onboarding_grupo_chave(t.grupo) AS k
  ) s
  WHERE t.disponibilizado_vistagem >= make_date(p_ano, 1, 1)::timestamptz
    AND t.disponibilizado_vistagem < make_date(p_ano + 1, 1, 1)::timestamptz
    AND NULLIF(trim(t.vistado_por), '') IS NOT NULL
    AND NOT (p_risco = FALSE AND COALESCE(p_area, '') = 'Trabalhista')
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR t.area = p_area
    )
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND t.demanda_risco IS DISTINCT FROM 'Não'
        AND (t.area IS NULL OR t.area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(t.demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          t.area IS NULL
          OR t.area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista')
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM excl c
      WHERE t.disponibilizado_vistagem::date BETWEEN c.vigencia_inicio AND c.vigencia_fim
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
