-- Corrige dl_resultado_mensal de 20261026210000: opex_item_elegivel(i) não aceita a linha da CTE.

CREATE OR REPLACE FUNCTION public.dl_resultado_mensal(p_ano integer)
RETURNS TABLE(
  area_key text,
  mes integer,
  receita_bruta numeric,
  impostos numeric,
  desp_operacionais numeric,
  desp_controladoria numeric,
  desp_indiretas numeric,
  profissionais numeric,
  pct_controladoria numeric,
  parametro_herdado boolean,
  socios_prolabore numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  itens AS (
    SELECT i.*, extract(month FROM i.data_pagamento)::integer AS m
    FROM financeiro_parcelas_itens i
    WHERE i.data_pagamento >= make_date(p_ano, 1, 1)
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
  ),
  rec AS (
    SELECT a.area_key, i.m,
      sum(i.valor_pago_item) AS bruto,
      sum(i.valor_pago_item * CASE WHEN trim(i.nfse_titulo) ~ '^[0-9]+$' THEN 0.160587 ELSE 0 END) AS imposto
    FROM itens i
    JOIN dl_areas a ON a.departamento = i.departamento
    WHERE i.tipo = 'RECEBER'
      AND i.plano_contas IN (
        'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
        'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
        'HONORÁRIOS POR HORA TRABALHADA'
      )
    GROUP BY 1, 2
  ),
  pag AS (
    -- OPEX, menos impostos sobre faturamento (já descontados na receita líquida).
    SELECT i.departamento, i.m, abs(coalesce(i.valor_pago_item, 0)) AS v
    FROM itens i
    -- Mesmo critério de opex_item_elegivel (a CTE tem a coluna m a mais e não casa com o tipo da tabela).
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND NOT public.opex_grupo_excluido(i.grupo_conta)
      AND coalesce(i.conta_numero, '') NOT LIKE '5.14.03%'
      AND coalesce(i.conta_numero, '') NOT LIKE '3.3.%'
  ),
  desp_area AS (
    SELECT a.area_key, p.m, sum(p.v) AS v
    FROM pag p JOIN dl_areas a ON a.departamento = p.departamento
    GROUP BY 1, 2
  ),
  ctrl AS (
    SELECT p.m, sum(p.v) AS v FROM pag p WHERE p.departamento = 'Operações Legais' GROUP BY 1
  ),
  indir AS (
    SELECT p.m, sum(p.v) AS v
    FROM pag p
    WHERE p.departamento IN ('Facilities', 'Financeiro', 'Marketing', 'R.H.', 'T.I.', 'Comercial')
    GROUP BY 1
  ),
  socios AS (
    SELECT i.m, sum(abs(coalesce(i.valor_pago_item, 0))) AS v
    FROM itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo) AND i.plano_contas = 'PRÓ-LABORE'
    GROUP BY 1
  ),
  params AS (
    SELECT a.area_key, ms.mes, pm.profissionais, pm.pct_controladoria, pm.mes <> ms.mes AS herdado
    FROM dl_areas a
    CROSS JOIN meses ms
    LEFT JOIN LATERAL (
      SELECT x.mes, x.profissionais, x.pct_controladoria
      FROM dl_parametros_mensais x
      WHERE x.ano = p_ano AND x.area_key = a.area_key AND x.mes <= ms.mes
      ORDER BY x.mes DESC
      LIMIT 1
    ) pm ON true
  ),
  hc AS (
    SELECT p.mes, sum(coalesce(p.profissionais, 0)) AS total FROM params p GROUP BY 1
  )
  SELECT
    p.area_key,
    p.mes,
    round(coalesce(r.bruto, 0)::numeric, 2),
    round(coalesce(r.imposto, 0)::numeric, 2),
    round(coalesce(da.v, 0)::numeric, 2),
    round((coalesce(c.v, 0) * coalesce(p.pct_controladoria, 0) / 100)::numeric, 2),
    round(CASE
      WHEN coalesce(h.total, 0) > 0 AND (ix.v IS NOT NULL OR r.bruto IS NOT NULL)
        THEN (coalesce(ix.v, 0) + coalesce(s.v, 0)) / h.total * coalesce(p.profissionais, 0)
      ELSE 0
    END::numeric, 2),
    coalesce(p.profissionais, 0),
    coalesce(p.pct_controladoria, 0),
    coalesce(p.herdado, true),
    round(coalesce(s.v, 0)::numeric, 2)
  FROM params p
  JOIN hc h ON h.mes = p.mes
  LEFT JOIN socios s ON s.m = p.mes
  LEFT JOIN rec r ON r.area_key = p.area_key AND r.m = p.mes
  LEFT JOIN desp_area da ON da.area_key = p.area_key AND da.m = p.mes
  LEFT JOIN ctrl c ON c.m = p.mes
  LEFT JOIN indir ix ON ix.m = p.mes
  ORDER BY p.area_key, p.mes;
END;
$function$;

