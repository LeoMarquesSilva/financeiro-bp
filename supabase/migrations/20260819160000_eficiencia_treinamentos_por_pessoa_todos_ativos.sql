-- Lista todos os colaboradores elegíveis (turnover ativo), mesmo sem lançamento de treinamento.

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
      tv.nome AS colaborador,
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

COMMENT ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer, text) IS
  'Treinamentos por colaborador elegível (turnover ativo). Inclui quem ainda não tem lançamento (0 min).';

GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer, text) TO anon, authenticated;
