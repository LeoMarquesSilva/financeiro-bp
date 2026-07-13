-- KPIs de inadimplência (total, % e evolução) incluem clientes inativos.
-- Top 5 maiores inadimplentes permanece somente clientes ativos.

CREATE OR REPLACE VIEW public.receita_itens_inadimplencia_base AS
SELECT
  i.id,
  i.ci_item,
  i.ci_titulo,
  i.cliente,
  i.plano_contas,
  i.tipo,
  i.valor_item,
  i.valor_parcial_aberto,
  i.valor_pago_item,
  i.situacao_titulo,
  i.data_vencimento,
  i.data_pagamento,
  fp.pessoa_id,
  COALESCE(
    gc.grupo_cliente,
    NULLIF(trim(p.grupo_cliente), ''),
    'Sem grupo'
  ) AS grupo_cliente,
  p.categoria
FROM public.financeiro_parcelas_itens i
INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
LEFT JOIN public.receita_grupo_por_nome_cliente gc
  ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
  AND public.plano_contas_na_cota(i.plano_contas);

COMMENT ON VIEW public.receita_itens_inadimplencia_base IS
  'Base da inadimplência na Receita (cota + grupo canônico), incluindo clientes inativos.';

CREATE OR REPLACE VIEW public.receita_itens_inadimplencia_elegiveis AS
SELECT b.*
FROM public.receita_itens_inadimplencia_base b
INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
WHERE public.receita_item_cliente_ativo(i);

COMMENT ON VIEW public.receita_itens_inadimplencia_elegiveis IS
  'Base da inadimplência na Receita: planos da cota, grupo canônico, somente clientes ativos.';

