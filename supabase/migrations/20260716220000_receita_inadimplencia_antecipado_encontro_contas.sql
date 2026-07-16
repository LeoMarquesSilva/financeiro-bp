-- Restaura as duas regras mensais (não remover):
-- 1) Antecipado por item: quitado até o corte do mês → saldo do item = 0.
-- 2) Encontro de contas (Lira): inad = min(saldo itens, max(0, faturado − recebido no calendário do mês)).

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
  WITH corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p_ano, p_mes) AS dt
  ),
  itens_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      (
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT dt FROM corte)
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT dt FROM corte)
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inad_item
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND v.data_vencimento <= (SELECT dt FROM corte)
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente AS (
    SELECT
      im.cliente,
      ROUND(SUM(im.valor_item), 2)::numeric(15, 2) AS faturado,
      ROUND(SUM(im.inad_item), 2)::numeric(15, 2) AS inad_itens
    FROM itens_mes im
    GROUP BY im.cliente
  ),
  recebido_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      ROUND(SUM(COALESCE(v.valor_pago_item, 0)), 2)::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  )
  SELECT
    c.cliente,
    c.faturado,
    COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
    (
      CASE
        WHEN COALESCE(r.recebido, 0) >= c.faturado AND c.faturado > 0 THEN 0::numeric(15, 2)
        WHEN c.inad_itens <= 0 THEN 0::numeric(15, 2)
        ELSE LEAST(
          c.inad_itens,
          GREATEST(0, c.faturado - COALESCE(r.recebido, 0))
        )::numeric(15, 2)
      END
    ) AS inadimplencia
  FROM por_cliente c
  LEFT JOIN recebido_mes r ON r.cliente = c.cliente
  WHERE c.faturado > 0
    AND (
      CASE
        WHEN COALESCE(r.recebido, 0) >= c.faturado AND c.faturado > 0 THEN 0::numeric(15, 2)
        WHEN c.inad_itens <= 0 THEN 0::numeric(15, 2)
        ELSE LEAST(
          c.inad_itens,
          GREATEST(0, c.faturado - COALESCE(r.recebido, 0))
        )::numeric(15, 2)
      END
    ) > 0
  ORDER BY inadimplencia DESC, c.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) IS
  'Inadimplência mensal: antecipado zera item; encontro de contas = min(saldo itens, faturado − recebido no calendário do mês).';

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
  ),
  por_mes_cliente AS (
    SELECT
      it.mes,
      ROUND(SUM(it.inad_item), 2)::numeric(15, 2) AS inad_itens,
      ROUND(SUM(it.valor_item), 2)::numeric(15, 2) AS faturado
    FROM itens it
    GROUP BY it.mes
  ),
  recebido_mes AS (
    SELECT
      fm.mes,
      COALESCE((
        SELECT ROUND(SUM(COALESCE(v.valor_pago_item, 0)), 2)::numeric(15, 2)
        FROM public.receita_itens_inadimplencia_base v
        INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
        WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
          AND v.data_pagamento IS NOT NULL
          AND v.valor_pago_item IS NOT NULL
          AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
          AND EXTRACT(MONTH FROM v.data_pagamento)::integer = fm.mes
          AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
      ), 0)::numeric(15, 2) AS recebido
    FROM fim_mes fm
  ),
  cap_mes AS (
    SELECT
      p.mes,
      p.inad_itens,
      p.faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (
        CASE
          WHEN COALESCE(r.recebido, 0) >= p.faturado AND p.faturado > 0 THEN 0::numeric(15, 2)
          WHEN p.inad_itens <= 0 THEN 0::numeric(15, 2)
          ELSE LEAST(
            p.inad_itens,
            GREATEST(0, p.faturado - COALESCE(r.recebido, 0))
          )::numeric(15, 2)
        END
      ) AS inad_cap
    FROM por_mes_cliente p
    LEFT JOIN recebido_mes r ON r.mes = p.mes
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
    ROUND(
      SUM(it.inad_item)
      * CASE
          WHEN cm.inad_itens > 0 AND cm.inad_cap < cm.inad_itens
            THEN cm.inad_cap / cm.inad_itens
          WHEN cm.inad_cap <= 0 THEN 0
          ELSE 1
        END,
      2
    )::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_itens
  FROM itens it
  INNER JOIN cap_mes cm ON cm.mes = it.mes
  WHERE it.inad_item > 0
    AND cm.inad_cap > 0
  GROUP BY it.mes, it.ci_titulo, it.departamento, cm.inad_itens, cm.inad_cap
  HAVING ROUND(
    SUM(it.inad_item)
    * CASE
        WHEN cm.inad_itens > 0 AND cm.inad_cap < cm.inad_itens
          THEN cm.inad_cap / cm.inad_itens
        WHEN cm.inad_cap <= 0 THEN 0
        ELSE 1
      END,
    2
  ) > 0
  ORDER BY it.mes, SUM(it.inad_item) DESC, MAX(it.nro_titulo);
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  integer, integer, integer, text, boolean
) IS
  'Títulos inadimplentes no período: antecipado por item + encontro de contas (Lira) proporcional nos títulos.';
