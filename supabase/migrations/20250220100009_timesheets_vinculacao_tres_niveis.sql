-- Vinculação timesheets.cliente = pessoas.nome (mesma lógica de processos_completo).
-- 3 níveis: 1) lower+trim, 2) normalize_for_exact_match, 3) normalize_cliente_for_match (unaccent).

CREATE OR REPLACE FUNCTION public.timesheets_vinculacao_pessoa()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  by_simple bigint;
  by_exact bigint;
  by_nome bigint;
BEGIN
  -- 1) Mais simples: lower(trim(cliente)) = lower(trim(nome))
  WITH updated AS (
    UPDATE timesheets t
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE t.cliente IS NOT NULL AND trim(t.cliente) <> ''
      AND lower(trim(t.cliente)) = lower(trim(p.nome))
      AND (t.pessoa_id IS NULL OR t.pessoa_id IS DISTINCT FROM p.id)
    RETURNING t.id
  )
  SELECT count(*) INTO by_simple FROM updated;

  -- 2) Trim + colapsar espaços + lower
  WITH updated AS (
    UPDATE timesheets t
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE t.pessoa_id IS NULL
      AND t.cliente IS NOT NULL AND trim(t.cliente) <> ''
      AND public.normalize_for_exact_match(t.cliente) = public.normalize_for_exact_match(p.nome)
    RETURNING t.id
  )
  SELECT count(*) INTO by_exact FROM updated;

  -- 3) Fallback: unaccent (São = Sao)
  WITH updated AS (
    UPDATE timesheets t
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE t.pessoa_id IS NULL
      AND t.cliente IS NOT NULL AND trim(t.cliente) <> ''
      AND public.normalize_cliente_for_match(t.cliente) = public.normalize_cliente_for_match(p.nome)
    RETURNING t.id
  )
  SELECT count(*) INTO by_nome FROM updated;

  RETURN by_simple + by_exact + by_nome;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.timesheets_vinculacao_pessoa() TO anon, authenticated;
