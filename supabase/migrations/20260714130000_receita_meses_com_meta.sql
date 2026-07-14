-- Mantém o histórico de receita de janeiro a maio/2026 no dashboard,
-- mas informa que a meta institucional passou a existir somente em junho.
-- O frontend usa `meses_meta` para não gerar meta, gap, rateio ou atingimento
-- nos meses anteriores.

UPDATE public.app_settings
SET value = value || jsonb_build_object(
  'meses_meta',
  jsonb_build_array(6, 7, 8, 9, 10, 11, 12)
)
WHERE key = 'receita_metas'
  AND (value->>'ano')::integer = 2026;
