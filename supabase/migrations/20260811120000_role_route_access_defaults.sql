-- Matriz de rotas por perfil (menu + ProtectedRoute). Sobrescreve defaults em src/lib/navAccessItems.ts.
INSERT INTO public.app_settings (key, value)
VALUES (
  'role_route_access_defaults',
  '{
    "admin": [
      "/financeiro/configuracoes",
      "/financeiro/cobranca",
      "/financeiro/cobranca/seguimento",
      "/financeiro/eficiencia",
      "/financeiro/escritorio",
      "/financeiro/inadimplencia",
      "/financeiro/inadimplencia/dashboard",
      "/financeiro/inadimplencia/judicializada",
      "/financeiro/operacoes-legais",
      "/financeiro/opex",
      "/financeiro/receita",
      "/financeiro/usuarios"
    ],
    "financeiro": [
      "/financeiro/cobranca",
      "/financeiro/cobranca/seguimento",
      "/financeiro/escritorio",
      "/financeiro/inadimplencia",
      "/financeiro/inadimplencia/dashboard",
      "/financeiro/inadimplencia/judicializada",
      "/financeiro/opex",
      "/financeiro/receita"
    ],
    "comite": [
      "/financeiro/cobranca/seguimento",
      "/financeiro/inadimplencia",
      "/financeiro/inadimplencia/dashboard",
      "/financeiro/inadimplencia/judicializada",
      "/financeiro/receita"
    ],
    "coordenador": []
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_settings IS
  'Configurações globais (taxa comitê, prioridade, metas receita, role_route_access_defaults, etc.).';
