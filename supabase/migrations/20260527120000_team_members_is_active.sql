ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.team_members.is_active IS 'Quando false, o usuário não pode acessar o sistema nem ser selecionado como gestor.';

CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON public.team_members (is_active);
