-- Espelha avatar_url do RESPONSUM (app_c009c0e4f1_users) no sync de colaboradores,
-- para exibir foto na UI (ex.: responsável na amostra de chamados FATAL).

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.colaboradores.avatar_url IS
  'URL pública da foto do usuário no RESPONSUM (app_c009c0e4f1_users.avatar_url), sincronizada por scripts/sync-colaboradores.mjs. NULL se sem match ou sem foto cadastrada.';
