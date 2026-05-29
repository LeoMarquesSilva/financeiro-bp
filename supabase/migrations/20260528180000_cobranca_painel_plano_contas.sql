-- Adiciona plano_contas à view cobranca_painel para coluna e filtros.

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
  (COALESCE(ev.tem_whatsapp, false) AND COALESCE(ev.tem_email, false)) AS concluido
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

COMMENT ON VIEW cobranca_painel IS 'Painel de cobranca: parcelas vencidas em aberto, nao arquivadas, com flags de cobranca por canal e plano_contas.';
