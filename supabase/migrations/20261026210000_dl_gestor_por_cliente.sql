-- DL: regras decididas pelo usuário (2026-10-26) e DL do gestor por cliente.
--   1. Despesa da área = OPEX do departamento (opex_item_elegivel): distribuição de lucros — inclusive o
--      DL pago aos gestores — repasses, investimentos, empréstimos e deduções ficam fora. A planilha
--      descontava o DL pago como despesa do mês seguinte.
--   2. Parcela fixa dos sócios = pró-labore lançado no VIOS (no lugar dos R$ 120 mil digitados).
--   3. DL do gestor = % × resultado dos clientes da carteira dele (líquido do cliente − despesas da
--      área rateadas pela receita líquida), zerado no mês quando negativo. Gestor sem carteira
--      cadastrada não recebe DL.

CREATE TABLE IF NOT EXISTS public.dl_gestor_clientes (
  gestor_id uuid NOT NULL REFERENCES public.dl_gestores (id) ON DELETE CASCADE,
  cliente text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gestor_id, cliente)
);

ALTER TABLE public.dl_gestor_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dl_gestor_clientes_admin ON public.dl_gestor_clientes;
CREATE POLICY dl_gestor_clientes_admin ON public.dl_gestor_clientes FOR ALL TO authenticated
  USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dl_gestor_clientes TO authenticated;

DROP FUNCTION IF EXISTS public.dl_resultado_mensal(integer);

CREATE FUNCTION public.dl_resultado_mensal(p_ano integer)
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
    WHERE public.opex_item_elegivel(i)
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

GRANT EXECUTE ON FUNCTION public.dl_resultado_mensal(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dl_gestor_mensal(p_ano integer)
RETURNS TABLE(
  gestor_id uuid,
  mes integer,
  clientes integer,
  liquido_clientes numeric,
  resultado_clientes numeric,
  dl numeric
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
  WITH area AS (
    SELECT r.area_key, r.mes,
      r.receita_bruta - r.impostos AS liquido,
      r.desp_operacionais + r.desp_controladoria + r.desp_indiretas AS despesas
    FROM public.dl_resultado_mensal(p_ano) r
  ),
  cli AS (
    SELECT a.area_key, extract(month FROM i.data_pagamento)::integer AS m, trim(i.cliente) AS cliente,
      sum(i.valor_pago_item * CASE WHEN trim(i.nfse_titulo) ~ '^[0-9]+$' THEN 1 - 0.160587 ELSE 1 END) AS liq
    FROM financeiro_parcelas_itens i
    JOIN dl_areas a ON a.departamento = i.departamento
    WHERE i.tipo = 'RECEBER'
      AND i.data_pagamento >= make_date(p_ano, 1, 1)
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
      AND i.plano_contas IN (
        'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
        'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
        'HONORÁRIOS POR HORA TRABALHADA'
      )
    GROUP BY 1, 2, 3
  ),
  g AS (
    SELECT x.* FROM dl_gestores x WHERE x.ano = p_ano
  ),
  base AS (
    SELECT g.id, g.pct, ms.mes, c.cliente, c.liq,
      CASE WHEN ar.liquido > 0 THEN c.liq - ar.despesas * c.liq / ar.liquido ELSE 0 END AS res
    FROM g
    CROSS JOIN LATERAL generate_series(g.mes_inicio, g.mes_fim) AS ms(mes)
    JOIN area ar ON ar.area_key = g.area_key AND ar.mes = ms.mes
    LEFT JOIN cli c ON c.area_key = g.area_key AND c.m = ms.mes
      AND EXISTS (SELECT 1 FROM dl_gestor_clientes gc WHERE gc.gestor_id = g.id AND gc.cliente = c.cliente)
  )
  SELECT b.id, b.mes,
    count(b.cliente)::integer,
    round(coalesce(sum(b.liq), 0)::numeric, 2),
    round(coalesce(sum(b.res), 0)::numeric, 2),
    round(greatest(coalesce(sum(b.res), 0) * max(b.pct) / 100, 0)::numeric, 2)
  FROM base b
  GROUP BY b.id, b.mes
  ORDER BY b.id, b.mes;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_gestor_mensal(integer) TO authenticated;

-- A parcela fixa dos sócios agora vem do pró-labore do VIOS.
DROP TABLE IF EXISTS public.dl_parametros_gerais;

-- A carteira de cada gestor (clientes com % no fechamento oficial) foi carregada direto no banco de
-- produção, fora do repositório: é dado da Controladoria. Gestor sem carteira não recebe DL.
