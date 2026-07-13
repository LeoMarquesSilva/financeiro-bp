-- Restaura regra de pagamento antecipado: item com vencimento no mês M quitado até o
-- último dia de M não é inadimplente em M (ex.: pago 30/04, vence 01/05).
-- A regra proporcional por calendário (faturado no mês do vencimento − recebido no mês
-- do pagamento) tratava antecipação como inadimplência no mês do vencimento.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_mes(
  p_ano integer,
  p_mes integer
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
  WITH fim_mes AS (
    SELECT (date_trunc('month', make_date(p_ano, p_mes, 1)) + interval '1 month - 1 day')::date AS dt
  ),
  itens_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      COALESCE(v.valor_pago_item, 0)::numeric(15, 2) AS valor_pago_item,
      v.data_pagamento,
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
      END AS inad_item,
      CASE
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= (SELECT dt FROM fim_mes)
          THEN COALESCE(v.valor_pago_item, 0)
        ELSE 0
      END::numeric(15, 2) AS recebido_item
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
  ),
  por_cliente AS (
    SELECT
      i.cliente,
      SUM(i.valor_item)::numeric(15, 2) AS faturado,
      SUM(i.recebido_item)::numeric(15, 2) AS recebido,
      SUM(i.inad_item)::numeric(15, 2) AS inad_itens
    FROM itens_mes i
    GROUP BY i.cliente
  )
  SELECT
    c.cliente,
    c.faturado,
    c.recebido,
    c.inad_itens AS inadimplencia
  FROM por_cliente c
  WHERE c.faturado > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer) IS
  'Inadimplência mensal por cliente: itens com vencimento no mês M; quitados até o fim de M (inclui antecipado) não entram.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_mes(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  grupo_cliente text,
  faturado numeric,
  recebido numeric,
  inadimplencia numeric,
  qtd_clientes integer,
  qtd_clientes_inad integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cliente_grupo AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_elegiveis v
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  cliente_inad AS (
    SELECT * FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes)
  )
  SELECT
    cg.grupo_cliente,
    ROUND(SUM(ci.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(ci.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(SUM(ci.inadimplencia), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_clientes,
    COUNT(*) FILTER (WHERE ci.inadimplencia > 0)::integer AS qtd_clientes_inad
  FROM cliente_inad ci
  INNER JOIN cliente_grupo cg ON cg.cliente = ci.cliente
  GROUP BY cg.grupo_cliente
  ORDER BY inadimplencia DESC, cg.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer) IS
  'Inadimplência mensal por grupo: soma dos saldos por cliente (antecipado não conta).';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
  faturado numeric,
  recebido numeric,
  valor_liquido numeric,
  valor numeric,
  qtd_meses integer
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
    SELECT generate_series(b.mes_inicio, b.mes_fim)::integer AS mes
    FROM bounds b
  ),
  mensal AS (
    SELECT
      m.mes,
      c.cliente,
      c.faturado,
      c.recebido,
      c.inadimplencia
    FROM meses m
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(p_ano, m.mes) c
  ),
  grupo_lookup AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_elegiveis v
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  )
  SELECT
    b.cliente,
    COALESCE(g.grupo_cliente, 'Sem grupo') AS grupo_cliente,
    ROUND(SUM(b.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(b.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(SUM(b.faturado) - SUM(b.recebido), 2)::numeric(15, 2) AS valor_liquido,
    ROUND(SUM(b.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(*) FILTER (WHERE b.inadimplencia > 0)::integer AS qtd_meses
  FROM mensal b
  LEFT JOIN grupo_lookup g ON g.cliente = b.cliente
  GROUP BY b.cliente, COALESCE(g.grupo_cliente, 'Sem grupo');
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer) IS
  'Saldo do período por cliente: soma mensal com regra de antecipado (cohort por vencimento).';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupos_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  grupo_cliente text,
  valor numeric,
  qtd_meses integer,
  qtd_clientes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.grupo_cliente,
    ROUND(SUM(n.valor), 2)::numeric(15, 2) AS valor,
    MAX(n.qtd_meses)::integer AS qtd_meses,
    COUNT(*) FILTER (WHERE n.valor > 0)::integer AS qtd_clientes
  FROM public.receita_inadimplencia_periodo_net_clientes(p_ano, p_mes_inicio, p_mes_fim) n
  GROUP BY n.grupo_cliente
  HAVING SUM(n.valor) > 0
  ORDER BY valor DESC, n.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer) IS
  'Inadimplência do período por grupo — soma dos saldos mensais (antecipado não conta).';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_cliente text
)
RETURNS TABLE (
  mes integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  plano_contas text,
  situacao_titulo text,
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
    INNER JOIN public.receita_itens_inadimplencia_elegiveis v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
    WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
  )
  SELECT
    it.mes,
    it.ci_titulo,
    MAX(it.nro_titulo) AS nro_titulo,
    MAX(it.descricao) AS descricao,
    MAX(it.plano_contas) AS plano_contas,
    MAX(it.situacao_titulo) AS situacao_titulo,
    MIN(it.data_vencimento) AS data_vencimento,
    MAX(it.data_pagamento) AS data_pagamento,
    SUM(it.valor_item)::numeric(15, 2) AS valor_item,
    SUM(it.valor_pago_item)::numeric(15, 2) AS valor_pago_item,
    SUM(it.inad_item)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_itens
  FROM itens it
  WHERE it.inad_item > 0
  GROUP BY it.mes, it.ci_titulo
  HAVING SUM(it.inad_item) > 0
  ORDER BY it.mes, SUM(it.inad_item) DESC, MAX(it.nro_titulo);
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) IS
  'Títulos inadimplentes no período (cohort vencimento); antecipado quitado até o fim do mês não aparece.';
