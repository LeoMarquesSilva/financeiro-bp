-- Saldo devedor / inadimplência: usar valor_parcial_aberto do VIOS (baixa parcial)
-- e pagamento parcial em título ainda ABERTO. Desconto concedido (PAGO sem residual)
-- continua com saldo 0.

CREATE OR REPLACE FUNCTION public.receita_item_valor_devido_inadimplencia(
  p_valor_item numeric,
  p_valor_parcial_aberto numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(NULLIF(p_valor_parcial_aberto, 0), NULLIF(p_valor_item, 0), 0)::numeric;
$$;

COMMENT ON FUNCTION public.receita_item_valor_devido_inadimplencia(numeric, numeric) IS
  'Valor devido do item: prioriza valor_parcial_aberto (saldo após baixa parcial no VIOS).';

CREATE OR REPLACE FUNCTION public.receita_item_saldo_inadimplencia(
  p_valor_item numeric,
  p_valor_pago numeric,
  p_situacao text,
  p_data_pagamento date,
  p_corte date,
  p_valor_parcial_aberto numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH devido AS (
    SELECT public.receita_item_valor_devido_inadimplencia(
      p_valor_item,
      p_valor_parcial_aberto
    ) AS v
  ),
  pago_ate_corte AS (
    SELECT CASE
      WHEN p_data_pagamento IS NOT NULL
           AND p_corte IS NOT NULL
           AND p_data_pagamento <= p_corte
        THEN COALESCE(p_valor_pago, 0)
      ELSE 0::numeric
    END AS v
  )
  SELECT CASE
    WHEN (SELECT v FROM devido) <= 0.01 THEN 0::numeric
    WHEN p_data_pagamento IS NOT NULL
         AND p_corte IS NOT NULL
         AND p_data_pagamento <= p_corte
         AND upper(trim(COALESCE(p_situacao, ''))) = 'PAGO'
         AND (SELECT v FROM pago_ate_corte) >= (SELECT v FROM devido) - 0.01
      THEN 0::numeric
    WHEN p_data_pagamento IS NOT NULL
         AND p_corte IS NOT NULL
         AND p_data_pagamento <= p_corte
         AND upper(trim(COALESCE(p_situacao, ''))) = 'PAGO'
         AND (SELECT v FROM pago_ate_corte) > 0
         AND (SELECT v FROM pago_ate_corte) < (SELECT v FROM devido) - 0.01
      THEN 0::numeric
    ELSE GREATEST((SELECT v FROM devido) - (SELECT v FROM pago_ate_corte), 0)
  END;
$$;

COMMENT ON FUNCTION public.receita_item_saldo_inadimplencia(
  numeric, numeric, text, date, date, numeric
) IS
  'Saldo na data de corte. Usa valor_parcial_aberto quando informado. PAGO quitado ou desconto concedido = 0; baixa parcial remanescente em outro título ABERTO entra pelo valor devido desse item.';

GRANT EXECUTE ON FUNCTION public.receita_item_valor_devido_inadimplencia(numeric, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_saldo_inadimplencia(
  numeric, numeric, text, date, date, numeric
) TO anon, authenticated;

-- Detalhe por título (conferência VIOS × SIOE)
CREATE OR REPLACE FUNCTION public.inadimplencia_saldo_devedor_titulos_grupo(
  p_grupo_cliente text,
  p_ano integer DEFAULT NULL,
  p_mes_fim integer DEFAULT NULL
)
RETURNS TABLE (
  cliente text,
  nro_titulo text,
  data_vencimento date,
  situacao_titulo text,
  valor_item numeric,
  valor_parcial_aberto numeric,
  valor_pago_item numeric,
  data_pagamento date,
  saldo_vivo numeric,
  eh_saldo_parcial_vios boolean
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
      ) AS mes_fim
  ),
  corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p.ano, p.mes_fim) AS dt
    FROM params p
  )
  SELECT
    NULLIF(trim(v.cliente), '') AS cliente,
    public.receita_item_nro_titulo(i.nro_titulo, fp.nro_titulo) AS nro_titulo,
    v.data_vencimento,
    NULLIF(trim(v.situacao_titulo), '') AS situacao_titulo,
    v.valor_item::numeric(15, 2) AS valor_item,
    v.valor_parcial_aberto::numeric(15, 2) AS valor_parcial_aberto,
    v.valor_pago_item::numeric(15, 2) AS valor_pago_item,
    v.data_pagamento,
    public.receita_item_saldo_inadimplencia(
      v.valor_item,
      v.valor_pago_item,
      v.situacao_titulo,
      v.data_pagamento,
      c.dt,
      v.valor_parcial_aberto
    )::numeric(15, 2) AS saldo_vivo,
    public.cobranca_eh_saldo_parcial(
      public.receita_item_nro_titulo(i.nro_titulo, fp.nro_titulo)
    ) AS eh_saldo_parcial_vios
  FROM public.receita_itens_inadimplencia_base v
  INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
  INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  CROSS JOIN corte c
  WHERE v.data_vencimento IS NOT NULL
    AND v.data_vencimento <= c.dt
    AND public.receita_item_cliente_ativo(i)
    AND public.receita_inadimplencia_chave_grupo(v.grupo_cliente, v.cliente)
      = trim(p_grupo_cliente)
  ORDER BY saldo_vivo DESC, v.data_vencimento, nro_titulo, v.valor_item DESC;
$$;

COMMENT ON FUNCTION public.inadimplencia_saldo_devedor_titulos_grupo(text, integer, integer) IS
  'Itens vencidos que compõem o saldo devedor do grupo (saldo_vivo > 0 na prática ao somar).';

GRANT EXECUTE ON FUNCTION public.inadimplencia_saldo_devedor_titulos_grupo(text, integer, integer)
  TO anon, authenticated;

-- inadimplencia_evolucao_saldo_devedor: passar valor_parcial_aberto
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
        c.dt,
        v.valor_parcial_aberto
      ) AS saldo_vivo,
      public.receita_item_saldo_inadimplencia(
        v.valor_item,
        v.valor_pago_item,
        v.situacao_titulo,
        v.data_pagamento,
        ca.dt,
        v.valor_parcial_aberto
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
  'Saldo devedor por grupo. Saldo por item usa valor_parcial_aberto (baixa parcial VIOS) e desconto concedido (PAGO integral ou desconto).';
