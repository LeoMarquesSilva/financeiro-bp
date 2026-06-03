-- Concluído / indicadores: apenas cobrança por WhatsApp (e-mail fora do escopo por enquanto).

DROP VIEW IF EXISTS cobranca_kpi;
DROP VIEW IF EXISTS cobranca_painel;

CREATE VIEW cobranca_painel
WITH (security_invoker = on)
AS
SELECT
  fp.id                          AS parcela_id,
  fp.pessoa_id,
  fp.cliente,
  fp.nro_titulo,
  fp.parcela,
  fp.parcelas,
  fp.descricao,
  fp.plano_contas,
  fp.data_vencimento,
  fp.valor,
  (CURRENT_DATE - fp.data_vencimento) AS dias_atraso,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  COALESCE(ev.tem_whatsapp, false) AS concluido
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at)                                       AS ultima_cobranca_at
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND fp.data_vencimento < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id
  );

COMMENT ON VIEW cobranca_painel IS 'Painel de cobranca: parcelas vencidas em aberto. Concluido = cobrado por WhatsApp.';

CREATE VIEW cobranca_kpi
WITH (security_invoker = on)
AS
SELECT
  count(*)                                                          AS titulos_vencidos,
  count(*) FILTER (WHERE tem_whatsapp)                              AS titulos_cobrados,
  count(*) FILTER (WHERE NOT tem_whatsapp)                          AS titulos_pendentes,
  count(*) FILTER (WHERE tem_whatsapp)                              AS com_whatsapp,
  count(*) FILTER (WHERE tem_email)                                 AS com_email,
  count(*) FILTER (WHERE tem_whatsapp)                              AS concluidos,
  COALESCE(sum(valor), 0)                                           AS valor_vencido,
  COALESCE(sum(valor) FILTER (WHERE tem_whatsapp), 0)                 AS valor_cobrado,
  COALESCE(sum(valor) FILTER (WHERE NOT tem_whatsapp), 0)             AS valor_pendente,
  CASE WHEN count(*) > 0
    THEN round(100.0 * count(*) FILTER (WHERE tem_whatsapp) / count(*), 1)
    ELSE 100
  END                                                              AS efetividade_pct
FROM cobranca_painel
WHERE data_vencimento >= DATE '2026-05-01';

COMMENT ON VIEW cobranca_kpi IS 'Indicador D+1: efetividade baseada apenas em cobranca por WhatsApp.';
