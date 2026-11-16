-- Subcategoria de Resultado Metas: visão completa travada na área da pessoa
-- (Overview e abas de detalhe sem "Todas as áreas").

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
    'eficiencia-area',
    'eficiencia-protocolos',
    'operacoes-legais',
    'timesheet',
    'gestores',
    'configuracoes'
  ));
