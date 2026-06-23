-- Período (ex.: jan–mai): inadimplência avaliada no ÚLTIMO dia do mês fim.
-- Título quitado em abril não entra na visão jan–mai.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
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
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_ini,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim,
      (date_trunc('month', make_date(p_ano, GREATEST(1, LEAST(p_mes_fim, 12)), 1)) + interval '1 month - 1 day')::date AS fim_periodo
  ),
  itens AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      EXTRACT(MONTH FROM v.data_vencimento)::integer AS mes_venc,
      (
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT fim_periodo FROM bounds)
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT fim_periodo FROM bounds)
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inadimplencia
    FROM public.receita_itens_inadimplencia_elegiveis v
    CROSS JOIN bounds b
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_ini AND b.mes_fim
  )
  SELECT
    i.cliente,
    ROUND(SUM(i.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(DISTINCT i.mes_venc) FILTER (WHERE i.inadimplencia > 0)::integer AS qtd_meses
  FROM itens i
  WHERE i.inadimplencia > 0
  GROUP BY i.cliente
  ORDER BY valor DESC, i.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer) IS
  'Clientes inadimplentes no período — saldo em aberto no último dia do mês fim (não soma histórico mensal).';

DROP FUNCTION IF EXISTS public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text);

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
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_ini,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim,
      (date_trunc('month', make_date(p_ano, GREATEST(1, LEAST(p_mes_fim, 12)), 1)) + interval '1 month - 1 day')::date AS fim_periodo
  ),
  itens AS (
    SELECT
      EXTRACT(MONTH FROM v.data_vencimento)::integer AS mes,
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
               AND v.data_pagamento <= (SELECT fim_periodo FROM bounds)
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT fim_periodo FROM bounds)
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inadimplencia
    FROM public.receita_itens_inadimplencia_elegiveis v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
    CROSS JOIN bounds b
    WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_ini AND b.mes_fim
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
    SUM(it.inadimplencia)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_itens
  FROM itens it
  WHERE it.inadimplencia > 0
  GROUP BY it.mes, it.ci_titulo
  ORDER BY it.mes, SUM(it.inadimplencia) DESC, MAX(it.nro_titulo);
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) IS
  'Títulos ainda em aberto no fim do período (mês fim), agrupados por vencimento/título.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) TO anon, authenticated;
