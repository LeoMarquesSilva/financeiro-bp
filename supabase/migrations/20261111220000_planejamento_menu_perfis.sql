-- Planejamento 2027 vira módulo do menu: liberado por padrão para os perfis Admin e Financeiro.
-- Os perfis salvos (app_settings.role_route_access_defaults) listam as rotas de cada perfil;
-- sem esta inclusão a rota nova ficaria bloqueada (mesmo padrão do DL em 20261026190000_dl_modulo.sql).

UPDATE public.app_settings
SET value = jsonb_set(value, '{admin}', (value -> 'admin') || '"/financeiro/planejamento-2027"'::jsonb)
WHERE key = 'role_route_access_defaults'
  AND NOT (value -> 'admin') ? '/financeiro/planejamento-2027';

UPDATE public.app_settings
SET value = jsonb_set(value, '{financeiro}', (value -> 'financeiro') || '"/financeiro/planejamento-2027"'::jsonb)
WHERE key = 'role_route_access_defaults'
  AND NOT (value -> 'financeiro') ? '/financeiro/planejamento-2027';
