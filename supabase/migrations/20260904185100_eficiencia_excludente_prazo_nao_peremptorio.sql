-- Inclui "PRAZO NÃO PEREMPTÓRIO - ESTRATÉGIA PROCESSUAL" na lista de
-- justificativas excludentes de FATAL (SLA Protocolo). Histórico já
-- sincronizado ficava como "Não" e entrava no KPI.

UPDATE public.sp_tarefas_historico
SET excludente = 'Excludente'
WHERE upper(trim(justificativa_fatal)) = upper(trim('PRAZO NÃO PEREMPTÓRIO - ESTRATÉGIA PROCESSUAL'))
  AND excludente IS DISTINCT FROM 'Excludente';
