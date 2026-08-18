-- Ex-colaborador (colaboradores.is_active = false) não pode ter login SIOE.
-- Desativa team_members vinculados (FK, e-mail ou local-part bpplaw ↔ bismarchipires).

CREATE OR REPLACE FUNCTION public.desativar_login_ex_colaboradores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer := 0;
BEGIN
  UPDATE public.team_members tm
  SET
    is_active = false,
    updated_at = now()
  WHERE tm.is_active IS DISTINCT FROM false
    AND EXISTS (
      SELECT 1
      FROM public.colaboradores c
      WHERE c.is_active = false
        AND (
          tm.colaborador_id = c.id
          OR (
            c.email IS NOT NULL
            AND trim(c.email) <> ''
            AND (
              lower(tm.email) = lower(trim(c.email))
              OR split_part(lower(tm.email), '@', 1)
                = split_part(lower(trim(c.email)), '@', 1)
            )
          )
        )
    );

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

COMMENT ON FUNCTION public.desativar_login_ex_colaboradores() IS
  'Desativa team_members.is_active de quem está ex-colaborador no RH.';

REVOKE ALL ON FUNCTION public.desativar_login_ex_colaboradores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desativar_login_ex_colaboradores() TO service_role;
GRANT EXECUTE ON FUNCTION public.desativar_login_ex_colaboradores() TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_desativar_login_ex_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM false) THEN
    UPDATE public.team_members tm
    SET
      is_active = false,
      updated_at = now()
    WHERE tm.is_active IS DISTINCT FROM false
      AND (
        tm.colaborador_id = NEW.id
        OR (
          NEW.email IS NOT NULL
          AND trim(NEW.email) <> ''
          AND (
            lower(tm.email) = lower(trim(NEW.email))
            OR split_part(lower(tm.email), '@', 1)
              = split_part(lower(trim(NEW.email)), '@', 1)
          )
        )
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS colaboradores_desativar_login_ex ON public.colaboradores;
CREATE TRIGGER colaboradores_desativar_login_ex
  AFTER INSERT OR UPDATE OF is_active, email
  ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_desativar_login_ex_colaborador();

SELECT public.desativar_login_ex_colaboradores();
