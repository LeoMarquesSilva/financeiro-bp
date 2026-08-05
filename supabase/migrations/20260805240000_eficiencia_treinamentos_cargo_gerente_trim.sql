-- Exclusão de gestores no headcount de treinamentos: trim + UPPER
-- (ex.: "GERENTE " no turnover não batia com 'Gerente' e inflava 42 → 43).

DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_anual(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_mensal(integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_anual(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  minutos_lancados numeric,
  pessoas_ativas integer,
  meta_minutos numeric,
  pct_atingimento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH elegiveis AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.area
    FROM sp_turnover tv
    WHERE public.eficiencia_nome_chave(tv.nome) IS NOT NULL
      AND EXTRACT(YEAR FROM tv.admissao)::integer <= p_ano
      AND (tv.desligamento IS NULL OR EXTRACT(YEAR FROM tv.desligamento)::integer > p_ano)
      AND (
        tv.cargo IS NULL
        OR upper(trim(tv.cargo)) NOT IN (
          'COORDENADOR OPS. LEGAIS',
          'GERENTE',
          'SÓCIO DE ÁREA',
          'SUPERVISOR OPS. LEGAIS'
        )
      )
    ORDER BY
      public.eficiencia_nome_chave(tv.nome),
      tv.admissao DESC NULLS LAST
  ),
  ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM elegiveis e
    WHERE (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  ),
  minutos AS (
    SELECT COALESCE(SUM(t.duracao_minutos), 0) AS v
    FROM sp_treinamentos_presenca t
    INNER JOIN elegiveis e
      ON e.nome_chave = public.eficiencia_nome_chave(t.colaborador)
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  )
  SELECT
    minutos.v,
    ativos.n,
    (ativos.n * 14 * 60)::numeric AS meta_minutos,
    ROUND(COALESCE(minutos.v / NULLIF(ativos.n * 14 * 60, 0) * 100, 0), 2) AS pct_atingimento
  FROM minutos, ativos;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  minutos_lancados numeric,
  meta_minutos numeric,
  pct_atingimento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH elegiveis AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.area
    FROM sp_turnover tv
    WHERE public.eficiencia_nome_chave(tv.nome) IS NOT NULL
      AND EXTRACT(YEAR FROM tv.admissao)::integer <= p_ano
      AND (tv.desligamento IS NULL OR EXTRACT(YEAR FROM tv.desligamento)::integer > p_ano)
      AND (
        tv.cargo IS NULL
        OR upper(trim(tv.cargo)) NOT IN (
          'COORDENADOR OPS. LEGAIS',
          'GERENTE',
          'SÓCIO DE ÁREA',
          'SUPERVISOR OPS. LEGAIS'
        )
      )
    ORDER BY
      public.eficiencia_nome_chave(tv.nome),
      tv.admissao DESC NULLS LAST
  ),
  ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM elegiveis e
    WHERE (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  ),
  meta_ano AS (
    SELECT (ativos.n * 14 * 60)::numeric AS minutos FROM ativos
  ),
  por_mes AS (
    SELECT
      EXTRACT(MONTH FROM t.data)::integer AS mes,
      COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados
    FROM sp_treinamentos_presenca t
    INNER JOIN elegiveis e
      ON e.nome_chave = public.eficiencia_nome_chave(t.colaborador)
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
    GROUP BY 1
  )
  SELECT
    por_mes.mes,
    por_mes.minutos_lancados,
    meta_ano.minutos AS meta_minutos,
    ROUND(
      COALESCE(por_mes.minutos_lancados / NULLIF(meta_ano.minutos, 0) * 100, 0),
      2
    ) AS pct_atingimento
  FROM por_mes, meta_ano
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) TO anon, authenticated;
