-- Rastreio de alteração em configurações globais (ex.: receita_metas).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.app_settings.updated_at IS 'Última alteração do valor (metas receita, templates cobrança, etc.).';

CREATE OR REPLACE FUNCTION public.app_settings_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.app_settings_touch_updated_at();

-- Garante seed global de metas de receita (nunca só no frontend).
INSERT INTO public.app_settings (key, value)
VALUES (
  'receita_metas',
  '{
    "ano": 2026,
    "meses": [5, 6, 7, 8, 9, 10, 11, 12],
    "meta": 1428571.43,
    "projetado_base_abril": 1173008.66,
    "projetado_real": {
      "5": 1172379.75,
      "6": 1169484.68,
      "7": 1126982.14,
      "8": 1103817.14,
      "9": 1168013.73,
      "10": 1066187.15,
      "11": 1068230.49,
      "12": 1069730.49
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
