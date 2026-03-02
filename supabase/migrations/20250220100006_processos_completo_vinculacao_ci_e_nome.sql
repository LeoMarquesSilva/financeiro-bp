-- Vinculação processos_completo -> pessoas só por nome (plano): cliente = pessoas.nome.
-- CI na tabela é só para upsert (evitar duplicata); vinculação NÃO usa CI.

-- Função auxiliar: mesmo critério do PROCV (trim, um espaço, minúscula).
CREATE OR REPLACE FUNCTION public.normalize_for_exact_match(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(COALESCE(t, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.processos_completo_vinculacao_pessoa()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  by_exact bigint;
  by_nome bigint;
BEGIN
  WITH updated AS (
    UPDATE processos_completo pc
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE pc.cliente IS NOT NULL AND trim(pc.cliente) <> ''
      AND public.normalize_for_exact_match(pc.cliente) = public.normalize_for_exact_match(p.nome)
      AND (pc.pessoa_id IS NULL OR pc.pessoa_id IS DISTINCT FROM p.id)
    RETURNING pc.id
  )
  SELECT count(*) INTO by_exact FROM updated;

  WITH updated AS (
    UPDATE processos_completo pc
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE pc.pessoa_id IS NULL
      AND pc.cliente IS NOT NULL AND trim(pc.cliente) <> ''
      AND public.normalize_cliente_for_match(pc.cliente) = public.normalize_cliente_for_match(p.nome)
    RETURNING pc.id
  )
  SELECT count(*) INTO by_nome FROM updated;

  RETURN by_exact + by_nome;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.processos_completo_vinculacao_pessoa() TO anon, authenticated;
