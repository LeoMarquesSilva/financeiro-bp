-- SLA Vistagem: marca como Excludente a publicação de 0001513-09.2023.8.16.0185
-- (CI 46097, lote de 26/10/2026, Rec. Crédito risco).
--
-- A pasta ainda é de Insolvência no VIOS e tem a etiqueta RC-Insolvência (a única
-- ativa que não foi passada para Rec. Crédito). A publicação não estava na rodada
-- de Rec. Crédito da manhã de 26/10 (as outras 10 do lote foram vistadas entre
-- 11h34 e 11h54) e só foi vistada em 27/10 às 22h43: entrou pela fila de
-- Insolvência e foi trocada de área. No fluxo antigo o relógio não reinicia.
UPDATE public.sp_publicacoes
SET excludente = 'Excludente',
    excludente_motivo = 'Troca de área na vistagem (pasta CI 46097 ainda em Insolvência, etiqueta RC-Insolvência); no fluxo antigo o relógio do SLA não reinicia na transferência. Validado pela controladoria em 16/11/2026.'
WHERE sp_id = 170190
  AND origem = 'sharepoint';
