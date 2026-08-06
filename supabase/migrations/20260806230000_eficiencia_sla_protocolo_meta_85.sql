-- Meta D-1 do SLA Protocolo: 85% (jul/2025 em diante e 2026+), alinhado ao BI.
-- Corrige meta_d1 materializada pelo sync quando a regra ainda gravava 90.

UPDATE public.sp_tarefas_historico
SET meta_d1 = 85
WHERE meta_d1 = 90;

COMMENT ON COLUMN public.sp_tarefas_historico.meta_d1 IS
  'Meta D-1 vigente na conclusão (70/80/85 conforme período). Calculado no sync via metaD1PorData.';
