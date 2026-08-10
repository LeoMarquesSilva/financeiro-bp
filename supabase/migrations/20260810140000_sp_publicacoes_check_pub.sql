-- SharePoint lista Publicações: coluna CHECK (nome interno field_13).
-- Exibida no racional Ops Legais (Análise / Agendamento), alinhado ao BI.

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS check_pub text;

COMMENT ON COLUMN public.sp_publicacoes.check_pub IS
  'SharePoint CHECK (field_13) — validação/controle da publicação.';
