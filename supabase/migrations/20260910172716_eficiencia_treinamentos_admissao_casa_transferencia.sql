-- Meta de treinamento: transferência de área não reseta a admissão.
-- Usa a data de entrada no vínculo atual (antes da cadeia de Transferência),
-- não a data em que a pessoa mudou de setor.

CREATE OR REPLACE FUNCTION public.eficiencia_turnover_eh_transferencia(p_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(trim(extensions.unaccent(coalesce(p_tipo, '')))) = 'TRANSFERENCIA'
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_admissao_casa(
  p_nome_chave text,
  p_ano integer
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH pessoa AS (
    SELECT
      tv.admissao::date AS admissao,
      tv.desligamento::date AS desligamento,
      tv.tipo_desligamento
    FROM sp_turnover tv
    WHERE public.eficiencia_nome_chave(tv.nome) = p_nome_chave
  ),
  atual AS (
    SELECT admissao
    FROM pessoa
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
    ORDER BY admissao DESC NULLS LAST
    LIMIT 1
  ),
  saida_real AS (
    SELECT MAX(p.desligamento) AS dt
    FROM pessoa p
    CROSS JOIN atual a
    WHERE p.desligamento IS NOT NULL
      AND p.desligamento < a.admissao
      AND NOT public.eficiencia_turnover_eh_transferencia(p.tipo_desligamento)
  )
  SELECT MIN(p.admissao)
  FROM pessoa p
  CROSS JOIN atual a
  WHERE p.admissao <= a.admissao
    AND (
      (SELECT dt FROM saida_real) IS NULL
      OR p.admissao > (SELECT dt FROM saida_real)
    );
$$;

COMMENT ON FUNCTION public.eficiencia_treinamentos_admissao_casa(text, integer) IS
  'Admissão para meta de treinamento: primeira entrada do vínculo atual, ignorando mudança de setor (Transferência).';

GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_eh_transferencia(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_admissao_casa(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_anual(
  p_ano integer,
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
  WITH vinculo_atual AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.area,
      tv.admissao::date AS admissao_setor
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
  elegiveis AS (
    SELECT
      v.nome_chave,
      v.area,
      COALESCE(
        public.eficiencia_treinamentos_admissao_casa(v.nome_chave, p_ano),
        v.admissao_setor
      ) AS admissao
    FROM vinculo_atual v
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

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
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
  WITH vinculo_atual AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.area,
      tv.admissao::date AS admissao_setor
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
  elegiveis AS (
    SELECT
      v.nome_chave,
      v.area,
      COALESCE(
        public.eficiencia_treinamentos_admissao_casa(v.nome_chave, p_ano),
        v.admissao_setor
      ) AS admissao
    FROM vinculo_atual v
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
  WITH vinculo_atual AS (
    SELECT DISTINCT ON (public.eficiencia_nome_chave(tv.nome))
      public.eficiencia_nome_chave(tv.nome) AS nome_chave,
      tv.nome AS colaborador,
      tv.area,
      tv.admissao::date AS admissao_setor
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
  elegiveis AS (
    SELECT
      v.nome_chave,
      v.colaborador,
      v.area,
      COALESCE(
        public.eficiencia_treinamentos_admissao_casa(v.nome_chave, p_ano),
        v.admissao_setor
      ) AS admissao
    FROM vinculo_atual v
  ),
  filtrados AS (
    SELECT *
    FROM elegiveis e
    WHERE (p_area IS NULL OR e.area = p_area)
      AND (p_area IS NOT NULL OR e.area IS NULL OR e.area <> 'Tributário')
  ),
  minutos_pessoa AS (
    SELECT
      t.nome_chave,
      COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados
    FROM public.eficiencia_treinamentos_presenca_dedup(p_ano) t
    GROUP BY t.nome_chave
  )
  SELECT
    f.colaborador,
    COALESCE(m.minutos_lancados, 0) AS minutos_lancados,
    LPAD((FLOOR(COALESCE(m.minutos_lancados, 0) / 60))::text, 2, '0') || ':' ||
      LPAD((MOD(COALESCE(m.minutos_lancados, 0)::integer, 60))::text, 2, '0') AS horas_formatadas,
    f.admissao,
    public.eficiencia_treinamentos_meses_elegiveis(f.admissao, p_ano) AS meses_elegiveis,
    public.eficiencia_treinamentos_meta_minutos_pessoa(f.admissao, p_ano) AS meta_minutos
  FROM filtrados f
  LEFT JOIN minutos_pessoa m ON m.nome_chave = f.nome_chave
  ORDER BY minutos_lancados DESC, f.colaborador ASC;
$$;
