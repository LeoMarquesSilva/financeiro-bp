-- SharePoint às vezes grava 2 presenças do mesmo colaborador + sessão (ex.: sp_id 316 e 317).
-- KPI e lista devem contar 1 lançamento.

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_presenca_dedup(p_ano integer)
RETURNS TABLE (
  colaborador text,
  nome_chave text,
  treinamento text,
  data date,
  duracao_minutos numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT DISTINCT ON (
    public.eficiencia_nome_chave(t.colaborador),
    COALESCE(t.treinamento_id::text, t.treinamento, ''),
    t.data
  )
    t.colaborador,
    public.eficiencia_nome_chave(t.colaborador),
    t.treinamento,
    t.data,
    t.duracao_minutos
  FROM public.sp_treinamentos_presenca t
  WHERE t.colaborador IS NOT NULL
    AND t.data IS NOT NULL
    AND EXTRACT(YEAR FROM t.data)::integer = p_ano
  ORDER BY
    public.eficiencia_nome_chave(t.colaborador),
    COALESCE(t.treinamento_id::text, t.treinamento, ''),
    t.data,
    CASE WHEN t.status ILIKE 'finalizado' THEN 0 ELSE 1 END,
    t.sp_id DESC
$$;

COMMENT ON FUNCTION public.eficiencia_treinamentos_presenca_dedup(integer) IS
  'Presenças únicas no ano: uma linha por pessoa + sessão + data (prefere Status Finalizado).';

GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_presenca_dedup(integer) TO anon, authenticated;

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
      tv.area,
      tv.admissao::date AS admissao
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
  filtrados AS (
    SELECT *
    FROM elegiveis e
    WHERE (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  ),
  ativos AS (
    SELECT
      COUNT(*)::integer AS n,
      COALESCE(
        SUM(public.eficiencia_treinamentos_meta_minutos_pessoa(f.admissao, p_ano)),
        0
      ) AS meta_minutos
    FROM filtrados f
  ),
  minutos AS (
    SELECT COALESCE(SUM(t.duracao_minutos), 0) AS v
    FROM public.eficiencia_treinamentos_presenca_dedup(p_ano) t
    INNER JOIN filtrados f ON f.nome_chave = t.nome_chave
  )
  SELECT
    minutos.v,
    ativos.n,
    ativos.meta_minutos,
    ROUND(COALESCE(minutos.v / NULLIF(ativos.meta_minutos, 0) * 100, 0), 2) AS pct_atingimento
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
      tv.area,
      tv.admissao::date AS admissao
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
  filtrados AS (
    SELECT *
    FROM elegiveis e
    WHERE (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  ),
  meta_ano AS (
    SELECT COALESCE(
      SUM(public.eficiencia_treinamentos_meta_minutos_pessoa(f.admissao, p_ano)),
      0
    ) AS minutos
    FROM filtrados f
  ),
  por_mes AS (
    SELECT
      EXTRACT(MONTH FROM t.data)::integer AS mes,
      COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados
    FROM public.eficiencia_treinamentos_presenca_dedup(p_ano) t
    INNER JOIN filtrados f ON f.nome_chave = t.nome_chave
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

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_por_pessoa(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  colaborador text,
  minutos_lancados numeric,
  horas_formatadas text,
  admissao date,
  meses_elegiveis integer,
  meta_minutos numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH elegiveis AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.area,
      tv.admissao::date AS admissao
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
  )
  SELECT
    t.colaborador,
    COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados,
    LPAD((FLOOR(COALESCE(SUM(t.duracao_minutos), 0) / 60))::text, 2, '0') || ':' ||
      LPAD((MOD(COALESCE(SUM(t.duracao_minutos), 0)::integer, 60))::text, 2, '0') AS horas_formatadas,
    e.admissao,
    public.eficiencia_treinamentos_meses_elegiveis(e.admissao, p_ano) AS meses_elegiveis,
    public.eficiencia_treinamentos_meta_minutos_pessoa(e.admissao, p_ano) AS meta_minutos
  FROM public.eficiencia_treinamentos_presenca_dedup(p_ano) t
  INNER JOIN elegiveis e ON e.nome_chave = t.nome_chave
  WHERE t.colaborador IS NOT NULL
    AND (p_area IS NULL OR e.area = p_area)
    AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  GROUP BY t.colaborador, e.admissao
  ORDER BY minutos_lancados DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_acumulado_ate(
  p_ano integer,
  p_data_corte date,
  p_area text DEFAULT NULL
)
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
    FROM public.eficiencia_treinamentos_presenca_dedup(p_ano) t
    INNER JOIN elegiveis e ON e.nome_chave = t.nome_chave
    WHERE t.data <= p_data_corte
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