GRANT SELECT ON public.receita_itens_inadimplencia_base TO anon, authenticated;

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
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente AS (
    SELECT
      im.cliente,
      SUM(im.valor_item)::numeric(15, 2) AS faturado,
      SUM(im.recebido_item)::numeric(15, 2) AS recebido,
      SUM(im.inad_item)::numeric(15, 2) AS inad_itens
    FROM itens_mes im
    GROUP BY im.cliente
  )
  SELECT
    c.cliente,
    c.faturado,
    c.recebido,
    c.inad_itens AS inadimplencia
  FROM por_cliente c
  WHERE c.faturado > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) IS
  'Inadimplência mensal por cliente. p_incluir_inativos=true inclui clientes/grupos inativos.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT false
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
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  cliente_inad AS (
    SELECT * FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos)
  )
  SELECT
    cg.grupo_cliente,
    ROUND(SUM(ci.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(ci.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(GREATEST(SUM(ci.faturado) - SUM(ci.recebido), 0), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_clientes,
    COUNT(*) FILTER (
      WHERE GREATEST(ci.faturado - ci.recebido, 0) > 0
    )::integer AS qtd_clientes_inad
  FROM cliente_inad ci
  INNER JOIN cliente_grupo cg ON cg.cliente = ci.cliente
  GROUP BY cg.grupo_cliente
  ORDER BY inadimplencia DESC, cg.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) IS
  'Inadimplência mensal por grupo. p_incluir_inativos=true inclui clientes/grupos inativos.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
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
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
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
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
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

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer, boolean) IS
  'Saldo proporcional do período por cliente. p_incluir_inativos=true inclui inativos.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupos_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
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
    ROUND(GREATEST(SUM(n.faturado) - SUM(n.recebido), 0), 2)::numeric(15, 2) AS valor,
    MAX(n.qtd_meses)::integer AS qtd_meses,
    COUNT(*) FILTER (
      WHERE n.faturado > 0 OR n.recebido > 0
    )::integer AS qtd_clientes
  FROM public.receita_inadimplencia_periodo_net_clientes(
    p_ano, p_mes_inicio, p_mes_fim, p_incluir_inativos
  ) n
  GROUP BY n.grupo_cliente
  HAVING GREATEST(SUM(n.faturado) - SUM(n.recebido), 0) > 0
  ORDER BY valor DESC, n.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer, boolean) IS
  'Inadimplência do período por grupo. p_incluir_inativos=false (padrão) alinha ao top 5 ativos.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
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
  WITH meses AS (
    SELECT generate_series(
      GREATEST(1, LEAST(p_mes_inicio, 12)),
      GREATEST(1, LEAST(p_mes_fim, 12))
    )::integer AS mes
  )
  SELECT
    c.cliente,
    ROUND(SUM(c.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(*) FILTER (WHERE c.inadimplencia > 0)::integer AS qtd_meses
  FROM meses m
  CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
    p_ano, m.mes, p_incluir_inativos
  ) c
  WHERE c.inadimplencia > 0
  GROUP BY c.cliente
  ORDER BY valor DESC, c.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer, boolean) IS
  'Clientes inadimplentes no período. p_incluir_inativos=true alinha ao KPI acumulado.';

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
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
    WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
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

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  integer, integer, integer, text, boolean
) IS
  'Títulos inadimplentes no período. p_incluir_inativos=true alinha ao KPI acumulado.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_departamento_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  departamento text,
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
      COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
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
      END AS inad_item
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      cliente,
      departamento,
      SUM(valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes
    GROUP BY cliente, departamento
  ),
  totais_cliente AS (
    SELECT
      cliente,
      SUM(faturado_dept)::numeric(15, 2) AS faturado,
      SUM(inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept
    GROUP BY cliente
  ),
  cliente_final AS (
    SELECT c.cliente, c.inadimplencia
    FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos) c
    WHERE c.inadimplencia > 0
  ),
  alocado AS (
    SELECT
      d.departamento,
      ROUND(
        SUM(
          cf.inadimplencia * CASE
            WHEN t.inad_itens > 0 THEN d.inad_itens_dept / t.inad_itens
            WHEN t.faturado > 0 THEN d.faturado_dept / t.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept d
    INNER JOIN totais_cliente t ON t.cliente = d.cliente
    INNER JOIN cliente_final cf ON cf.cliente = d.cliente
    WHERE d.inad_itens_dept > 0 OR d.faturado_dept > 0
    GROUP BY d.departamento
  )
  SELECT departamento, inadimplencia
  FROM alocado
  WHERE inadimplencia > 0
  ORDER BY inadimplencia DESC, departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer, boolean) IS
  'Inadimplência do mês por área. Padrão inclui clientes inativos (evolução).';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_dashboard(
  p_ano integer,
  p_mes_inicio integer DEFAULT NULL,
  p_mes_fim integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := CURRENT_DATE;
  v_ano_atual integer := EXTRACT(YEAR FROM v_hoje)::integer;
  v_mes_atual integer := EXTRACT(MONTH FROM v_hoje)::integer;
  v_mes_max integer;
  v_mes_inicio integer;
  v_mes_fim integer;
  v_valor_periodo numeric(15, 2);
  v_previsto_periodo numeric(15, 2);
  v_pct_periodo numeric(8, 2);
  v_top5 jsonb;
  v_top5_total numeric(15, 2);
  v_top5_pct numeric(8, 2);
  v_evolucao jsonb;
  v_primeiro_valor numeric(15, 2);
  v_ultimo_valor numeric(15, 2);
  v_reducao_pct numeric(8, 2);
  v_periodo_label text;
  v_mes_labels text[] := ARRAY['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
BEGIN
  IF p_ano > v_ano_atual THEN
    RETURN jsonb_build_object(
      'ano', p_ano, 'mes_inicio', 1, 'mes_fim', 0, 'mes_max_disponivel', 0,
      'periodo_label', '', 'valor_total_periodo', 0, 'pct_periodo', 0,
      'top5', '[]'::jsonb, 'top5_total', 0, 'top5_pct', 0,
      'evolucao', '[]'::jsonb, 'destaque_reducao_pct', NULL
    );
  END IF;

  v_mes_max := CASE WHEN p_ano = v_ano_atual THEN v_mes_atual ELSE 12 END;
  v_mes_inicio := GREATEST(1, LEAST(COALESCE(NULLIF(p_mes_inicio, 0), 1), v_mes_max));
  v_mes_fim := GREATEST(v_mes_inicio, LEAST(COALESCE(NULLIF(p_mes_fim, 0), v_mes_max), v_mes_max));
  v_periodo_label := CASE
    WHEN v_mes_inicio = v_mes_fim THEN v_mes_labels[v_mes_inicio]
    ELSE v_mes_labels[v_mes_inicio] || '–' || v_mes_labels[v_mes_fim]
  END;

  -- KPI acumulado: inclui clientes inativos
  SELECT COALESCE(ROUND(SUM(g.valor), 2), 0)::numeric(15, 2)
  INTO v_valor_periodo
  FROM public.receita_inadimplencia_grupos_periodo(p_ano, v_mes_inicio, v_mes_fim, true) g;

  -- Top 5: somente clientes ativos
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT g.grupo_cliente AS cliente, g.valor
    FROM public.receita_inadimplencia_grupos_periodo(p_ano, v_mes_inicio, v_mes_fim, false) g
    ORDER BY g.valor DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)::numeric(15, 2)
  INTO v_top5_total
  FROM jsonb_array_elements(v_top5) AS elem;

  WITH previsto_por_mes AS (
    SELECT
      m.mes,
      public.receita_previsto_mes(p_ano, m.mes)::numeric(15, 2) AS previsto
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
  ),
  inad_por_mes AS (
    SELECT
      m.mes,
      (
        SELECT COALESCE(ROUND(SUM(g.inadimplencia), 2), 0)::numeric(15, 2)
        FROM public.receita_inadimplencia_grupo_mes(p_ano, m.mes, true) g
        WHERE g.inadimplencia > 0
      ) AS inad
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
  ),
  evolucao_calc AS (
    SELECT
      m.mes,
      COALESCE(i.inad, 0)::numeric(15, 2) AS valor_calc,
      COALESCE(p.previsto, 0)::numeric(15, 2) AS previsto,
      f.valor_total AS valor_congelado,
      f.pct_recebido AS pct_congelado,
      f.congelado_em,
      (f.ano IS NOT NULL) AS congelado
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    LEFT JOIN inad_por_mes i ON i.mes = m.mes
    LEFT JOIN previsto_por_mes p ON p.mes = m.mes
    LEFT JOIN public.receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = m.mes
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'mes', ec.mes,
        'mes_label', v_mes_labels[ec.mes],
        'valor', CASE WHEN ec.congelado THEN ec.valor_congelado ELSE ec.valor_calc END,
        'valor_calculado', ec.valor_calc,
        'previsto', ec.previsto,
        'pct', CASE
          WHEN ec.congelado THEN ec.pct_congelado
          WHEN ec.previsto > 0 THEN ROUND((ec.valor_calc / ec.previsto) * 100, 2)
          ELSE 0
        END,
        'congelado', ec.congelado,
        'congelado_em', ec.congelado_em
      ) ORDER BY ec.mes
    ), '[]'::jsonb),
    COALESCE(SUM(ec.previsto), 0)
  INTO v_evolucao, v_previsto_periodo
  FROM evolucao_calc ec;

  v_pct_periodo := CASE
    WHEN v_previsto_periodo > 0 THEN ROUND((v_valor_periodo / v_previsto_periodo) * 100, 1)
    ELSE 0
  END;

  v_top5_pct := CASE
    WHEN v_valor_periodo > 0 THEN ROUND((v_top5_total / v_valor_periodo) * 100, 1)
    ELSE 0
  END;

  SELECT (elem->>'valor')::numeric INTO v_primeiro_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer LIMIT 1;

  SELECT (elem->>'valor')::numeric INTO v_ultimo_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer DESC LIMIT 1;

  v_reducao_pct := CASE
    WHEN v_primeiro_valor > 0 AND v_ultimo_valor IS NOT NULL THEN
      ROUND(((v_primeiro_valor - v_ultimo_valor) / v_primeiro_valor) * 100, 0)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'mes_inicio', v_mes_inicio,
    'mes_fim', v_mes_fim,
    'mes_max_disponivel', v_mes_max,
    'periodo_label', v_periodo_label,
    'valor_total_periodo', v_valor_periodo,
    'pct_periodo', v_pct_periodo,
    'top5', v_top5,
    'top5_total', v_top5_total,
    'top5_pct', v_top5_pct,
    'evolucao', v_evolucao,
    'destaque_reducao_pct', v_reducao_pct
  );
END;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_dashboard(integer, integer, integer) IS
  'Dashboard inadimplência: KPI e evolução incluem inativos; top 5 só clientes ativos.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer, boolean) TO anon, authenticated;
