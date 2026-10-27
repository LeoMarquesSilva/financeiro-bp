-- DL: clientes com honorários recebidos por área no ano (para montar a carteira dos gestores).

CREATE OR REPLACE FUNCTION public.dl_clientes_area(p_ano integer)
RETURNS TABLE(area_key text, cliente text, liquido numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  SELECT a.area_key, trim(i.cliente),
    round(sum(i.valor_pago_item * CASE WHEN trim(i.nfse_titulo) ~ '^[0-9]+$' THEN 1 - 0.160587 ELSE 1 END)::numeric, 2)
  FROM financeiro_parcelas_itens i
  JOIN dl_areas a ON a.departamento = i.departamento
  WHERE i.tipo = 'RECEBER'
    AND i.cliente IS NOT NULL
    AND i.data_pagamento >= make_date(p_ano, 1, 1)
    AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
    AND i.plano_contas IN (
      'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
      'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
      'HONORÁRIOS POR HORA TRABALHADA'
    )
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_clientes_area(integer) TO authenticated;
