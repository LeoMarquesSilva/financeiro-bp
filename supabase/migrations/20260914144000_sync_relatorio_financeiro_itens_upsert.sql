-- Upsert pontual de itens: atualiza/inclui ci_item do payload. Não apaga o restante.

CREATE OR REPLACE FUNCTION public.sync_relatorio_financeiro_itens_upsert(
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

  INSERT INTO financeiro_parcelas_itens (
    ci_item,
    ci_titulo,
    etiquetas_titulo,
    data_cadastro_titulo,
    data_cadastro_item,
    competencia_titulo,
    escritorio,
    departamento,
    tipo,
    nro_titulo,
    serie_titulo,
    cliente,
    terceiro_titulo,
    terceiros_item,
    reincidencia_titulo,
    nfse_titulo,
    conta_numero,
    plano_contas,
    grupo_conta,
    descricao,
    valor_item,
    valor_fluxo_item,
    valor_pago_item,
    valor_bruto_titulo,
    valor_liquido_titulo,
    situacao_titulo,
    data_vencimento,
    data_pagamento,
    contrato,
    conta_caixa_banco,
    valor_parcial_aberto
  )
  SELECT
    (r->>'ci_item')::integer,
    (r->>'ci_titulo')::integer,
    NULLIF(TRIM(r->>'etiquetas_titulo'), ''),
    NULLIF(r->>'data_cadastro_titulo', '')::date,
    NULLIF(r->>'data_cadastro_item', '')::date,
    NULLIF(r->>'competencia_titulo', '')::date,
    NULLIF(TRIM(r->>'escritorio'), ''),
    NULLIF(TRIM(r->>'departamento'), ''),
    NULLIF(TRIM(r->>'tipo'), ''),
    NULLIF(TRIM(r->>'nro_titulo'), ''),
    NULLIF(TRIM(r->>'serie_titulo'), ''),
    NULLIF(TRIM(r->>'cliente'), ''),
    NULLIF(TRIM(r->>'terceiro_titulo'), ''),
    NULLIF(TRIM(r->>'terceiros_item'), ''),
    NULLIF(TRIM(r->>'reincidencia_titulo'), ''),
    NULLIF(TRIM(r->>'nfse_titulo'), ''),
    NULLIF(TRIM(r->>'conta_numero'), ''),
    public.canonical_plano_contas(r->>'plano_contas'),
    public.canonical_grupo_conta(r->>'grupo_conta'),
    NULLIF(TRIM(r->>'descricao'), ''),
    public.jsonb_to_numeric(r, 'valor_item'),
    public.jsonb_to_numeric(r, 'valor_fluxo_item'),
    public.jsonb_to_numeric(r, 'valor_pago_item'),
    public.jsonb_to_numeric(r, 'valor_bruto_titulo'),
    public.jsonb_to_numeric(r, 'valor_liquido_titulo'),
    NULLIF(TRIM(r->>'situacao_titulo'), ''),
    NULLIF(r->>'data_vencimento', '')::date,
    NULLIF(r->>'data_pagamento', '')::date,
    NULLIF(TRIM(r->>'contrato'), ''),
    NULLIF(TRIM(r->>'conta_caixa_banco'), ''),
    public.jsonb_to_numeric(r, 'valor_parcial_aberto')
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (ci_item) DO UPDATE SET
    ci_titulo               = EXCLUDED.ci_titulo,
    etiquetas_titulo        = EXCLUDED.etiquetas_titulo,
    data_cadastro_titulo    = EXCLUDED.data_cadastro_titulo,
    data_cadastro_item      = EXCLUDED.data_cadastro_item,
    competencia_titulo      = EXCLUDED.competencia_titulo,
    escritorio              = EXCLUDED.escritorio,
    departamento            = EXCLUDED.departamento,
    tipo                    = EXCLUDED.tipo,
    nro_titulo              = EXCLUDED.nro_titulo,
    serie_titulo            = EXCLUDED.serie_titulo,
    cliente                 = EXCLUDED.cliente,
    terceiro_titulo         = EXCLUDED.terceiro_titulo,
    terceiros_item          = EXCLUDED.terceiros_item,
    reincidencia_titulo     = EXCLUDED.reincidencia_titulo,
    nfse_titulo             = EXCLUDED.nfse_titulo,
    conta_numero            = EXCLUDED.conta_numero,
    plano_contas            = EXCLUDED.plano_contas,
    grupo_conta             = EXCLUDED.grupo_conta,
    descricao               = EXCLUDED.descricao,
    valor_item              = EXCLUDED.valor_item,
    valor_fluxo_item        = EXCLUDED.valor_fluxo_item,
    valor_pago_item         = EXCLUDED.valor_pago_item,
    valor_bruto_titulo      = EXCLUDED.valor_bruto_titulo,
    valor_liquido_titulo    = EXCLUDED.valor_liquido_titulo,
    situacao_titulo         = EXCLUDED.situacao_titulo,
    data_vencimento         = EXCLUDED.data_vencimento,
    data_pagamento          = EXCLUDED.data_pagamento,
    contrato                = EXCLUDED.contrato,
    conta_caixa_banco       = EXCLUDED.conta_caixa_banco,
    valor_parcial_aberto    = EXCLUDED.valor_parcial_aberto,
    updated_at              = now();
  GET DIAGNOSTICS upserted_count = ROW_COUNT;

  RETURN jsonb_build_object('deleted', 0, 'upserted', upserted_count);
END;
$$;

COMMENT ON FUNCTION public.sync_relatorio_financeiro_itens_upsert(jsonb) IS
  'Upsert pontual de itens VIOS. Não remove ci_item que ficou de fora do arquivo.';

GRANT EXECUTE ON FUNCTION public.sync_relatorio_financeiro_itens_upsert(jsonb) TO anon, authenticated, service_role;
