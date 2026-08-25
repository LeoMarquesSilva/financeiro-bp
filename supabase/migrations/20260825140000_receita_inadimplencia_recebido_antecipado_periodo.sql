-- Pagamento antecipado do título do período conta no recebido (ex.: Extrutech
-- CI 11995, venc. 05/08, pago 30/07). Sem isso, grupo_mes/card mostram faturado
-- sem caixa — o snapshot só via data_pagamento no mês.
-- Estende periodo_net_clientes; cada item entra uma vez (OR, sem duplicar).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false,
  p_baixa_posterior boolean DEFAULT true
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
  corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(
      p_ano,
      (SELECT mes_fim FROM bounds)
    ) AS dt
  ),
  faturado_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado,
      COUNT(DISTINCT EXTRACT(MONTH FROM v.data_vencimento)::integer) FILTER (
        WHERE COALESCE(v.valor_item, 0) > 0
      )::integer AS qtd_meses
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    CROSS JOIN corte c
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND v.data_vencimento <= c.dt
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2
  ),
  recebido_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    CROSS JOIN corte c
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
      AND (
        (
          EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
          AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
        )
        OR (
          v.data_vencimento IS NOT NULL
          AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
          AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
          AND v.data_vencimento <= c.dt
          AND v.data_pagamento <= c.dt
        )
        OR (
          p_baixa_posterior
          AND v.data_vencimento IS NOT NULL
          AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
          AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
          AND v.data_vencimento <= c.dt
          AND v.data_pagamento > c.dt
        )
      )
    GROUP BY 1
  ),
  grupo_lookup AS (
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
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.grupo_cliente, g.grupo_cliente, 'Sem grupo') AS grupo_cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0))::numeric(15, 2) AS valor_liquido,
      COALESCE(f.qtd_meses, 0)::integer AS qtd_meses
    FROM faturado_periodo f
    FULL OUTER JOIN recebido_periodo r ON r.cliente = f.cliente
    LEFT JOIN grupo_lookup g ON g.cliente = COALESCE(f.cliente, r.cliente)
  )
  SELECT
    n.cliente,
    n.grupo_cliente,
    n.faturado,
    n.recebido,
    n.valor_liquido,
    GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS valor,
    n.qtd_meses
  FROM net n;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer, boolean, boolean) IS
  'Saldo líquido do período. Faturado: só vencidos. Recebido: caixa do intervalo + quitação antecipada do título do período até o corte + (se p_baixa_posterior) pagamentos posteriores.';

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) IS
  'Snapshot do mês (sem baixa posterior; com antecipado do título do mês). Usado na evolução / sheet mensal; meses congelados exibem o fechamento.';
