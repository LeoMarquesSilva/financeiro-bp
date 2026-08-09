-- Libera module_key 'operacoes-legais' para acesso granular na sidebar/rota.

ALTER TABLE public.team_member_module_access
  DROP CONSTRAINT IF EXISTS team_member_module_access_module_key_check;

ALTER TABLE public.team_member_module_access
  ADD CONSTRAINT team_member_module_access_module_key_check
  CHECK (module_key IN (
    'inadimplencia',
    'escritorio',
    'cobranca',
    'receita',
    'opex',
    'eficiencia',
    'operacoes-legais',
    'gestores',
    'configuracoes'
  ));

COMMENT ON TABLE public.team_member_module_access IS
  'Acesso granular por módulo do financeiro-bp para um team_member. Inclui operacoes-legais (sidebar Operações Legais).';
