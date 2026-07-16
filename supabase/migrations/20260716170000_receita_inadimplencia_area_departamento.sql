-- Alocação VIOS por cliente × departamento (drill-down do filtro por área).
-- Inclui departamento nos títulos do detalhe por cliente.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  cliente text,
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
      fd.cliente,
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
    GROUP BY fd.mes, fd.cliente, cg.grupo_cliente, fd.departamento
  )
  SELECT
    am.cliente,
    am.grupo_cliente,
    am.departamento,
    ROUND(SUM(am.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado_mes am
  GROUP BY am.cliente, am.grupo_cliente, am.departamento
  HAVING ROUND(SUM(am.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, am.grupo_cliente, am.cliente, am.departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(integer, integer, integer, boolean) IS
  'Inadimplência acumulada por cliente e departamento no período (alocação VIOS proporcional ao faturado).';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(integer, integer, integer, boolean)
  TO anon, authenticated;

DROP FUNCTION IF EXISTS public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_cliente text,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  mes integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  plano_contas text,
  situacao_titulo text,
  departamento text,
  data_vencimento date,
  data_pagamento date,
  valor_item numeric,
  valor_pago_item numeric,
  inadimplencia numeric,
  qtd_itens integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses AS (
    SELECT generate_series(
      GREATEST(1, LEAST(p_mes_inicio, 12)),
      GREATEST(1, LEAST(p_mes_fim, 12))
    )::integer AS mes
  ),
  fim_mes AS (
    SELECT
      m.mes,
      (date_trunc('month', make_date(p_ano, m.mes, 1)) + interval '1 month - 1 day')::date AS dt
    FROM meses m
  ),
  itens AS (
    SELECT
      fm.mes,
      v.ci_titulo,
      COALESCE(NULLIF(trim(fp.nro_titulo), ''), v.ci_titulo::text) AS nro_titulo,
      COALESCE(NULLIF(trim(i.descricao), ''), NULLIF(trim(fp.descricao), '')) AS descricao,
      NULLIF(trim(v.plano_contas), '') AS plano_contas,
      NULLIF(trim(v.situacao_titulo), '') AS situacao_titulo,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      v.data_vencimento,
      v.data_pagamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      COALESCE(v.valor_pago_item, 0)::numeric(15, 2) AS valor_pago_item,
      (
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= fm.dt
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= fm.dt
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
    WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  )
  SELECT
    it.mes,
    it.ci_titulo,
    MAX(it.nro_titulo) AS nro_titulo,
    MAX(it.descricao) AS descricao,
    MAX(it.plano_contas) AS plano_contas,
    MAX(it.situacao_titulo) AS situacao_titulo,
    it.departamento,
    MIN(it.data_vencimento) AS data_vencimento,
    MAX(it.data_pagamento) AS data_pagamento,
    SUM(it.valor_item)::numeric(15, 2) AS valor_item,
    SUM(it.valor_pago_item)::numeric(15, 2) AS valor_pago_item,
    SUM(it.inad_item)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_itens
  FROM itens it
  WHERE it.inad_item > 0
  GROUP BY it.mes, it.ci_titulo, it.departamento
  HAVING SUM(it.inad_item) > 0
  ORDER BY it.mes, SUM(it.inad_item) DESC, MAX(it.nro_titulo);
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  integer, integer, integer, text, boolean
) IS
  'Títulos inadimplentes no período por departamento. p_incluir_inativos=true alinha ao KPI acumulado.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text, boolean) TO anon, authenticated;
