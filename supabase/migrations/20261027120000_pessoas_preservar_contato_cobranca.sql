-- Contatos de cobrança editados no SIOE eram apagados pelo sync de pessoas do VIOS,
-- que faz upsert por CI incluindo telefone/e-mail (normalmente vazios no VIOS).
-- O painel lê pessoas.telefone/email, então o contato "sumia" e era cadastrado de novo.
--
-- Fonte da verdade do contato de cobrança:
--   telefone -> primeiro registro de pessoa_telefones_whatsapp (tabela gerida só pelo SIOE)
--   e-mail   -> pessoas.email_cobranca (coluna que o sync do VIOS não envia)
-- O trigger mantém pessoas.telefone/email espelhando esses valores a cada UPDATE.

ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS email_cobranca text;

COMMENT ON COLUMN public.pessoas.email_cobranca IS
  'E-mail de cobrança informado no SIOE; prevalece sobre o e-mail do VIOS.';

CREATE OR REPLACE FUNCTION private.pessoas_preservar_contato_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_telefone text;
BEGIN
  IF NULLIF(BTRIM(NEW.email_cobranca), '') IS NOT NULL THEN
    NEW.email := BTRIM(NEW.email_cobranca);
  END IF;

  SELECT t.telefone
    INTO v_telefone
  FROM public.pessoa_telefones_whatsapp t
  WHERE t.pessoa_id = NEW.id
  ORDER BY t.ordem, t.created_at
  LIMIT 1;

  IF v_telefone IS NOT NULL THEN
    NEW.telefone := v_telefone;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.pessoas_preservar_contato_cobranca() FROM PUBLIC;

DROP TRIGGER IF EXISTS pessoas_preservar_contato_cobranca ON public.pessoas;

CREATE TRIGGER pessoas_preservar_contato_cobranca
  BEFORE UPDATE ON public.pessoas
  FOR EACH ROW
  EXECUTE FUNCTION private.pessoas_preservar_contato_cobranca();

-- Restaura o telefone principal das pessoas que tiveram o valor sobrescrito pelo sync.
-- (E-mails já apagados não têm histórico para recuperar.)
UPDATE public.pessoas p
SET telefone = t.telefone
FROM (
  SELECT DISTINCT ON (pessoa_id) pessoa_id, telefone
  FROM public.pessoa_telefones_whatsapp
  ORDER BY pessoa_id, ordem, created_at
) t
WHERE t.pessoa_id = p.id
  AND p.telefone IS DISTINCT FROM t.telefone;
