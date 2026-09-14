-- Upsert pontual do relatório de parcelas: atualiza CIs existentes e inclui novos.
-- Não apaga ci_titulo ausente no payload (diferente do replace diário).

CREATE OR REPLACE FUNCTION public.sync_relatorio_financeiro_upsert(
  p_rows jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upserted_count int;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('deleted', 0, 'upserted', 0);
  END IF;

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
    ci_parcela           = EXCLUDED.ci_parcela,
    data_vencimento      = EXCLUDED.data_vencimento,
    data_vencimento_orig = EXCLUDED.data_vencimento_orig,
    competencia          = EXCLUDED.competencia,
    tipo                 = EXCLUDED.tipo,
    forma                = EXCLUDED.forma,
    nro_titulo           = EXCLUDED.nro_titulo,
    parcela              = EXCLUDED.parcela,
    parcelas             = EXCLUDED.parcelas,
    nf                   = EXCLUDED.nf,
    cliente              = EXCLUDED.cliente,
    terceiro_titulo      = EXCLUDED.terceiro_titulo,
    terceiros_itens      = EXCLUDED.terceiros_itens,
    descricao            = EXCLUDED.descricao,
    valor                = EXCLUDED.valor,
    valor_atualizado     = EXCLUDED.valor_atualizado,
    valor_fluxo          = EXCLUDED.valor_fluxo,
    valor_pago           = EXCLUDED.valor_pago,
    valor_titulo         = EXCLUDED.valor_titulo,
    situacao             = EXCLUDED.situacao,
    data_baixa           = EXCLUDED.data_baixa,
    plano_contas         = EXCLUDED.plano_contas,
    updated_at           = now();
  GET DIAGNOSTICS upserted_count = ROW_COUNT;

  -- Só os CIs do payload — a vinculação full-table estoura o timeout do PostgREST.
  UPDATE financeiro_parcelas fp
  SET pessoa_id = p.id
  FROM pessoas p
  WHERE fp.ci_titulo IN (
      SELECT (r->>'ci_titulo')::bigint
      FROM jsonb_array_elements(p_rows) AS r
    )
    AND public.normalize_cliente_for_match(fp.cliente) = public.normalize_cliente_for_match(p.nome)
    AND (fp.pessoa_id IS NULL OR fp.pessoa_id IS DISTINCT FROM p.id);

  RETURN jsonb_build_object(
    'deleted',  0,
    'upserted', upserted_count
  );
END;
$$;

COMMENT ON FUNCTION public.sync_relatorio_financeiro_upsert(jsonb) IS
  'Upsert pontual de parcelas VIOS: atualiza e inclui CIs do payload. Não remove o que ficou de fora do arquivo.';

GRANT EXECUTE ON FUNCTION public.sync_relatorio_financeiro_upsert(jsonb) TO anon, authenticated, service_role;
