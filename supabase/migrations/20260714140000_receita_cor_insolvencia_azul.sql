-- Atualiza a cor persistida de Insolvência para não conflitar com o roxo do Previsto.

UPDATE public.app_settings
SET value = jsonb_set(value, '{insolvencia}', '"#1d4ed8"'::jsonb, true)
WHERE key = 'receita_departamento_cores';
