-- Indicador "Efetividade na Cobrança Inicial (D+1)".
-- Meta: 100% dos títulos vencidos em aberto devem ser objeto de cobrança até D+1.
-- Escopo: apenas títulos com vencimento a partir de 01/05/2026.
-- View de uma linha com os agregados (também consumível por BI externo).

DROP VIEW IF EXISTS cobranca_kpi;

CREATE VIEW cobranca_kpi
WITH (security_invoker = on)
AS
SELECT
  count(*)                                                          AS titulos_vencidos,
  count(*) FILTER (WHERE tem_whatsapp OR tem_email)                 AS titulos_cobrados,
  count(*) FILTER (WHERE NOT (tem_whatsapp OR tem_email))           AS titulos_pendentes,
  count(*) FILTER (WHERE tem_whatsapp)                              AS com_whatsapp,
  count(*) FILTER (WHERE tem_email)                                 AS com_email,
  count(*) FILTER (WHERE concluido)                                 AS concluidos,
  COALESCE(sum(valor), 0)                                           AS valor_vencido,
  COALESCE(sum(valor) FILTER (WHERE tem_whatsapp OR tem_email), 0)  AS valor_cobrado,
  COALESCE(sum(valor) FILTER (WHERE NOT (tem_whatsapp OR tem_email)), 0) AS valor_pendente,
  CASE WHEN count(*) > 0
    THEN round(100.0 * count(*) FILTER (WHERE tem_whatsapp OR tem_email) / count(*), 1)
    ELSE 100
  END                                                              AS efetividade_pct
FROM cobranca_painel
WHERE data_vencimento >= DATE '2026-05-01';

COMMENT ON VIEW cobranca_kpi IS 'Indicador Efetividade na Cobranca Inicial (D+1): titulos vencidos em aberto (vencimento >= 2026-05-01) que ja foram objeto de cobranca em ao menos um canal.';
