-- Sync relatório financeiro: replace atômico (DELETE fora do relatório + UPSERT + vinculação).
-- Garante que parcelas/faturas excluídas no VIOS sejam removidas do banco.

CREATE OR REPLACE FUNCTION public.sync_relatorio_financeiro_replace(
  p_ci_titulos bigint[] DEFAULT '{}',
  p_rows jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
  upserted_count int;
BEGIN
  -- 1) Remove registros cujo ci_titulo não está no relatório atual (relatório = fonte da verdade).
  --    Se p_ci_titulos for NULL ou vazio, remove todos.
  DELETE FROM financeiro_parcelas
  WHERE (p_ci_titulos IS NULL OR array_length(p_ci_titulos, 1) IS NULL OR array_length(p_ci_titulos, 1) = 0)
     OR NOT (ci_titulo = ANY(p_ci_titulos));
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 2) Upsert das linhas do relatório (payload com mesmas colunas que o script Node envia).
  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO financeiro_parcelas (
      ci_titulo,
      ci_parcela,
      data_vencimento,
      data_vencimento_orig,
      competencia,
      tipo,
      forma,
      nro_titulo,
      parcela,
      parcelas,
      nf,
      cliente,
      terceiro_titulo,
      terceiros_itens,
      descricao,
      valor,
      valor_atualizado,
      valor_fluxo,
      valor_pago,
      valor_titulo,
      situacao,
      data_baixa,
      plano_contas
    )
    SELECT
      (r->>'ci_titulo')::bigint,
      (r->>'ci_parcela')::bigint,
      (r->>'data_vencimento')::date,
      NULLIF(r->>'data_vencimento_orig', '')::date,
      NULLIF(TRIM(r->>'competencia'), ''),
      NULLIF(TRIM(r->>'tipo'), ''),
      NULLIF(TRIM(r->>'forma'), ''),
      NULLIF(TRIM(r->>'nro_titulo'), ''),
      NULLIF(TRIM(r->>'parcela'), ''),
      NULLIF(TRIM(r->>'parcelas'), ''),
      NULLIF(TRIM(r->>'nf'), ''),
      NULLIF(TRIM(r->>'cliente'), ''),
      NULLIF(TRIM(r->>'terceiro_titulo'), ''),
      NULLIF(TRIM(r->>'terceiros_itens'), ''),
      NULLIF(TRIM(r->>'descricao'), ''),
      (r->>'valor')::numeric,
      NULLIF((r->>'valor_atualizado')::numeric, 0),
      NULLIF((r->>'valor_fluxo')::numeric, 0),
      NULLIF((r->>'valor_pago')::numeric, 0),
      NULLIF((r->>'valor_titulo')::numeric, 0),
      COALESCE(NULLIF(TRIM(r->>'situacao'), ''), 'ABERTO'),
      NULLIF(r->>'data_baixa', '')::date,
      NULLIF(TRIM(r->>'plano_contas'), '')
    FROM jsonb_array_elements(p_rows) AS r
    ON CONFLICT (ci_titulo) DO UPDATE SET
      ci_parcela          = EXCLUDED.ci_parcela,
      data_vencimento     = EXCLUDED.data_vencimento,
      data_vencimento_orig = EXCLUDED.data_vencimento_orig,
      competencia         = EXCLUDED.competencia,
      tipo                = EXCLUDED.tipo,
      forma               = EXCLUDED.forma,
      nro_titulo          = EXCLUDED.nro_titulo,
      parcela             = EXCLUDED.parcela,
      parcelas            = EXCLUDED.parcelas,
      nf                  = EXCLUDED.nf,
      cliente             = EXCLUDED.cliente,
      terceiro_titulo     = EXCLUDED.terceiro_titulo,
      terceiros_itens     = EXCLUDED.terceiros_itens,
      descricao           = EXCLUDED.descricao,
      valor               = EXCLUDED.valor,
      valor_atualizado    = EXCLUDED.valor_atualizado,
      valor_fluxo         = EXCLUDED.valor_fluxo,
      valor_pago          = EXCLUDED.valor_pago,
      valor_titulo        = EXCLUDED.valor_titulo,
      situacao            = EXCLUDED.situacao,
      data_baixa          = EXCLUDED.data_baixa,
      plano_contas        = EXCLUDED.plano_contas,
      updated_at          = now();
    GET DIAGNOSTICS upserted_count = ROW_COUNT;
  ELSE
    upserted_count := 0;
  END IF;

  -- 3) Vinculação pessoa (pessoa_id) e resumos.
  PERFORM financeiro_parcelas_vinculacao_pessoa();

  RETURN jsonb_build_object(
    'deleted',  deleted_count,
    'upserted', upserted_count
  );
END;
$$;

COMMENT ON FUNCTION public.sync_relatorio_financeiro_replace(bigint[], jsonb) IS
  'Sync do relatório financeiro VIOS: remove parcelas que não estão no relatório e faz upsert das linhas. Relatório = fonte da verdade.';
