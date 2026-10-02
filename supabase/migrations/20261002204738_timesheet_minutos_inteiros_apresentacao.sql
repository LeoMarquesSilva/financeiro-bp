-- Timesheet da apresentação: somar minutos inteiros por lançamento.
-- O decimal de 2 casas do VIOS (0,02 h = 1 min) infla o total se for somado direto.

CREATE OR REPLACE FUNCTION public.timesheet_minutos_linha(p_horas numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_horas IS NULL OR p_horas <= 0 THEN 0
    ELSE FLOOR(p_horas)::integer * 60
         + ROUND((p_horas - FLOOR(p_horas)) * 60)::integer
  END;
$$;

COMMENT ON FUNCTION public.timesheet_minutos_linha(numeric) IS
  'Minutos inteiros de um lançamento de timesheet: parte inteira da hora × 60 + arredondamento da fração. Nulo, zero ou negativo = 0.';

REVOKE ALL ON FUNCTION public.timesheet_minutos_linha(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.timesheet_minutos_linha(numeric) TO anon, authenticated, service_role;

DO $migration$
DECLARE
  v_definition text;
  v_old constant text := 'SUM(COALESCE(total_horas_decimal, total_horas, 0))';
  v_new constant text := 'SUM(public.timesheet_minutos_linha(COALESCE(total_horas_decimal, total_horas, 0)::numeric))';
BEGIN
  SELECT pg_get_functiondef(
    'public.eficiencia_apresentacao_bignumbers(integer,integer[])'::regprocedure
  )
  INTO v_definition;

  IF strpos(v_definition, 'timesheet_minutos_linha') > 0 THEN
    RETURN;
  END IF;

  IF strpos(v_definition, v_old) = 0 THEN
    RAISE EXCEPTION
      'Soma de horas do timesheet não encontrada em eficiencia_apresentacao_bignumbers';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;

COMMENT ON FUNCTION public.eficiencia_apresentacao_bignumbers(integer, integer[]) IS
  'Big Numbers comparativo. Timesheet soma minutos inteiros por lançamento (não o decimal de 2 casas). Colombo e Rápido 900 entram em Grupo Ex-Cliente.';
