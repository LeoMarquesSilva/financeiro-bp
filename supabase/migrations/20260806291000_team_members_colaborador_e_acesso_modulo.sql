-- Fase 2 da integração Colaboradores/RESPONSUM: vincula team_members a um colaborador
-- (base canônica ORQESTRAI, ver 20260806250000_eficiencia_colaboradores.sql) e permite liberar
-- módulos específicos do financeiro-bp para pessoas específicas, além dos 3 roles existentes
-- (admin/financeiro/comite).

-- ============================================================
-- team_members.colaborador_id
-- ============================================================
ALTER TABLE public.team_members
  ADD COLUMN colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL;

CREATE INDEX team_members_colaborador_id_idx ON public.team_members (colaborador_id);

COMMENT ON COLUMN public.team_members.colaborador_id IS
  'Vínculo opcional com public.colaboradores (fonte de verdade ORQESTRAI.hr_employees). Usado para atribuição por hierarquia/área e para os relatórios de divergência ORQESTRAI x RESPONSUM.';

-- ============================================================
-- team_member_module_access — acesso granular por módulo
-- ============================================================
-- module_key alinhado às rotas em src/app/App.tsx: inadimplencia, escritorio, cobranca,
-- receita, opex, eficiencia, gestores, configuracoes. Um team_member com role=NULL (\"Sem
-- acesso\") pode ainda enxergar módulos específicos liberados aqui — não substitui o role,
-- é um adicional (ver ProtectedRoute em src/app/App.tsx).
CREATE TABLE public.team_member_module_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  module_key      TEXT NOT NULL CHECK (module_key IN (
                    'inadimplencia', 'escritorio', 'cobranca', 'receita',
                    'opex', 'eficiencia', 'gestores', 'configuracoes'
                  )),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, module_key)
);

CREATE INDEX team_member_module_access_team_member_id_idx
  ON public.team_member_module_access (team_member_id);

COMMENT ON TABLE public.team_member_module_access IS
  'Acesso granular por módulo do financeiro-bp para um team_member específico, além dos 3 roles (admin/financeiro/comite). Ver ProtectedRoute em src/app/App.tsx e AuthContext.tsx (moduleAccess).';

-- ============================================================
-- RLS (mesmo padrão permissivo das demais tabelas do painel Eficiência/Colaboradores)
-- ============================================================
ALTER TABLE public.team_member_module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.team_member_module_access
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.team_member_module_access
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
