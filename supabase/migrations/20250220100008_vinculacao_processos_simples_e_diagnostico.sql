-- Vinculação processos_completo.cliente = pessoas.nome em 3 níveis (do mais simples ao mais flexível).
-- Se ainda ficar null, rode a query de diagnóstico no final do arquivo.

CREATE OR REPLACE FUNCTION public.processos_completo_vinculacao_pessoa()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  by_simple bigint;
  by_exact bigint;
  by_nome bigint;
BEGIN
  -- 1) Mais simples: lower(trim(cliente)) = lower(trim(nome)) — igual PROCV exato
  WITH updated AS (
    UPDATE processos_completo pc
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE pc.cliente IS NOT NULL AND trim(pc.cliente) <> ''
      AND lower(trim(pc.cliente)) = lower(trim(p.nome))
      AND (pc.pessoa_id IS NULL OR pc.pessoa_id IS DISTINCT FROM p.id)
    RETURNING pc.id
  )
  SELECT count(*) INTO by_simple FROM updated;

  -- 2) Trim + colapsar espaços + lower (normalize_for_exact_match)
  WITH updated AS (
    UPDATE processos_completo pc
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE pc.pessoa_id IS NULL
      AND pc.cliente IS NOT NULL AND trim(pc.cliente) <> ''
      AND public.normalize_for_exact_match(pc.cliente) = public.normalize_for_exact_match(p.nome)
    RETURNING pc.id
  )
  SELECT count(*) INTO by_exact FROM updated;

  -- 3) Fallback: unaccent (São = Sao)
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

  RETURN by_simple + by_exact + by_nome;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.processos_completo_vinculacao_pessoa() TO anon, authenticated;

-- ========== DIAGNÓSTICO (rode no SQL Editor para ver por que não vinculou) ==========
-- Ver amostra de processos_completo.cliente vs pessoas.nome (primeiros 20 sem vínculo):
--
--   SELECT pc.cliente AS processo_cliente,
--          p.nome AS pessoa_nome,
--          length(pc.cliente) AS len_cliente,
--          length(p.nome) AS len_nome,
--          lower(trim(pc.cliente)) = lower(trim(p.nome)) AS match_simples
--   FROM processos_completo pc
--   LEFT JOIN pessoas p ON lower(trim(pc.cliente)) = lower(trim(p.nome))
--   WHERE pc.pessoa_id IS NULL
--   LIMIT 20;
--
-- Ver nomes distintos em pessoas (amostra):
--
--   SELECT DISTINCT nome FROM pessoas LIMIT 30;
--
-- Ver clientes distintos em processos_completo (amostra):
--
--   SELECT DISTINCT cliente FROM processos_completo WHERE pessoa_id IS NULL LIMIT 30;
--
