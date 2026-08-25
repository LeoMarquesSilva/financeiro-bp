-- Valor mensal = só honorários mensais do contrato.
-- ND / reembolso de despesas não entra (ex.: Grupo Spel ND 06-26 = R$ 443,60).

CREATE OR REPLACE VIEW public.clients_inadimplencia_list AS
WITH itens_kanban AS (
  SELECT
    COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
    GREATEST(COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0), 0) AS saldo,
    v.data_vencimento
  FROM public.receita_itens_inadimplencia_elegiveis v
  WHERE v.data_vencimento IS NOT NULL
    AND v.data_vencimento < CURRENT_DATE

  UNION ALL

  SELECT
    COALESCE(
      gc.grupo_cliente,
      NULLIF(trim(p.grupo_cliente), ''),
      'Sem grupo'
    ) AS grupo_cliente,
    GREATEST(COALESCE(i.valor_item, 0) - COALESCE(i.valor_pago_item, 0), 0) AS saldo,
    i.data_vencimento
  FROM public.financeiro_parcelas_itens i
  INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
    AND i.data_vencimento IS NOT NULL
    AND public.normalize_plano_contas(i.plano_contas) LIKE '%REEMBOLSO%DESPESA%'
    AND NOT public.plano_contas_na_cota(i.plano_contas)
    AND GREATEST(COALESCE(i.valor_item, 0) - COALESCE(i.valor_pago_item, 0), 0) > 0
),
grupo_saldo_vencido AS (
  SELECT
    k.grupo_cliente,
    ROUND(SUM(k.saldo), 2)::numeric(12, 2) AS valor_aberto_grupo,
    MIN(k.data_vencimento) FILTER (
      WHERE k.saldo > 0 AND k.data_vencimento < CURRENT_DATE
    ) AS oldest_overdue
  FROM itens_kanban k
  GROUP BY 1
  HAVING SUM(k.saldo) > 0
),
cliente_base AS (
  SELECT c.*, p.grupo_cliente
  FROM public.clients_inadimplencia c
  LEFT JOIN public.pessoas p ON p.id = c.pessoa_id
),
cliente_pessoas AS (
  SELECT cb.id AS client_id, p2.id AS pessoa_id
  FROM cliente_base cb
  JOIN public.pessoas p2 ON cb.grupo_cliente IS NOT NULL AND p2.grupo_cliente = cb.grupo_cliente
  UNION
  SELECT cb.id, cb.pessoa_id
  FROM cliente_base cb
  WHERE cb.pessoa_id IS NOT NULL AND cb.grupo_cliente IS NULL
),
parcelas_abertas AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN public.financeiro_parcelas fp
    ON fp.pessoa_id = cp.pessoa_id
   AND fp.situacao = 'ABERTO'
   AND public.financeiro_titulo_eh_receber(fp.tipo)
),
parcelas_contrato_mensal AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN public.financeiro_parcelas fp
    ON fp.pessoa_id = cp.pessoa_id
   AND fp.situacao = 'ABERTO'
   AND public.financeiro_titulo_eh_receber(fp.tipo)
   AND public.normalize_plano_contas(fp.plano_contas) LIKE '%HONOR%MENSAIS%'
   AND (
     fp.descricao IS NULL
     OR (
       upper(trim(fp.descricao)) NOT LIKE 'ND %'
       AND upper(trim(fp.descricao)) <> 'ND'
     )
   )
),
parcelas_agg AS (
  SELECT
    client_id,
    COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0)::numeric(12, 2) AS valor_em_aberto_computado,
    MIN(data_vencimento) FILTER (WHERE data_vencimento < CURRENT_DATE) AS oldest_overdue
  FROM parcelas_abertas
  GROUP BY client_id
),
valor_mensal_mes_ref AS (
  SELECT
    client_id,
    date_trunc('month', MIN(data_vencimento))::date AS mes_ref
  FROM parcelas_contrato_mensal
  WHERE data_vencimento >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY client_id
),
valor_mensal_lookup AS (
  SELECT
    pa.client_id,
    SUM(pa.valor)::numeric(12, 2) AS valor_mensal_computado
  FROM parcelas_contrato_mensal pa
  INNER JOIN valor_mensal_mes_ref vm
    ON vm.client_id = pa.client_id
   AND date_trunc('month', pa.data_vencimento::date)::date = vm.mes_ref
  GROUP BY pa.client_id
),
base AS (
  SELECT
    cb.id,
    cb.razao_social,
    cb.cnpj,
    cb.contato,
    cb.gestor,
    cb.area,
    cb.status_classe,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_em_aberto
      WHEN cb.grupo_cliente IS NOT NULL THEN COALESCE(
        gs.valor_aberto_grupo,
        pa.valor_em_aberto_computado,
        cb.valor_em_aberto
      )
      ELSE COALESCE(pa.valor_em_aberto_computado, cb.valor_em_aberto)
    END::numeric(12, 2) AS valor_em_aberto,
    cb.qtd_processos,
    cb.horas_total,
    cb.horas_por_ano,
    cb.data_vencimento,
    cb.observacoes_gerais,
    cb.ultima_providencia,
    cb.data_providencia,
    cb.follow_up,
    cb.data_follow_up,
    cb.resolvido_at,
    cb.reaberto_at,
    cb.pessoa_id,
    cb.created_at,
    cb.updated_at,
    cb.created_by,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.dias_em_aberto
      WHEN cb.grupo_cliente IS NOT NULL THEN COALESCE(
        CASE WHEN gs.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - gs.oldest_overdue) END,
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
      ELSE COALESCE(
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
    END AS dias_em_aberto,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_mensal
      ELSE COALESCE(vm.valor_mensal_computado, cb.valor_mensal)
    END::numeric(12, 2) AS valor_mensal
  FROM cliente_base cb
  LEFT JOIN grupo_saldo_vencido gs ON gs.grupo_cliente = cb.grupo_cliente
  LEFT JOIN parcelas_agg pa ON pa.client_id = cb.id AND cb.pessoa_id IS NOT NULL
  LEFT JOIN valor_mensal_lookup vm ON vm.client_id = cb.id AND cb.pessoa_id IS NOT NULL
)
SELECT
  id,
  razao_social,
  cnpj,
  contato,
  gestor,
  area,
  status_classe,
  valor_em_aberto,
  qtd_processos,
  horas_total,
  horas_por_ano,
  data_vencimento,
  observacoes_gerais,
  ultima_providencia,
  data_providencia,
  follow_up,
  data_follow_up,
  resolvido_at,
  reaberto_at,
  pessoa_id,
  created_at,
  updated_at,
  created_by,
  dias_em_aberto,
  valor_mensal,
  CASE
    WHEN dias_em_aberto > 5 THEN 'urgente'::text
    WHEN dias_em_aberto >= 3 THEN 'atencao'::text
    ELSE 'controlado'::text
  END AS prioridade
FROM base;

COMMENT ON VIEW public.clients_inadimplencia_list IS
  'Painel Inadimplência: saldo do grupo = honorários vencidos (cota) + reembolso de despesas em aberto. Valor mensal = honorários mensais do contrato (sem ND).';
