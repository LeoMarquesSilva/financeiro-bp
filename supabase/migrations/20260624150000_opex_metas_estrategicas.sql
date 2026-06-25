-- Metas estratégicas OPEX (iniciativas de economia e custo evitado).

INSERT INTO public.app_settings (key, value)
VALUES (
  'opex_metas_estrategicas',
  '{
    "meta_min_iniciativas": 1,
    "meta_min_valor_anual": 5000,
    "iniciativas": []
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_settings IS
  'Configurações globais (receita_metas, opex_metas_estrategicas, templates cobrança, etc.).';
