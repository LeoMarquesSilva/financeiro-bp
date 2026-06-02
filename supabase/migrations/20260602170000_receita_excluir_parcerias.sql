-- Remove PARCERIAS e HONORARIOS PARCERIAS da cota de receita.

CREATE OR REPLACE FUNCTION public.plano_contas_na_cota(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_plano_contas(t) = '' THEN false
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

COMMENT ON FUNCTION public.plano_contas_na_cota(text) IS
  'Retorna true se o plano de contas entra na cota de receita (7 tipos de honorários; sem parcerias).';
