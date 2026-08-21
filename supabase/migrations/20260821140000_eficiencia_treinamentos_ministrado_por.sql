-- Ministrante da sessão (lookup SharePoint — lista mestre de treinamentos).

ALTER TABLE public.sp_treinamentos_presenca
  ADD COLUMN IF NOT EXISTS ministrado_por TEXT;

COMMENT ON COLUMN public.sp_treinamentos_presenca.ministrado_por IS
  'Responsável por ministrar a sessão (campo "Ministrado por" na lista mestre SharePoint).';
