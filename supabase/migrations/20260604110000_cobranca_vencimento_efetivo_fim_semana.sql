-- Vencimento em fim de semana prorroga para o próximo dia útil; D+1 cobrança = dia útil após o vencimento efetivo.
-- Ex.: venc. 31/05 (dom) → efetivo 01/06 (seg) → cobrança 02/06 (ter).

CREATE OR REPLACE FUNCTION public.cobranca_proximo_dia_util(d date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF d IS NULL THEN
    RETURN NULL;
  END IF;
  WHILE EXTRACT(ISODOW FROM d) IN (6, 7) LOOP
    d := d + 1;
  END LOOP;
  RETURN d;
END;
$$;

COMMENT ON FUNCTION public.cobranca_proximo_dia_util(date) IS
  'Avança a data até cair em dia útil (segunda a sexta).';

CREATE OR REPLACE FUNCTION public.cobranca_vencimento_efetivo(data_vencimento date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.cobranca_proximo_dia_util(data_vencimento);
$$;

COMMENT ON FUNCTION public.cobranca_vencimento_efetivo(date) IS
  'Vencimento efetivo: se cair em sábado/domingo, prorroga para o próximo dia útil.';

CREATE OR REPLACE FUNCTION public.cobranca_prazo_d1(data_vencimento date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.cobranca_proximo_dia_util(
    public.cobranca_vencimento_efetivo(data_vencimento) + 1
  );
$$;

COMMENT ON FUNCTION public.cobranca_prazo_d1(date) IS
  'Data-alvo da cobrança D+1: 1 dia útil após o vencimento efetivo (com prorrogação de vencimento em fim de semana).';

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
  public.cobranca_vencimento_efetivo(fp.data_vencimento) AS data_vencimento_efetivo,
  public.cobranca_prazo_d1(fp.data_vencimento) AS data_prazo_d1,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_whatsapp_d1, false) AS tem_whatsapp_d1,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  COALESCE(ev.tem_whatsapp, false) AS concluido
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(
      ce.canal = 'whatsapp'
      AND ce.status = 'enviado'
      AND (ce.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        = public.cobranca_prazo_d1(fp.data_vencimento)
    ) AS tem_whatsapp_d1,
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

COMMENT ON VIEW cobranca_painel IS
  'Painel de cobrança. Vencimento em fim de semana prorroga (data_vencimento_efetivo); tem_whatsapp_d1 = cobrança na data_prazo_d1.';

CREATE VIEW cobranca_kpi
WITH (security_invoker = on)
AS
SELECT
  count(*)                                                          AS titulos_vencidos,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS titulos_cobrados,
  count(*) FILTER (WHERE NOT tem_whatsapp_d1)                       AS titulos_pendentes,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS com_whatsapp,
  count(*) FILTER (WHERE tem_email)                                 AS com_email,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS concluidos,
  COALESCE(sum(valor), 0)                                           AS valor_vencido,
  COALESCE(sum(valor) FILTER (WHERE tem_whatsapp_d1), 0)            AS valor_cobrado,
  COALESCE(sum(valor) FILTER (WHERE NOT tem_whatsapp_d1), 0)        AS valor_pendente,
  CASE WHEN count(*) > 0
    THEN round(100.0 * count(*) FILTER (WHERE tem_whatsapp_d1) / count(*), 1)
    ELSE 100
  END                                                              AS efetividade_pct
FROM cobranca_painel
WHERE data_vencimento >= DATE '2026-05-01';

COMMENT ON VIEW cobranca_kpi IS
  'Indicador D+1: cobrança WhatsApp na data_prazo_d1 (vencimento efetivo + 1 dia útil).';
