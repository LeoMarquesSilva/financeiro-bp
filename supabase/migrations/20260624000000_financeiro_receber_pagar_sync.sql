-- Sync financeiro passa a incluir títulos RECEBER e PAGAR (OPEX).
-- Módulos de cobrança e inadimplência continuam considerando apenas RECEBER.

CREATE OR REPLACE FUNCTION public.financeiro_titulo_eh_receber(p_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_tipo IS NULL OR upper(trim(p_tipo)) = 'RECEBER';
$$;

COMMENT ON FUNCTION public.financeiro_titulo_eh_receber(text) IS
  'True para títulos a receber (ou legado sem tipo). PAGAR fica fora de cobrança/inadimplência.';

GRANT EXECUTE ON FUNCTION public.financeiro_titulo_eh_receber(text) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_tipo_norm
  ON public.financeiro_parcelas (upper(trim(tipo)));

CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_itens_tipo_norm
  ON public.financeiro_parcelas_itens (upper(trim(tipo)));

DROP INDEX IF EXISTS idx_financeiro_parcelas_aberto_pessoa_venc;

CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_aberto_receber_pessoa_venc
  ON public.financeiro_parcelas (pessoa_id, data_vencimento)
  WHERE situacao = 'ABERTO'
    AND public.financeiro_titulo_eh_receber(tipo);

-- Cobrança: apenas títulos a receber
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
  GREATEST(
    0,
    (CURRENT_DATE - public.cobranca_prazo_d1(fp.data_vencimento))::integer
  ) AS dias_atraso,
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
  ev.ultima_cobranca_canal,
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
    max(ce.created_at) FILTER (WHERE ce.status = 'enviado')  AS ultima_cobranca_at,
    (
      SELECT ce2.canal::text
      FROM cobranca_eventos ce2
      WHERE ce2.parcela_id = fp.id AND ce2.status = 'enviado'
      ORDER BY ce2.created_at DESC
      LIMIT 1
    ) AS ultima_cobranca_canal
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND public.financeiro_titulo_eh_receber(fp.tipo)
  AND CURRENT_DATE >= public.cobranca_prazo_d1(fp.data_vencimento)
  AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
  AND NOT EXISTS (
    SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id
  );

COMMENT ON VIEW cobranca_painel IS
  'Painel de cobrança (somente títulos RECEBER). ultima_cobranca_at/canal = último disparo enviado.';

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
  GREATEST(
    0,
    (CURRENT_DATE - public.cobranca_prazo_d1(fp.data_vencimento))::integer
  ) AS dias_atraso,
  (fp.data_vencimento >= CURRENT_DATE)                     AS a_vencer,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  regexp_replace(COALESCE(p.telefone, ''), '\D', '', 'g')  AS telefone_digits,
  public.cobranca_vencimento_efetivo(fp.data_vencimento) AS data_vencimento_efetivo,
  public.cobranca_prazo_d1(fp.data_vencimento) AS data_prazo_d1,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  ev.ultima_cobranca_canal,
  EXISTS (SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id) AS arquivado
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at) FILTER (WHERE ce.status = 'enviado')  AS ultima_cobranca_at,
    (
      SELECT ce2.canal::text
      FROM cobranca_eventos ce2
      WHERE ce2.parcela_id = fp.id AND ce2.status = 'enviado'
      ORDER BY ce2.created_at DESC
      LIMIT 1
    ) AS ultima_cobranca_canal
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND public.financeiro_titulo_eh_receber(fp.tipo)
  AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo);

-- Inadimplência (lista de clientes): parcelas abertas só a receber
CREATE OR REPLACE VIEW public.clients_inadimplencia_list AS
WITH cliente_base AS (
  SELECT c.*, p.grupo_cliente
  FROM clients_inadimplencia c
  LEFT JOIN pessoas p ON p.id = c.pessoa_id
),
cliente_pessoas AS (
  SELECT cb.id AS client_id, p2.id AS pessoa_id
  FROM cliente_base cb
  JOIN pessoas p2 ON cb.grupo_cliente IS NOT NULL AND p2.grupo_cliente = cb.grupo_cliente
  UNION
  SELECT cb.id, cb.pessoa_id
  FROM cliente_base cb
  WHERE cb.pessoa_id IS NOT NULL AND cb.grupo_cliente IS NULL
),
parcelas_abertas AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN financeiro_parcelas fp
    ON fp.pessoa_id = cp.pessoa_id
   AND fp.situacao = 'ABERTO'
   AND public.financeiro_titulo_eh_receber(fp.tipo)
),
parcelas_agg AS (
  SELECT
    client_id,
    COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0)::numeric(12,2) AS valor_em_aberto_computado,
    MIN(data_vencimento) FILTER (WHERE data_vencimento < CURRENT_DATE) AS oldest_overdue
  FROM parcelas_abertas
  GROUP BY client_id
),
valor_mensal_lookup AS (
  SELECT DISTINCT ON (pa.client_id)
    pa.client_id,
    pa.valor::numeric(12,2) AS valor_mensal_computado
  FROM parcelas_abertas pa
  WHERE pa.data_vencimento >= CURRENT_DATE
  ORDER BY pa.client_id, pa.data_vencimento
),
base AS (
  SELECT
    cb.id, cb.razao_social, cb.cnpj, cb.contato, cb.gestor, cb.area, cb.status_classe,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_em_aberto
      ELSE COALESCE(pa.valor_em_aberto_computado, cb.valor_em_aberto)
    END::numeric(12,2) AS valor_em_aberto,
    cb.qtd_processos, cb.horas_total, cb.horas_por_ano, cb.data_vencimento,
    cb.observacoes_gerais, cb.ultima_providencia, cb.data_providencia,
    cb.follow_up, cb.data_follow_up, cb.resolvido_at, cb.reaberto_at, cb.pessoa_id,
    cb.created_at, cb.updated_at, cb.created_by,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.dias_em_aberto
      ELSE COALESCE(
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
    END AS dias_em_aberto,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_mensal
      ELSE COALESCE(vm.valor_mensal_computado, cb.valor_mensal)
    END::numeric(12,2) AS valor_mensal
  FROM cliente_base cb
  LEFT JOIN parcelas_agg pa ON pa.client_id = cb.id AND cb.pessoa_id IS NOT NULL
  LEFT JOIN valor_mensal_lookup vm ON vm.client_id = cb.id AND cb.pessoa_id IS NOT NULL
)
SELECT
  id, razao_social, cnpj, contato, gestor, area, status_classe,
  valor_em_aberto, qtd_processos, horas_total, horas_por_ano,
  data_vencimento, observacoes_gerais, ultima_providencia, data_providencia,
  follow_up, data_follow_up, resolvido_at, reaberto_at, pessoa_id,
  created_at, updated_at, created_by, dias_em_aberto, valor_mensal,
  CASE
    WHEN dias_em_aberto > 5 THEN 'urgente'::text
    WHEN dias_em_aberto >= 3 THEN 'atencao'::text
    ELSE 'controlado'::text
  END AS prioridade
FROM base;

COMMENT ON VIEW public.clients_inadimplencia_list IS
  'Lista inadimplência com parcelas abertas apenas de títulos RECEBER.';
