-- Corrige matching de plano_contas na cota (dados VIOS com acentos corrompidos / U+FFFD).

CREATE OR REPLACE FUNCTION public.normalize_plano_contas(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(trim(coalesce(t, ''))), '[^A-Z0-9 ]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.plano_contas_na_cota(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_plano_contas(t) = '' THEN false
    WHEN public.normalize_plano_contas(t) = 'PARCERIAS' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%PARCERIAS' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%MENSAIS' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%SPOT' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%SUCUMB%' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%EXITO' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%XITO' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%MANUTEN%' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%HORA TRABALHADA' THEN true
    WHEN public.normalize_plano_contas(t) LIKE 'HONOR%ADVOCAT%' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.receita_totais_mensais(p_ano integer)
RETURNS TABLE (
  mes integer,
  recebido numeric,
  previsto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(valor_pago_item), 0) AS total
    FROM base
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  prev AS (
    SELECT
      EXTRACT(MONTH FROM data_vencimento)::integer AS mes,
      COALESCE(SUM(valor_item), 0) AS total
    FROM base
    WHERE data_vencimento IS NOT NULL
      AND valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(1, 12) AS mes
  )
  SELECT
    m.mes,
    COALESCE(r.total, 0),
    COALESCE(p.total, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.plano_contas_na_cota(text) IS
  'Retorna true se o plano de contas entra na cota de receita (honorários permitidos).';

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais de recebido e previsto considerando apenas planos de honorários da cota (whitelist normalizada).';
