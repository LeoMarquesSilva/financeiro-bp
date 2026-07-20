-- CANÔNICO — regra fixa. Ver .cursor/rules/receita-inadimplencia-agregacao.mdc
-- Saldo consolidado por grupo: max(0, Σ faturado − Σ recebido) das empresas do grupo.
-- Compensa pagamentos de uma razão social contra faturamento de outra (ex.: CDA Comércio paga, Alumínio fatura).

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
  SELECT
    n.grupo_cliente,
    ROUND(SUM(n.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(n.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(GREATEST(SUM(n.faturado) - SUM(n.recebido), 0), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*) FILTER (
      WHERE n.faturado > 0 OR n.recebido > 0
    )::integer AS qtd_clientes,
    COUNT(*) FILTER (
      WHERE GREATEST(n.faturado - n.recebido, 0) > 0
    )::integer AS qtd_clientes_inad
  FROM public.receita_inadimplencia_periodo_net_clientes(
    p_ano, p_mes, p_mes, p_incluir_inativos
  ) n
  GROUP BY n.grupo_cliente
  HAVING GREATEST(SUM(n.faturado) - SUM(n.recebido), 0) > 0
  ORDER BY inadimplencia DESC, n.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) IS
  'Inadimplência mensal por grupo: max(0, Σ faturado − Σ recebido das empresas do grupo).';

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
  'Inadimplência do período por grupo: max(0, Σ faturado − Σ recebido das empresas do grupo).';
