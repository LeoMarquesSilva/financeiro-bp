-- Big Numbers: Grupo Rápido 900 também pertence ao Grupo Ex-Cliente.
-- Altera as três fontes do ranking (timesheet, publicações e tarefas).

DO $migration$
DECLARE
  v_definition text;
  v_old_aliases constant text :=
    $aliases$IN ('grupo colombo', 'grupo ex-cliente')$aliases$;
  v_new_aliases constant text :=
    $aliases$IN ('grupo colombo', 'grupo ex-cliente', 'grupo rápido 900', 'grupo rapido 900')$aliases$;
BEGIN
  SELECT pg_get_functiondef(
    'public.eficiencia_apresentacao_bignumbers(integer,integer[])'::regprocedure
  )
  INTO v_definition;

  IF strpos(v_definition, v_new_aliases) > 0 THEN
    RETURN;
  END IF;

  IF strpos(v_definition, v_old_aliases) = 0 THEN
    RAISE EXCEPTION
      'Não foi possível localizar a lista canônica de grupos em eficiencia_apresentacao_bignumbers';
  END IF;

  v_definition := replace(v_definition, v_old_aliases, v_new_aliases);
  EXECUTE v_definition;
END;
$migration$;

COMMENT ON FUNCTION public.eficiencia_apresentacao_bignumbers(integer, integer[]) IS
  'Big Numbers comparativo: Grupo Colombo e Grupo Rápido 900 são consolidados em Grupo Ex-Cliente antes dos TOP 5.';
