-- Desconto concedido não é inadimplência.
-- Título PAGO com valor pago menor que o item e sem saldo em aberto: o VIOS
-- não gera título novo. A diferença é desconto (ex.: Brasloop CI 10995,
-- R$ 2.500 faturados, R$ 1.500 pagos, R$ 1.000 de desconto).
-- Pago a menor gera outro título; a dívida fica nesse título, se ainda estiver ABERTO.

CREATE OR REPLACE FUNCTION public.receita_item_desconto_concedido(
  p_valor_item numeric,
  p_valor_pago numeric,
  p_situacao text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN upper(trim(COALESCE(p_situacao, ''))) = 'PAGO'
      THEN GREATEST(COALESCE(p_valor_item, 0) - COALESCE(p_valor_pago, 0), 0)
    ELSE 0::numeric
  END;
$$;

COMMENT ON FUNCTION public.receita_item_desconto_concedido(numeric, numeric, text) IS
  'Diferença de título quitado (PAGO) sem título residual. Não é inadimplência. Pago a menor continua em outro título ABERTO.';

CREATE OR REPLACE FUNCTION public.receita_item_saldo_inadimplencia(
  p_valor_item numeric,
  p_valor_pago numeric,
  p_situacao text,
  p_data_pagamento date,
  p_corte date
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_data_pagamento IS NOT NULL
         AND p_corte IS NOT NULL
         AND p_data_pagamento <= p_corte
         AND upper(trim(COALESCE(p_situacao, ''))) = 'PAGO'
      THEN 0::numeric
    WHEN p_data_pagamento IS NOT NULL
         AND p_corte IS NOT NULL
         AND p_data_pagamento <= p_corte
      THEN GREATEST(COALESCE(p_valor_item, 0) - COALESCE(p_valor_pago, 0), 0)
    ELSE GREATEST(COALESCE(p_valor_item, 0), 0)
  END;
$$;

COMMENT ON FUNCTION public.receita_item_saldo_inadimplencia(numeric, numeric, text, date, date) IS
  'Saldo do item na data de corte. Título PAGO até o corte entra com saldo 0 (desconto concedido). Antes da quitação, o valor cheio ainda é devido.';

GRANT EXECUTE ON FUNCTION public.receita_item_desconto_concedido(numeric, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_saldo_inadimplencia(numeric, numeric, text, date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.inadimplencia_evolucao_saldo_devedor(
  p_ano integer DEFAULT NULL,
  p_mes_fim integer DEFAULT NULL
)
RETURNS TABLE (
  grupo_cliente text,
  classificacao text,
  carteira text,
  saldo_anterior numeric,
  gerado_ano numeric,
  acumulado numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::integer) AS ano,
      GREATEST(
        1,
        LEAST(COALESCE(p_mes_fim, EXTRACT(MONTH FROM CURRENT_DATE)::integer), 12)
      ) AS mes_fim,
      0.5::numeric AS eps
  ),
  corte_agora AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p.ano, p.mes_fim) AS dt
    FROM params p
  ),
  corte_anterior AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p.ano - 1, 12) AS dt
    FROM params p
  ),
  itens AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(v.grupo_cliente, v.cliente) AS grupo,
      v.data_vencimento,
      v.data_pagamento,
      EXTRACT(YEAR FROM v.data_vencimento)::integer AS ano_venc,
      EXTRACT(MONTH FROM v.data_vencimento)::integer AS mes_venc,
      EXTRACT(YEAR FROM v.data_pagamento)::integer AS ano_pag,
      EXTRACT(MONTH FROM v.data_pagamento)::integer AS mes_pag,
      COALESCE(v.valor_item, 0) AS faturado,
      COALESCE(v.valor_pago_item, 0) AS pago,
      public.receita_item_saldo_inadimplencia(
        v.valor_item,
        v.valor_pago_item,
        v.situacao_titulo,
        v.data_pagamento,
        c.dt
      ) AS saldo_vivo,
      public.receita_item_saldo_inadimplencia(
        v.valor_item,
        v.valor_pago_item,
        v.situacao_titulo,
        v.data_pagamento,
        ca.dt
      ) AS saldo_fechamento
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN corte_agora c
    CROSS JOIN corte_anterior ca
    WHERE v.data_vencimento IS NOT NULL
      AND v.data_vencimento <= c.dt
      AND public.receita_item_cliente_ativo(i)
  ),
  vivo AS (
    SELECT
      i.grupo,
      ROUND(SUM(i.saldo_vivo), 2) AS acumulado,
      ROUND(SUM(i.saldo_vivo) FILTER (
        WHERE i.ano_venc = p.ano AND i.mes_venc <= p.mes_fim
      ), 2) AS gerado_ano,
      ROUND(SUM(i.saldo_vivo) FILTER (WHERE i.ano_venc < p.ano), 2) AS estoque_vivo
    FROM itens i
    CROSS JOIN params p
    GROUP BY i.grupo
    HAVING SUM(i.saldo_vivo) > (SELECT eps FROM params)
  ),
  fechamento AS (
    SELECT
      i.grupo,
      ROUND(SUM(i.saldo_fechamento) FILTER (WHERE i.data_vencimento <= c.dt), 2) AS saldo_anterior
    FROM itens i
    CROSS JOIN corte_anterior c
    GROUP BY i.grupo
  ),
  saldos AS (
    SELECT
      v.grupo,
      COALESCE(f.saldo_anterior, 0) AS saldo_anterior,
      COALESCE(v.gerado_ano, 0) AS gerado_ano,
      v.acumulado,
      COALESCE(v.estoque_vivo, 0) AS estoque_vivo
    FROM vivo v
    LEFT JOIN fechamento f ON f.grupo = v.grupo
  ),
  fat_mes AS (
    SELECT
      i.grupo,
      i.mes_venc AS mes,
      SUM(i.faturado) AS faturado,
      SUM(i.saldo_vivo) AS inadimplencia
    FROM itens i
    CROSS JOIN params p
    WHERE i.ano_venc = p.ano
      AND i.mes_venc <= p.mes_fim
    GROUP BY i.grupo, i.mes_venc
  ),
  rec_mes AS (
    SELECT
      i.grupo,
      i.mes_pag AS mes,
      SUM(i.pago) AS recebido
    FROM itens i
    CROSS JOIN params p
    WHERE i.ano_pag = p.ano
      AND i.mes_pag BETWEEN 1 AND p.mes_fim
      AND i.pago > 0
    GROUP BY i.grupo, i.mes_pag
  ),
  fat_agg AS (
    SELECT
      f.grupo,
      SUM(f.faturado) AS faturado_ytd,
      COUNT(*) FILTER (WHERE f.inadimplencia > (SELECT eps FROM params)) AS meses_com_inad,
      MAX(f.mes) FILTER (WHERE f.faturado > (SELECT eps FROM params)) AS ultimo_mes_fat
    FROM fat_mes f
    GROUP BY f.grupo
  ),
  rec_agg AS (
    SELECT
      r.grupo,
      SUM(r.recebido) AS recebido_ytd,
      SUM(r.recebido) FILTER (
        WHERE r.mes >= GREATEST(1, (SELECT mes_fim FROM params) - 2)
          AND r.mes <= (SELECT mes_fim FROM params)
      ) AS recebido_recente
    FROM rec_mes r
    GROUP BY r.grupo
  )
  SELECT
    s.grupo AS grupo_cliente,
    CASE
      WHEN fa.ultimo_mes_fat IS NOT NULL
        AND COALESCE(fm.inadimplencia, 0) <= p.eps
        AND COALESCE(s.estoque_vivo, 0) > p.eps
      THEN 'corrente_em_dia'
      WHEN COALESCE(ra.recebido_recente, 0) > p.eps
        AND COALESCE(fa.meses_com_inad, 0) <= 1
      THEN 'atraso_pontual'
      WHEN COALESCE(ra.recebido_recente, 0) > p.eps
      THEN 'pagamento_parcial'
      ELSE 'sem_perspectiva'
    END AS classificacao,
    'recorrente'::text AS carteira,
    s.saldo_anterior::numeric(15, 2) AS saldo_anterior,
    s.gerado_ano::numeric(15, 2) AS gerado_ano,
    s.acumulado::numeric(15, 2) AS acumulado
  FROM saldos s
  CROSS JOIN params p
  LEFT JOIN fat_agg fa ON fa.grupo = s.grupo
  LEFT JOIN rec_agg ra ON ra.grupo = s.grupo
  LEFT JOIN fat_mes fm ON fm.grupo = s.grupo AND fm.mes = fa.ultimo_mes_fat
  ORDER BY acumulado DESC, s.grupo;
