-- Módulos atuais (Receita, Cobrança, Inadimplência, Escritório): somente RECEBER.
-- PAGAR permanece na tabela para a futura tela de OPEX.

CREATE OR REPLACE VIEW public.relatorio_financeiro_resumo_por_cliente AS
SELECT
  pessoa_id,
  count(*) FILTER (WHERE situacao = 'ABERTO')::integer AS parcelas_abertas,
  count(*) FILTER (WHERE situacao = 'PAGO')::integer AS parcelas_pagas,
  count(*) FILTER (WHERE situacao = 'ABERTO' AND data_vencimento < CURRENT_DATE)::integer AS parcelas_em_atraso,
  COALESCE(sum(valor) FILTER (WHERE situacao = 'ABERTO'), 0)::numeric(12, 2) AS valor_aberto,
  COALESCE(sum(valor) FILTER (WHERE situacao = 'PAGO'), 0)::numeric(12, 2) AS valor_pago,
  COALESCE(sum(valor) FILTER (WHERE situacao = 'ABERTO' AND data_vencimento < CURRENT_DATE), 0)::numeric(12, 2) AS valor_em_atraso
FROM financeiro_parcelas fp
WHERE pessoa_id IS NOT NULL
  AND public.financeiro_titulo_eh_receber(fp.tipo)
GROUP BY pessoa_id;

COMMENT ON VIEW public.relatorio_financeiro_resumo_por_cliente IS
  'Resumo financeiro por pessoa (somente títulos RECEBER). PAGAR fica para módulo OPEX.';
