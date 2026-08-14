-- Horas de treinamento acumuladas no ano até uma data (gestão à vista / e-mail diário).

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
    FROM sp_treinamentos_presenca t
    INNER JOIN elegiveis e
      ON e.nome_chave = public.eficiencia_nome_chave(t.colaborador)
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND t.data <= p_data_corte
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

COMMENT ON FUNCTION public.eficiencia_treinamentos_acumulado_ate(integer, date, text) IS
  'Treinamentos YTD até p_data_corte: minutos vs meta anual (pessoas × 14h). Mesma população de eficiencia_treinamentos_anual.';

GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_acumulado_ate(integer, date, text) TO anon, authenticated;
