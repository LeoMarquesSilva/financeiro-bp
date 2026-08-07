-- Metadados e helpers de Auth para a página Usuários.
-- Somente admin ativo. Não altera roles nem team_member_module_access.

CREATE OR REPLACE FUNCTION public.admin_list_auth_meta(p_emails text[])
RETURNS TABLE (
  email text,
  has_auth boolean,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar metadados de acesso';
  END IF;

  RETURN QUERY
  SELECT
    lower(trim(e.email))::text AS email,
    (u.id IS NOT NULL) AS has_auth,
    u.last_sign_in_at,
    u.created_at,
    u.email_confirmed_at
  FROM unnest(COALESCE(p_emails, ARRAY[]::text[])) AS e(email)
  LEFT JOIN auth.users u
    ON lower(u.email) = lower(trim(e.email));
END;
$$;

COMMENT ON FUNCTION public.admin_list_auth_meta(text[]) IS
  'Admin: last_sign_in_at / created_at / email_confirmed_at de auth.users por lista de e-mails.';

REVOKE ALL ON FUNCTION public.admin_list_auth_meta(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_meta(text[]) TO authenticated;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_get_auth_user_id(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar usuários Auth';
  END IF;

  SELECT u.id INTO _id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_auth_user_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_auth_user_id(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Redefine senha para o padrão 123456 e força troca no próximo login.
-- Mesmo padrão de crypt usado em change_user_password.

CREATE OR REPLACE FUNCTION public.admin_reset_password_padrao(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  _uid uuid;
  _email text := lower(trim(p_email));
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RETURN json_build_object('error', 'Apenas administradores podem redefinir senha');
  END IF;

  IF _email = '' THEN
    RETURN json_build_object('error', 'E-mail inválido');
  END IF;

  SELECT u.id INTO _uid
  FROM auth.users u
  WHERE lower(u.email) = _email
  LIMIT 1;

  IF _uid IS NULL THEN
    RETURN json_build_object('error', 'Usuário Auth não encontrado — ative o login primeiro');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('123456', gen_salt('bf')),
      updated_at = now()
  WHERE id = _uid;

  UPDATE public.team_members
  SET password_changed = false,
      updated_at = now()
  WHERE lower(email) = _email;

  RETURN json_build_object('success', true, 'default_password', '123456');
END;
$$;

COMMENT ON FUNCTION public.admin_reset_password_padrao(text) IS
  'Admin: redefine senha Auth para 123456 e password_changed=false em team_members.';

REVOKE ALL ON FUNCTION public.admin_reset_password_padrao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_password_padrao(text) TO authenticated;