$$;

COMMENT ON FUNCTION public.inadimplencia_evolucao_saldo_devedor(integer, integer) IS
  'Saldo anterior = fechamento do ano anterior. Gerado = títulos do ano ainda em aberto. Acumulado = saldo vivo. Título PAGO com desconto (sem título residual) não entra.';

GRANT EXECUTE ON FUNCTION public.inadimplencia_evolucao_saldo_devedor(integer, integer) TO anon, authenticated;

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
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_bruto,
      SUM(
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND (
                 (
                   EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
                   AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
                 )
                 OR v.data_pagamento <= c.dt
                 OR (p_baixa_posterior AND v.data_pagamento > c.dt)
               )
            THEN public.receita_item_desconto_concedido(
              v.valor_item,
              v.valor_pago_item,
              v.situacao_titulo
            )
          ELSE 0
        END
      )::numeric(15, 2) AS desconto,
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
      GREATEST(COALESCE(f.faturado_bruto, 0) - COALESCE(f.desconto, 0), 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (
        GREATEST(COALESCE(f.faturado_bruto, 0) - COALESCE(f.desconto, 0), 0)
        - COALESCE(r.recebido, 0)
      )::numeric(15, 2) AS valor_liquido,
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
  'Saldo líquido do período. Faturado já abate desconto concedido em título PAGO (sem título residual), quando a quitação entra no mesmo critério do recebido. Recebido: caixa do intervalo + quitação antecipada até o corte + (se p_baixa_posterior) pagamentos posteriores.';

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
      public.receita_item_saldo_inadimplencia(
        v.valor_item,
        v.valor_pago_item,
        v.situacao_titulo,
        v.data_pagamento,
        (SELECT dt FROM corte)
      )::numeric(15, 2) AS inad_item
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
  'Inadimplência mensal: título PAGO até o corte zera (desconto concedido); encontro de contas = min(saldo itens, faturado − recebido no calendário do mês).';

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
      public.receita_item_saldo_inadimplencia(
        v.valor_item,
        v.valor_pago_item,
        v.situacao_titulo,
        v.data_pagamento,
        fm.dt
      )::numeric(15, 2) AS inad_item
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
  'Títulos inadimplentes no período. Título PAGO até o corte do mês não entra (desconto concedido).';

CREATE OR REPLACE FUNCTION public.financeiro_parcela_valor_sem_outras_receitas(
  p_ci_titulo integer,
  p_valor_parcela numeric,
  p_plano_parcela text
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.financeiro_parcelas_itens i
      WHERE i.ci_titulo = p_ci_titulo
        AND public.financeiro_titulo_eh_receber(i.tipo)
    ) THEN
      COALESCE(
        (
          SELECT ROUND(SUM(
            public.receita_item_saldo_inadimplencia(
              i.valor_item,
              i.valor_pago_item,
              i.situacao_titulo,
              i.data_pagamento,
              CURRENT_DATE
            )
          ), 2)
          FROM public.financeiro_parcelas_itens i
          WHERE i.ci_titulo = p_ci_titulo
            AND public.financeiro_titulo_eh_receber(i.tipo)
            AND NOT public.plano_contas_eh_outras_receitas(i.plano_contas)
        ),
        0
      )
    WHEN public.plano_contas_eh_outras_receitas(p_plano_parcela) THEN 0
    ELSE COALESCE(p_valor_parcela, 0)
  END;
$$;

COMMENT ON FUNCTION public.financeiro_parcela_valor_sem_outras_receitas(integer, numeric, text) IS
  'Saldo da parcela sem itens de OUTRAS RECEITAS. Título PAGO com desconto entra com saldo 0.';

CREATE OR REPLACE VIEW public.clients_inadimplencia_list AS
WITH itens_kanban AS (
  SELECT
    COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
    public.receita_item_saldo_inadimplencia(
      v.valor_item,
      v.valor_pago_item,
      v.situacao_titulo,
      v.data_pagamento,
      CURRENT_DATE
    ) AS saldo,
    v.data_vencimento
  FROM public.receita_itens_inadimplencia_elegiveis v
  WHERE v.data_vencimento IS NOT NULL
    AND v.data_vencimento < CURRENT_DATE

  UNION ALL

  SELECT
    COALESCE(
      gc.grupo_cliente,
      NULLIF(trim(p.grupo_cliente), ''),
      'Sem grupo'
    ) AS grupo_cliente,
    public.receita_item_saldo_inadimplencia(
      i.valor_item,
      i.valor_pago_item,
      i.situacao_titulo,
      i.data_pagamento,
      CURRENT_DATE
    ) AS saldo,
    i.data_vencimento
  FROM public.financeiro_parcelas_itens i
  INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
    AND i.data_vencimento IS NOT NULL
    AND public.normalize_plano_contas(i.plano_contas) LIKE '%REEMBOLSO%DESPESA%'
    AND NOT public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_saldo_inadimplencia(
      i.valor_item,
      i.valor_pago_item,
      i.situacao_titulo,
      i.data_pagamento,
      CURRENT_DATE
    ) > 0
),
grupo_saldo_vencido AS (
  SELECT
    k.grupo_cliente,
    ROUND(SUM(k.saldo), 2)::numeric(12, 2) AS valor_aberto_grupo,
    MIN(k.data_vencimento) FILTER (
      WHERE k.saldo > 0 AND k.data_vencimento < CURRENT_DATE
    ) AS oldest_overdue
  FROM itens_kanban k
  GROUP BY 1
  HAVING SUM(k.saldo) > 0
),
cliente_base AS (
  SELECT c.*, p.grupo_cliente
  FROM public.clients_inadimplencia c
  LEFT JOIN public.pessoas p ON p.id = c.pessoa_id
),
cliente_pessoas AS (
  SELECT cb.id AS client_id, p2.id AS pessoa_id
  FROM cliente_base cb
  JOIN public.pessoas p2 ON cb.grupo_cliente IS NOT NULL AND p2.grupo_cliente = cb.grupo_cliente
  UNION
  SELECT cb.id, cb.pessoa_id
  FROM cliente_base cb
  WHERE cb.pessoa_id IS NOT NULL AND cb.grupo_cliente IS NULL
),
parcelas_abertas AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN public.financeiro_parcelas fp
    ON fp.pessoa_id = cp.pessoa_id
   AND fp.situacao = 'ABERTO'
   AND public.financeiro_titulo_eh_receber(fp.tipo)
),
parcelas_contrato_mensal AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN public.financeiro_parcelas fp
    ON fp.pessoa_id = cp.pessoa_id
   AND fp.situacao = 'ABERTO'
   AND public.financeiro_titulo_eh_receber(fp.tipo)
   AND public.normalize_plano_contas(fp.plano_contas) LIKE '%HONOR%MENSAIS%'
   AND (
     fp.descricao IS NULL
     OR (
       upper(trim(fp.descricao)) NOT LIKE 'ND %'
       AND upper(trim(fp.descricao)) <> 'ND'
     )
   )
),
parcelas_agg AS (
  SELECT
    client_id,
    COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0)::numeric(12, 2) AS valor_em_aberto_computado,
    MIN(data_vencimento) FILTER (WHERE data_vencimento < CURRENT_DATE) AS oldest_overdue
  FROM parcelas_abertas
  GROUP BY client_id
),
valor_mensal_mes_ref AS (
  SELECT
    client_id,
    date_trunc('month', MIN(data_vencimento))::date AS mes_ref
  FROM parcelas_contrato_mensal
  WHERE data_vencimento >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY client_id
),
valor_mensal_lookup AS (
  SELECT
    pa.client_id,
    SUM(pa.valor)::numeric(12, 2) AS valor_mensal_computado
  FROM parcelas_contrato_mensal pa
  INNER JOIN valor_mensal_mes_ref vm
    ON vm.client_id = pa.client_id
   AND date_trunc('month', pa.data_vencimento::date)::date = vm.mes_ref
  GROUP BY pa.client_id
),
base AS (
  SELECT
    cb.id,
    cb.razao_social,
    cb.cnpj,
    cb.contato,
    cb.gestor,
    cb.area,
    cb.status_classe,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_em_aberto
      WHEN cb.grupo_cliente IS NOT NULL THEN COALESCE(
        gs.valor_aberto_grupo,
        pa.valor_em_aberto_computado,
        cb.valor_em_aberto
      )
      ELSE COALESCE(pa.valor_em_aberto_computado, cb.valor_em_aberto)
    END::numeric(12, 2) AS valor_em_aberto,
    cb.qtd_processos,
    cb.horas_total,
    cb.horas_por_ano,
    cb.data_vencimento,
    cb.observacoes_gerais,
    cb.ultima_providencia,
    cb.data_providencia,
    cb.follow_up,
    cb.data_follow_up,
    cb.resolvido_at,
    cb.reaberto_at,
    cb.pessoa_id,
    cb.created_at,
    cb.updated_at,
    cb.created_by,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.dias_em_aberto
      WHEN cb.grupo_cliente IS NOT NULL THEN COALESCE(
        CASE WHEN gs.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - gs.oldest_overdue) END,
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
      ELSE COALESCE(
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
    END AS dias_em_aberto,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_mensal
      ELSE COALESCE(vm.valor_mensal_computado, cb.valor_mensal)
    END::numeric(12, 2) AS valor_mensal
  FROM cliente_base cb
  LEFT JOIN grupo_saldo_vencido gs ON gs.grupo_cliente = cb.grupo_cliente
  LEFT JOIN parcelas_agg pa ON pa.client_id = cb.id AND cb.pessoa_id IS NOT NULL
  LEFT JOIN valor_mensal_lookup vm ON vm.client_id = cb.id AND cb.pessoa_id IS NOT NULL
)
SELECT
  id,
  razao_social,
  cnpj,
  contato,
  gestor,
  area,
  status_classe,
  valor_em_aberto,
  qtd_processos,
  horas_total,
  horas_por_ano,
  data_vencimento,
  observacoes_gerais,
  ultima_providencia,
  data_providencia,
  follow_up,
  data_follow_up,
  resolvido_at,
  reaberto_at,
  pessoa_id,
  created_at,
  updated_at,
  created_by,
  dias_em_aberto,
  valor_mensal,
  CASE
    WHEN dias_em_aberto > 5 THEN 'urgente'::text
    WHEN dias_em_aberto >= 3 THEN 'atencao'::text
    ELSE 'controlado'::text
  END AS prioridade
FROM base;

COMMENT ON VIEW public.clients_inadimplencia_list IS
  'Painel Inadimplência: saldo do grupo = honorários vencidos (cota) + reembolso em aberto. Título PAGO com desconto não entra. Valor mensal = honorários mensais do contrato (sem ND).';
