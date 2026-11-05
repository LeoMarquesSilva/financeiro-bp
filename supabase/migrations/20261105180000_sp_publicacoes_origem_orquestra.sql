-- BKP de publicações: com a esteira do SharePoint desligada, o Orquestra (Central de Vistagem) passa a gravar em
-- sp_publicacoes, com as mesmas colunas e valores da lista BKP. As linhas do SharePoint continuam como estão.
--   origem        'sharepoint' (lista BKP, via sync-sharepoint.mjs) ou 'orquestra' (gravada pelo Orquestra)
--   orquestra_id  id da publicação no Orquestra (vistagem_publicacoes.id); chave do upsert de lá
--   sp_id         o SharePoint manda o ID do item; para o Orquestra o SIOE gera a partir de 900000001, longe dos
--                 IDs da lista (hoje ~170 mil), para nunca colidirem
-- O sync do SharePoint só apaga órfãos com origem 'sharepoint' (sync-sharepoint.mjs).

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sharepoint',
  ADD COLUMN IF NOT EXISTS orquestra_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sp_publicacoes_origem_check') THEN
    ALTER TABLE public.sp_publicacoes
      ADD CONSTRAINT sp_publicacoes_origem_check CHECK (origem IN ('sharepoint', 'orquestra'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sp_publicacoes_orquestra_id_key') THEN
    ALTER TABLE public.sp_publicacoes
      ADD CONSTRAINT sp_publicacoes_orquestra_id_key UNIQUE (orquestra_id);
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.sp_publicacoes_orquestra_sp_id_seq START WITH 900000001;
ALTER SEQUENCE public.sp_publicacoes_orquestra_sp_id_seq OWNED BY public.sp_publicacoes.sp_id;
ALTER TABLE public.sp_publicacoes
  ALTER COLUMN sp_id SET DEFAULT nextval('public.sp_publicacoes_orquestra_sp_id_seq');
GRANT USAGE, SELECT ON SEQUENCE public.sp_publicacoes_orquestra_sp_id_seq TO service_role;

CREATE INDEX IF NOT EXISTS sp_publicacoes_origem_criado_idx ON public.sp_publicacoes (origem, criado);

COMMENT ON COLUMN public.sp_publicacoes.origem IS
  'sharepoint = lista BKP (sync-sharepoint.mjs); orquestra = gravada pela Central de Vistagem do Orquestra.';
COMMENT ON COLUMN public.sp_publicacoes.orquestra_id IS
  'vistagem_publicacoes.id no Orquestra (só nas linhas com origem orquestra).';
