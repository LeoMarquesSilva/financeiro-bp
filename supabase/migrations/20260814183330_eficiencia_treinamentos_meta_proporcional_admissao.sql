-- Meta de treinamentos proporcional à admissão no ano.
-- Regra: 14h/ano = 12 meses. Se admitido no ano:
--   - dia <= 15 → conta a partir do mês da admissão
--   - dia > 15  → conta a partir do mês subsequente
-- Admitidos em anos anteriores: 12 meses (14h).

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_meses_elegiveis(
  p_admissao date,
  p_ano integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_admissao IS NULL THEN 12
    WHEN EXTRACT(YEAR FROM p_admissao)::integer < p_ano THEN 12
    WHEN EXTRACT(YEAR FROM p_admissao)::integer > p_ano THEN 0
    ELSE GREATEST(
      0,
      12 - (
        CASE
          WHEN EXTRACT(DAY FROM p_admissao)::integer > 15
            THEN EXTRACT(MONTH FROM p_admissao)::integer + 1
          ELSE EXTRACT(MONTH FROM p_admissao)::integer
        END
      ) + 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_meta_minutos_pessoa(
  p_admissao date,
  p_ano integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    (14 * 60) * public.eficiencia_treinamentos_meses_elegiveis(p_admissao, p_ano) / 12.0,
    2
  )
$$;

COMMENT ON FUNCTION public.eficiencia_treinamentos_meses_elegiveis(date, integer) IS
  'Meses elegíveis de treinamento no ano (corte dia > 15 → mês seguinte).';
COMMENT ON FUNCTION public.eficiencia_treinamentos_meta_minutos_pessoa(date, integer) IS
  'Meta individual em minutos: 14h × meses_elegíveis / 12.';

DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_anual(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_por_pessoa(integer, text);

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
    FROM sp_treinamentos_presenca t
    INNER JOIN filtrados f
      ON f.nome_chave = public.eficiencia_nome_chave(t.colaborador)
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
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
    FROM sp_treinamentos_presenca t
    INNER JOIN filtrados f
      ON f.nome_chave = public.eficiencia_nome_chave(t.colaborador)
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
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
  FROM sp_treinamentos_presenca t
  INNER JOIN elegiveis e
    ON e.nome_chave = public.eficiencia_nome_chave(t.colaborador)
  WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
    AND t.colaborador IS NOT NULL
    AND (p_area IS NULL OR e.area = p_area)
    AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  GROUP BY t.colaborador, e.admissao
  ORDER BY minutos_lancados DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) IS
  'Treinamentos anual: meta = soma das metas proporcionais à admissão (14h × meses/12).';
COMMENT ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) IS
  'Treinamentos mensal: % vs meta anual proporcional (mesma base do anual).';
COMMENT ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer, text) IS
  'Treinamentos por pessoa com meta proporcional (admissão / corte dia 15).';

GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_meses_elegiveis(date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_meta_minutos_pessoa(date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer, text) TO anon, authenticated;
