-- Usa grafite para Insolvência: cor neutra e distinta de todas as áreas e séries existentes.

UPDATE public.app_settings
SET value = jsonb_set(value, '{insolvencia}', '"#111827"'::jsonb, true)
WHERE key = 'receita_departamento_cores';
