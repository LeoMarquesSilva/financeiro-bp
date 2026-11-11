-- Planejamento 2027: títulos de um cliente com receita sem área (para a pessoa identificar a área ao
-- classificar) e onde o mesmo cliente pagou em áreas (2025 em diante). Só leitura.

CREATE OR REPLACE FUNCTION public.planejamento_receita_sem_area_titulos(p_ano integer, p_cliente text)
RETURNS TABLE(
  ci_titulo integer,
  nro_titulo text,
  ci_item integer,
  mes integer,
  data_vencimento date,
  data_pagamento date,
  competencia date,
  valor numeric,
  plano_contas text,
  descricao text,
  departamento text,
  contrato text,
  etiquetas text,
  nfse text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  SELECT
    i.ci_titulo,
    i.nro_titulo,
    i.ci_item,
    extract(month FROM i.data_pagamento)::integer,
    i.data_vencimento,
    i.data_pagamento,
    i.competencia_titulo,
    public.receita_item_recebido_liquido(i),
    i.plano_contas,
    i.descricao,
    i.departamento,
    i.contrato,
    i.etiquetas_titulo,
    i.nfse_titulo
  FROM financeiro_parcelas_itens i
  WHERE i.cliente IS NOT DISTINCT FROM p_cliente
    AND (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento >= make_date(p_ano, 1, 1)
    AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
    AND NOT EXISTS (SELECT 1 FROM dl_areas a WHERE a.departamento = i.departamento)
  ORDER BY i.data_pagamento, i.ci_titulo, i.ci_item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.planejamento_cliente_historico_areas(p_cliente text)
RETURNS TABLE(area_key text, ano integer, titulos integer, total numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  SELECT a.area_key, extract(year FROM i.data_pagamento)::integer, count(*)::integer, round(sum(public.receita_item_recebido_liquido(i)), 2)
  FROM financeiro_parcelas_itens i
  JOIN dl_areas a ON a.departamento = i.departamento
  WHERE i.cliente IS NOT DISTINCT FROM p_cliente
    AND (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento >= DATE '2025-01-01'
  GROUP BY 1, 2
  ORDER BY 4 DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_receita_sem_area_titulos(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planejamento_cliente_historico_areas(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planejamento_receita_sem_area_titulos(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planejamento_cliente_historico_areas(text) TO authenticated;
