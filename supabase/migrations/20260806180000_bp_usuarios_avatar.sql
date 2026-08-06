-- Catálogo de colaboradores + fotos (fonte: projeto ticket-bp / app_c009c0e4f1_users).
-- Sync: npm run sync:avatars  → scripts/sync-ticket-avatars.mjs

CREATE TABLE public.bp_usuarios_avatar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  email        TEXT,
  avatar_url   TEXT,
  nome_chave   TEXT NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bp_usuarios_avatar_email_key UNIQUE (email)
);

CREATE INDEX bp_usuarios_avatar_nome_chave_idx ON public.bp_usuarios_avatar (nome_chave);
CREATE INDEX bp_usuarios_avatar_nome_idx ON public.bp_usuarios_avatar (nome);

COMMENT ON TABLE public.bp_usuarios_avatar IS
  'Espelho de usuários do ticket-bp (app_c009c0e4f1_users) com avatar_url público. Usado nas miniaturas dos rankings de responsável da Eficiência.';

CREATE TRIGGER bp_usuarios_avatar_updated_at
  BEFORE UPDATE ON public.bp_usuarios_avatar
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.bp_usuarios_avatar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for anon" ON public.bp_usuarios_avatar
  FOR SELECT TO anon USING (true);
CREATE POLICY "Allow select for authenticated" ON public.bp_usuarios_avatar
  FOR SELECT TO authenticated USING (true);
-- Escrita apenas via service_role (sync script); RLS bypass no service_role.
