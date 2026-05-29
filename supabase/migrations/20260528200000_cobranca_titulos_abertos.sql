-- View com TODOS os títulos em aberto por cliente (vencidos e a vencer),
-- usada no painel lateral da caixa de WhatsApp. Telefone normalizado (apenas
-- dígitos) para cruzar com o número da conversa, e flags de cobrança por canal.

DROP VIEW IF EXISTS cobranca_titulos_abertos;

CREATE VIEW cobranca_titulos_abertos
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
  (CURRENT_DATE - fp.data_vencimento)                      AS dias_atraso,
  (fp.data_vencimento >= CURRENT_DATE)                     AS a_vencer,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  regexp_replace(COALESCE(p.telefone, ''), '\D', '', 'g')  AS telefone_digits,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  EXISTS (SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id) AS arquivado
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
WHERE fp.situacao = 'ABERTO';

COMMENT ON VIEW cobranca_titulos_abertos IS
  'Titulos em aberto (vencidos e a vencer) por cliente, com telefone normalizado e flags de cobranca. Usado no painel lateral do WhatsApp.';
