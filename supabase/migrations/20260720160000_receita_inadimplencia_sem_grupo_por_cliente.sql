-- CANÔNICO — regra fixa. Ver .cursor/rules/receita-inadimplencia-agregacao.mdc
-- Clientes sem grupo_cliente: chave = razão social (não balde "Sem grupo").
-- pagamentos de empresas diferentes se anulam (ex.: Engforce R$ 769,54 vs F.a. da Costa).
-- Para Sem grupo, usa a razão social como chave de exibição/agregação.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_chave_grupo(
  p_grupo_cliente text,
  p_cliente text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(trim(p_grupo_cliente), ''), 'Sem grupo') = 'Sem grupo' THEN
      COALESCE(NULLIF(trim(p_cliente), ''), 'Sem cliente')
    ELSE
      COALESCE(NULLIF(trim(p_grupo_cliente), ''), 'Sem grupo')
  END;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_chave_grupo(text, text) IS
  'Chave de agregação por grupo; Sem grupo → razão social (cada cliente isolado).';

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
  WITH net AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(n.grupo_cliente, n.cliente) AS chave_grupo,
      n.faturado,
      n.recebido,
      n.qtd_meses
    FROM public.receita_inadimplencia_periodo_net_clientes(
      p_ano, p_mes, p_mes, p_incluir_inativos
    ) n
  )
  SELECT
    net.chave_grupo AS grupo_cliente,
    ROUND(SUM(net.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(net.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(GREATEST(SUM(net.faturado) - SUM(net.recebido), 0), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*) FILTER (
      WHERE net.faturado > 0 OR net.recebido > 0
    )::integer AS qtd_clientes,
    COUNT(*) FILTER (
      WHERE GREATEST(net.faturado - net.recebido, 0) > 0
    )::integer AS qtd_clientes_inad
  FROM net
  GROUP BY net.chave_grupo
  HAVING GREATEST(SUM(net.faturado) - SUM(net.recebido), 0) > 0
  ORDER BY inadimplencia DESC, net.chave_grupo;
$$;

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
  WITH net AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(n.grupo_cliente, n.cliente) AS chave_grupo,
      n.faturado,
      n.recebido,
      n.qtd_meses
    FROM public.receita_inadimplencia_periodo_net_clientes(
      p_ano, p_mes_inicio, p_mes_fim, p_incluir_inativos
    ) n
  )
  SELECT
    net.chave_grupo AS grupo_cliente,
    ROUND(GREATEST(SUM(net.faturado) - SUM(net.recebido), 0), 2)::numeric(15, 2) AS valor,
    MAX(net.qtd_meses)::integer AS qtd_meses,
    COUNT(*) FILTER (
      WHERE net.faturado > 0 OR net.recebido > 0
    )::integer AS qtd_clientes
  FROM net
  GROUP BY net.chave_grupo
  HAVING GREATEST(SUM(net.faturado) - SUM(net.recebido), 0) > 0
  ORDER BY valor DESC, net.chave_grupo;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) IS
  'Inadimplência mensal por grupo; Sem grupo usa razão social como chave.';

COMMENT ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer, boolean) IS
  'Inadimplência do período por grupo; Sem grupo usa razão social como chave.';
