-- Corrige tooltip "Inadimplência por área": remove overload ambíguo (2 args) que quebrava o RPC
-- e aloca o líquido VIOS (faturado − recebido) proporcionalmente ao faturado por departamento.

DROP FUNCTION IF EXISTS public.receita_inadimplencia_departamento_mes(integer, integer);

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
  WITH faturado_dept AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_dept
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2
  ),
  cliente AS (
    SELECT *
    FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos)
  ),
  alocado AS (
    SELECT
      fd.departamento,
      ROUND(
        SUM(
          c.inadimplencia * CASE
            WHEN c.faturado > 0 THEN fd.faturado_dept / c.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_dept fd
    INNER JOIN cliente c ON c.cliente = fd.cliente
    GROUP BY fd.departamento
  )
  SELECT a.departamento, a.inadimplencia
  FROM alocado a
  WHERE a.inadimplencia > 0
  ORDER BY a.inadimplencia DESC, a.departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer, boolean) IS
  'Inadimplência mensal por área: aloca líquido VIOS do cliente proporcional ao faturado do departamento.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer, boolean) TO anon, authenticated;
