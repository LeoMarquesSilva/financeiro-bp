-- Receita › Resultado de caixa: receita bruta, despesas operacionais (OPEX) e saídas
-- fora do OPEX, mês a mês, para o ano e o ano anterior (base caixa: data de pagamento).
--
-- OPEX = mesma regra do painel OPEX (opex_item_elegivel). Fora do OPEX, por categoria:
--   distribuicao   — DISTRIBUICAO DE LUCROS, SOCIOS
--   investimentos  — INVESTIMENTOS (CAPEX)
--   financeiro     — SAIDAS - EMPRESTIMOS APL. E DEVOLUCOES (adiantamentos, devoluções)
--   deducoes       — DEDUCOES DA RECEITA
-- Fora do cálculo (não são gasto do escritório):
--   repasses       — OUTRAS RECEITAS OPERACIONAIS (repasse; a entrada não está na receita bruta)
--   transferencias — transferência entre contas correntes próprias

CREATE OR REPLACE FUNCTION public.receita_resultado_caixa_mensal(p_ano integer)
RETURNS TABLE(
  ano integer,
  mes integer,
  receita numeric,
  opex numeric,
  distribuicao numeric,
  investimentos numeric,
  financeiro numeric,
  deducoes numeric,
  repasses numeric,
  transferencias numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH anos AS (
    SELECT unnest(ARRAY[p_ano - 1, p_ano]) AS ano
  ),
  saidas AS (
    SELECT
      extract(year FROM i.data_pagamento)::integer AS ano,
      extract(month FROM i.data_pagamento)::integer AS mes,
      CASE
        WHEN NOT public.opex_grupo_excluido(i.grupo_conta) THEN 'opex'
        WHEN i.plano_contas ILIKE '%TRANSF%ENTRE CONTAS%' THEN 'transferencias'
        WHEN public.opex_norm_grupo(i.grupo_conta) IN ('DISTRIBUICAO DE LUCROS', 'SOCIOS') THEN 'distribuicao'
        WHEN public.opex_norm_grupo(i.grupo_conta) = 'INVESTIMENTOS' THEN 'investimentos'
        WHEN public.opex_norm_grupo(i.grupo_conta) = 'SAIDAS - EMPRESTIMOS APL. E DEVOLUCOES' THEN 'financeiro'
        WHEN public.opex_norm_grupo(i.grupo_conta) = 'DEDUCOES DA RECEITA' THEN 'deducoes'
        WHEN public.opex_norm_grupo(i.grupo_conta) = 'OUTRAS RECEITAS OPERACIONAIS' THEN 'repasses'
      END AS categoria,
      public.opex_valor_pago(i) AS valor
    FROM financeiro_parcelas_itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND i.data_pagamento >= make_date(p_ano - 1, 1, 1)
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
  ),
  saidas_mes AS (
    SELECT
      s.ano,
      s.mes,
      sum(s.valor) FILTER (WHERE s.categoria = 'opex') AS opex,
      sum(s.valor) FILTER (WHERE s.categoria = 'distribuicao') AS distribuicao,
      sum(s.valor) FILTER (WHERE s.categoria = 'investimentos') AS investimentos,
      sum(s.valor) FILTER (WHERE s.categoria = 'financeiro') AS financeiro,
      sum(s.valor) FILTER (WHERE s.categoria = 'deducoes') AS deducoes,
      sum(s.valor) FILTER (WHERE s.categoria = 'repasses') AS repasses,
      sum(s.valor) FILTER (WHERE s.categoria = 'transferencias') AS transferencias
    FROM saidas s
    GROUP BY 1, 2
  )
  SELECT
    a.ano,
    r.mes,
    round(coalesce(r.recebido, 0)::numeric, 2),
    round(coalesce(s.opex, 0)::numeric, 2),
    round(coalesce(s.distribuicao, 0)::numeric, 2),
    round(coalesce(s.investimentos, 0)::numeric, 2),
    round(coalesce(s.financeiro, 0)::numeric, 2),
    round(coalesce(s.deducoes, 0)::numeric, 2),
    round(coalesce(s.repasses, 0)::numeric, 2),
    round(coalesce(s.transferencias, 0)::numeric, 2)
  FROM anos a
  CROSS JOIN LATERAL public.receita_totais_mensais(a.ano) r
  LEFT JOIN saidas_mes s ON s.ano = a.ano AND s.mes = r.mes
  ORDER BY a.ano, r.mes;
$function$;

GRANT EXECUTE ON FUNCTION public.receita_resultado_caixa_mensal(integer) TO authenticated;
