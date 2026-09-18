-- Saldo do ano anterior = posição de fechamento daquele ano.
-- Pagamento em 2026 de título que fechou 2025 em aberto não zera o estoque.

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
      GREATEST(COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0), 0) AS saldo_vivo
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN corte_agora c
    WHERE v.data_vencimento IS NOT NULL
      AND v.data_vencimento <= c.dt
      AND public.receita_item_cliente_ativo(i)
  ),
  vivo AS (
    SELECT
      i.grupo,
      ROUND(SUM(i.saldo_vivo), 2) AS acumulado,
      ROUND(SUM(i.saldo_vivo) FILTER (WHERE i.ano_venc < p.ano), 2) AS estoque_vivo
    FROM itens i
    CROSS JOIN params p
    GROUP BY i.grupo
    HAVING SUM(i.saldo_vivo) > (SELECT eps FROM params)
  ),
  fechamento AS (
    SELECT
      i.grupo,
      ROUND(SUM(
        GREATEST(
          i.faturado - CASE
            WHEN i.data_pagamento IS NOT NULL AND i.data_pagamento <= c.dt THEN i.pago
            ELSE 0
          END,
          0
        )
      ) FILTER (WHERE i.data_vencimento <= c.dt), 2) AS saldo_anterior
    FROM itens i
    CROSS JOIN corte_anterior c
    GROUP BY i.grupo
  ),
  saldos AS (
    SELECT
      v.grupo,
      COALESCE(f.saldo_anterior, 0) AS saldo_anterior,
      ROUND(v.acumulado - COALESCE(f.saldo_anterior, 0), 2) AS gerado_ano,
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
  'Evolução do saldo devedor por grupo. Saldo anterior = fechamento do ano anterior (sem baixa posterior). Acumulado = em aberto ao vivo. Gerado = acumulado − saldo anterior.';

GRANT EXECUTE ON FUNCTION public.inadimplencia_evolucao_saldo_devedor(integer, integer) TO anon, authenticated;
