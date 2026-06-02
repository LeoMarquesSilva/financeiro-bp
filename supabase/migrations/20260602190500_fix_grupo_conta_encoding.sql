-- Ajuste: canonical_grupo_conta colapsa espaços (hífen vira duplo espaço na normalização).

CREATE OR REPLACE FUNCTION public.canonical_grupo_conta(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE regexp_replace(public.normalize_plano_contas(t), '\s+', ' ', 'g')
    WHEN 'ENTRADAS EMPRSTIMOS APLICAES E DEVO' THEN 'ENTRADAS - EMPRÉSTIMOS APLICAÇÕES E DEVO'
    WHEN 'RECEITAS NO OPERACIONAIS' THEN 'RECEITAS NÃO OPERACIONAIS'
    ELSE NULLIF(TRIM(t), '')
  END;
$$;

UPDATE financeiro_parcelas_itens
SET grupo_conta = public.canonical_grupo_conta(grupo_conta)
WHERE grupo_conta IS DISTINCT FROM public.canonical_grupo_conta(grupo_conta);
