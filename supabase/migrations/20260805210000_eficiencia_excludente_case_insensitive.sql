-- Corrige Excludente em sp_tarefas_historico: o sync comparava justificativa
-- case-sensitive e o SharePoint grava em UPPERCASE → FATALs excludentes
-- ficavam como "Não" e entravam no KPI/racional de SLA Protocolo.

UPDATE public.sp_tarefas_historico
SET excludente = CASE
  WHEN upper(trim(justificativa_fatal)) IN (
    upper('Prazo De 24/48Hrs'),
    upper('Agendado Em 5 Dias Corridos - Quarta/Quinta'),
    upper('Agendado Pelo Sistema Em Dia Anterior'),
    upper('Atraso No Envio De Documentação Pelo Cliente'),
    upper('EXCLUDENTE DE FATAL - VALIDADO POR OPS. LEGAIS'),
    upper('Atraso No Pagamento De Guia Pelo Cliente')
  ) THEN 'Excludente'
  ELSE 'Não'
END
WHERE justificativa_fatal IS NOT NULL
   OR excludente IS DISTINCT FROM 'Não';
