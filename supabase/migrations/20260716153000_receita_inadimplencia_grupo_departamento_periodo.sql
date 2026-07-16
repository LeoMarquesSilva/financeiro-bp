-- Inadimplência acumulada por grupo × departamento no período (alocação VIOS proporcional).
-- Usado no filtro por área da seção Inadimplência (top 5 e concentração).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_departamento_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  grupo_cliente text,
  departamento text,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_inicio,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim
  ),
  meses AS (
    SELECT m.mes
    FROM bounds b
    CROSS JOIN generate_series(b.mes_inicio, b.mes_fim) AS m(mes)
  ),
  cliente_grupo AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  faturado_dept AS (
    SELECT
      m.mes,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_dept
    FROM meses m
    INNER JOIN public.receita_itens_inadimplencia_base v ON
      v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = m.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
    GROUP BY m.mes, 2, 3
  ),
  cliente_mes AS (
    SELECT
      m.mes,
      c.cliente,
      c.faturado,
      c.inadimplencia
    FROM meses m
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
      p_ano, m.mes, p_incluir_inativos
    ) c
    WHERE c.inadimplencia > 0
  ),
  alocado_mes AS (
    SELECT
      fd.mes,
      cg.grupo_cliente,
      fd.departamento,
      ROUND(
        SUM(
          cm.inadimplencia * CASE
            WHEN cm.faturado > 0 THEN fd.faturado_dept / cm.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_dept fd
    INNER JOIN cliente_mes cm ON cm.cliente = fd.cliente AND cm.mes = fd.mes
    INNER JOIN cliente_grupo cg ON cg.cliente = fd.cliente
    GROUP BY fd.mes, cg.grupo_cliente, fd.departamento
  )
  SELECT
    am.grupo_cliente,
    am.departamento,
    ROUND(SUM(am.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado_mes am
  GROUP BY am.grupo_cliente, am.departamento
  HAVING ROUND(SUM(am.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, am.grupo_cliente, am.departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_departamento_periodo(integer, integer, integer, boolean) IS
  'Inadimplência acumulada por grupo e departamento no período (alocação VIOS proporcional ao faturado).';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_grupo_departamento_periodo(integer, integer, integer, boolean)
  TO anon, authenticated;
