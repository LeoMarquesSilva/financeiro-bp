-- Complementa 20261027120000_pessoas_preservar_contato_cobranca: o contato salvo no SIOE
-- continua protegido contra o sync do VIOS, mas uma ALTERAÇÃO REAL feita no VIOS volta a
-- prevalecer (vale a mudança mais recente, feita em qualquer um dos dois sistemas).
--
-- Para saber se o VIOS mudou, guardamos o último telefone/e-mail recebido dele
-- (telefone_vios/email_vios) e comparamos com o que chega em cada carga.
-- Carga externa = role anon/service_role (sync do VIOS); o SIOE grava como authenticated.

ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS telefone_vios text,
  ADD COLUMN IF NOT EXISTS email_vios text,
  ADD COLUMN IF NOT EXISTS contato_vios_capturado_em timestamptz;

COMMENT ON COLUMN public.pessoas.telefone_vios IS 'Último telefone recebido do VIOS (bruto).';
COMMENT ON COLUMN public.pessoas.email_vios IS 'Último e-mail recebido do VIOS (bruto).';
COMMENT ON COLUMN public.pessoas.contato_vios_capturado_em IS
  'Quando telefone_vios/email_vios foram capturados; NULL = ainda sem referência do VIOS.';

CREATE OR REPLACE FUNCTION private.pessoas_preservar_contato_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_carga_externa boolean := current_user IN ('anon', 'service_role');
  v_tem_referencia boolean;
  v_tel_vios text;
  v_tel_vios_anterior text;
  v_existente uuid;
  v_telefone text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_carga_externa THEN
      NEW.telefone_vios := NEW.telefone;
      NEW.email_vios := NEW.email;
      NEW.contato_vios_capturado_em := now();
    END IF;
    RETURN NEW;
  END IF;

  IF v_carga_externa THEN
    -- Na primeira carga após a migration só registramos a referência do VIOS.
    v_tem_referencia := OLD.contato_vios_capturado_em IS NOT NULL;

    -- E-mail alterado no VIOS: substitui o informado no SIOE.
    IF v_tem_referencia
       AND NULLIF(BTRIM(NEW.email), '') IS NOT NULL
       AND lower(BTRIM(NEW.email)) IS DISTINCT FROM lower(BTRIM(OLD.email_vios)) THEN
      NEW.email_cobranca := NULL;
    END IF;

    -- Normaliza o telefone recebido e o anterior do VIOS no formato gravado pelo SIOE
    -- (E.164 sem "+", espelhando normalizePhoneE164 para BR). Fica inline porque o
    -- sync roda como anon, que não tem acesso ao schema private.
    SELECT
      max(n) FILTER (WHERE k = 1),
      max(n) FILTER (WHERE k = 2)
      INTO v_tel_vios, v_tel_vios_anterior
    FROM (
      SELECT k, CASE
        WHEN d = '' THEN NULL
        -- Celular antigo sem o nono dígito: DDD + 8 dígitos iniciando em 6–9.
        WHEN length(l) = 10 AND substr(l, 3, 1) BETWEEN '6' AND '9'
          THEN '55' || substr(l, 1, 2) || '9' || substr(l, 3)
        WHEN length(l) IN (10, 11) THEN '55' || l
        WHEN length(d) BETWEEN 8 AND 15 THEN d
      END AS n
      FROM (
        SELECT k, d, CASE WHEN d LIKE '55%' AND length(d) IN (12, 13) THEN substr(d, 3) ELSE d END AS l
        FROM (
          -- Campo com vários números ("(11) 1111-1111 / (11) 2222-2222"): usa o primeiro.
          SELECT u.k, ltrim(regexp_replace((regexp_split_to_array(COALESCE(u.v, ''), '[/,;|]'))[1], '\D', '', 'g'), '0') AS d
          FROM unnest(ARRAY[NEW.telefone, OLD.telefone_vios]) WITH ORDINALITY AS u(v, k)
        ) digitos
      ) locais
    ) normalizados;

    -- Telefone alterado no VIOS: passa a ser o principal da lista do SIOE.
    IF v_tem_referencia
       AND v_tel_vios IS NOT NULL
       AND v_tel_vios IS DISTINCT FROM v_tel_vios_anterior
       AND EXISTS (SELECT 1 FROM public.pessoa_telefones_whatsapp t WHERE t.pessoa_id = NEW.id) THEN
      SELECT t.id
        INTO v_existente
      FROM public.pessoa_telefones_whatsapp t
      WHERE t.pessoa_id = NEW.id
        AND right(t.telefone, 8) = right(v_tel_vios, 8)
      LIMIT 1;

      IF v_existente IS NOT NULL THEN
        UPDATE public.pessoa_telefones_whatsapp
        SET ordem = (SELECT min(t.ordem) - 1 FROM public.pessoa_telefones_whatsapp t WHERE t.pessoa_id = NEW.id),
            updated_at = now()
        WHERE id = v_existente;
      ELSE
        INSERT INTO public.pessoa_telefones_whatsapp (pessoa_id, nome, telefone, ordem)
        SELECT NEW.id, COALESCE(NULLIF(BTRIM(NEW.nome), ''), 'VIOS'), v_tel_vios, min(t.ordem) - 1
        FROM public.pessoa_telefones_whatsapp t
        WHERE t.pessoa_id = NEW.id;
      END IF;
    END IF;

    NEW.telefone_vios := NEW.telefone;
    NEW.email_vios := NEW.email;
    NEW.contato_vios_capturado_em := now();
  END IF;

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

-- Ajustes de dados abaixo não devem mexer em updated_at (usado como referência de edição).
ALTER TABLE public.pessoas DISABLE TRIGGER pessoas_updated_at;

-- E-mails editados no SIOE depois do sync de hoje (07h UTC), ainda pela versão antiga do
-- front, que gravava só pessoas.email: marca como e-mail de cobrança para o próximo sync
-- não apagá-los. Ignora o minuto da restauração de telefones (só alterou telefone).
UPDATE public.pessoas
SET email_cobranca = BTRIM(email)
WHERE updated_at >= '2026-10-27 08:00:00+00'
  AND date_trunc('minute', updated_at) <> '2026-10-27 12:51:00+00'
  AND email_cobranca IS NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL;

-- Referência do VIOS: sem telefones no SIOE e sem edição após o sync, pessoas.telefone/email
-- ainda são os valores brutos do VIOS. Para os demais o valor do VIOS foi sobrescrito, então
-- a referência fica para a próxima carga (contato_vios_capturado_em NULL).
UPDATE public.pessoas p
SET telefone_vios = p.telefone,
    email_vios = p.email,
    contato_vios_capturado_em = now()
WHERE p.contato_vios_capturado_em IS NULL
  AND p.updated_at < '2026-10-27 08:00:00+00'
  AND p.email_cobranca IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.pessoa_telefones_whatsapp t WHERE t.pessoa_id = p.id);

ALTER TABLE public.pessoas ENABLE TRIGGER pessoas_updated_at;

DROP TRIGGER IF EXISTS pessoas_preservar_contato_cobranca ON public.pessoas;

CREATE TRIGGER pessoas_preservar_contato_cobranca
  BEFORE INSERT OR UPDATE ON public.pessoas
  FOR EACH ROW
  EXECUTE FUNCTION private.pessoas_preservar_contato_cobranca();
