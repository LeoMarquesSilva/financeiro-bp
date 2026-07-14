-- Define bordô/vinho para Insolvência em todas as visualizações de Receita.

UPDATE public.app_settings
SET value = jsonb_set(value, '{insolvencia}', '"#7f1d1d"'::jsonb, true)
WHERE key = 'receita_departamento_cores';
