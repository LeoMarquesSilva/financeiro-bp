-- Mês corrente: só entra inadimplência de títulos já vencidos (data_vencimento <= hoje).
-- Meses encerrados mantêm corte no último dia do mês.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_corte_vencimento(p_ano integer, p_mes integer)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LEAST(
    (date_trunc('month', make_date(p_ano, GREATEST(1, LEAST(p_mes, 12)), 1)) + interval '1 month - 1 day')::date,
    CURRENT_DATE
  );
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_corte_vencimento(integer, integer) IS
  'Data limite de vencimento para inadimplência do mês: min(último dia do mês, hoje).';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_corte_vencimento(integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  cliente text,
  faturado numeric,
  recebido numeric,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH faturado_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND v.data_vencimento <= public.receita_inadimplencia_corte_vencimento(p_ano, p_mes)
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  ),
  recebido_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  ),
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0))::numeric(15, 2) AS valor_liquido
    FROM faturado_mes f
    FULL OUTER JOIN recebido_mes r ON r.cliente = f.cliente
  )
  SELECT
    n.cliente,
    n.faturado,
    n.recebido,
    n.valor_liquido AS inadimplencia
  FROM net n
  WHERE n.faturado <> 0 OR n.recebido <> 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) IS
  'Inadimplência mensal VIOS. Mês corrente: faturado só de títulos com vencimento <= hoje.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_departamento_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  departamento text,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fim_mes AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p_ano, p_mes) AS dt
  ),
  itens_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      CASE
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= (SELECT dt FROM fim_mes)
             AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
             AND COALESCE(v.valor_item, 0) > 0
          THEN 0::numeric(15, 2)
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= (SELECT dt FROM fim_mes)
          THEN GREATEST(
            0,
            COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
          )::numeric(15, 2)
        ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
      END AS inad_item
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND v.data_vencimento <= (SELECT dt FROM fim_mes)
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      cliente,
      departamento,
      SUM(valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes
    GROUP BY cliente, departamento
  ),
  totais_cliente AS (
    SELECT
      cliente,
      SUM(faturado_dept)::numeric(15, 2) AS faturado,
      SUM(inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept
    GROUP BY cliente
  ),
  cliente_final AS (
    SELECT c.cliente, c.inadimplencia
    FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos) c
    WHERE c.inadimplencia > 0
  ),
  alocado AS (
    SELECT
      d.departamento,
      ROUND(
        SUM(
          cf.inadimplencia * CASE
            WHEN t.inad_itens > 0 THEN d.inad_itens_dept / t.inad_itens
            WHEN t.faturado > 0 THEN d.faturado_dept / t.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept d
    INNER JOIN totais_cliente t ON t.cliente = d.cliente
    INNER JOIN cliente_final cf ON cf.cliente = d.cliente
    WHERE d.inad_itens_dept > 0 OR d.faturado_dept > 0
    GROUP BY d.departamento
  )
  SELECT departamento, inadimplencia
  FROM alocado
  WHERE inadimplencia > 0
  ORDER BY inadimplencia DESC, departamento;
$$;

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
      public.receita_inadimplencia_corte_vencimento(p_ano, m.mes) AS dt
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
      AND v.data_vencimento <= fm.dt
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

-- Atualiza funções de alocação por departamento (itens_mes + corte).

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
  fim_mes AS (
    SELECT
      m.mes,
      public.receita_inadimplencia_corte_vencimento(p_ano, m.mes) AS dt
    FROM meses m
  ),
  cliente_mes_cache AS MATERIALIZED (
    SELECT
      fm.mes,
      c.cliente,
      c.faturado,
      c.inadimplencia
    FROM fim_mes fm
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
      p_ano, fm.mes, p_incluir_inativos
    ) c
    WHERE c.inadimplencia > 0
  ),
  itens_mes AS (
    SELECT
      fm.mes,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
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
      END AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND v.data_vencimento <= fm.dt
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      im.mes,
      im.cliente,
      im.grupo_cliente,
      im.departamento,
      SUM(im.valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(im.inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes im
    GROUP BY im.mes, im.cliente, im.grupo_cliente, im.departamento
  ),
  totais_cliente AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      SUM(pcd.faturado_dept)::numeric(15, 2) AS faturado,
      SUM(pcd.inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept pcd
    GROUP BY pcd.mes, pcd.cliente
  ),
  alocado_mes AS (
    SELECT
      pcd.mes,
      pcd.grupo_cliente,
      pcd.departamento,
      ROUND(
        SUM(
          cm.inadimplencia * CASE
            WHEN tc.inad_itens > 0 THEN pcd.inad_itens_dept / tc.inad_itens
            WHEN tc.faturado > 0 THEN pcd.faturado_dept / tc.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept pcd
    INNER JOIN totais_cliente tc ON tc.mes = pcd.mes AND tc.cliente = pcd.cliente
    INNER JOIN cliente_mes_cache cm ON cm.mes = pcd.mes AND cm.cliente = pcd.cliente
    GROUP BY pcd.mes, pcd.grupo_cliente, pcd.departamento
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
  fim_mes AS (
    SELECT
      m.mes,
      public.receita_inadimplencia_corte_vencimento(p_ano, m.mes) AS dt
    FROM meses m
  ),
  cliente_mes_cache AS MATERIALIZED (
    SELECT
      fm.mes,
      c.cliente,
      c.faturado,
      c.inadimplencia
    FROM fim_mes fm
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
      p_ano, fm.mes, p_incluir_inativos
    ) c
    WHERE c.inadimplencia > 0
  ),
  itens_mes AS (
    SELECT
      fm.mes,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
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
      END AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND v.data_vencimento <= fm.dt
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      im.mes,
      im.cliente,
      im.grupo_cliente,
      im.departamento,
      SUM(im.valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(im.inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes im
    GROUP BY im.mes, im.cliente, im.grupo_cliente, im.departamento
  ),
  totais_cliente AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      SUM(pcd.faturado_dept)::numeric(15, 2) AS faturado,
      SUM(pcd.inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept pcd
    GROUP BY pcd.mes, pcd.cliente
  ),
  alocado_mes AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      pcd.grupo_cliente,
      pcd.departamento,
      ROUND(
        SUM(
          cm.inadimplencia * CASE
            WHEN tc.inad_itens > 0 THEN pcd.inad_itens_dept / tc.inad_itens
            WHEN tc.faturado > 0 THEN pcd.faturado_dept / tc.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept pcd
    INNER JOIN totais_cliente tc ON tc.mes = pcd.mes AND tc.cliente = pcd.cliente
    INNER JOIN cliente_mes_cache cm ON cm.mes = pcd.mes AND cm.cliente = pcd.cliente
    GROUP BY pcd.mes, pcd.cliente, pcd.grupo_cliente, pcd.departamento
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
