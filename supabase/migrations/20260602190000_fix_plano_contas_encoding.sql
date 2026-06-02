-- Corrige acentuação corrompida (U+FFFD) em plano_contas/grupo_conta e normaliza no sync.

CREATE OR REPLACE FUNCTION public.canonical_plano_contas(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE public.normalize_plano_contas(t)
    WHEN 'HONORRIOS MENSAIS' THEN 'HONORÁRIOS MENSAIS'
    WHEN 'HONORRIOS SPOT' THEN 'HONORÁRIOS SPOT'
    WHEN 'HONORRIOS DE SUCUMBNCIA' THEN 'HONORÁRIOS DE SUCUMBÊNCIA'
    WHEN 'HONORRIOS DE XITO' THEN 'HONORÁRIOS DE ÊXITO'
    WHEN 'HONORRIOS DE MANUTENO' THEN 'HONORÁRIOS DE MANUTENÇÃO'
    WHEN 'HONORRIOS POR HORA TRABALHADA' THEN 'HONORÁRIOS POR HORA TRABALHADA'
    WHEN 'HONORRIOS ADVOCATCIOS' THEN 'HONORÁRIOS ADVOCATÍCIOS'
    WHEN 'HONORARIOS PARCERIAS' THEN 'HONORÁRIOS PARCERIAS'
    WHEN 'RECEITAS DE APLICAES FINANCEIRAS' THEN 'RECEITAS DE APLICAÇÕES FINANCEIRAS'
    WHEN 'ENTRADAS NO IDENTIFICADAS' THEN 'ENTRADAS NÃO IDENTIFICADAS'
    WHEN 'ESTORNOS BANCRIOS' THEN 'ESTORNOS BANCÁRIOS'
    ELSE NULLIF(TRIM(t), '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_grupo_conta(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE regexp_replace(public.normalize_plano_contas(t), '\s+', ' ', 'g')
    WHEN 'ENTRADAS EMPRSTIMOS APLICAES E DEVO' THEN 'ENTRADAS - EMPRÉSTIMOS APLICAÇÕES E DEVO'
    WHEN 'RECEITAS NO OPERACIONAIS' THEN 'RECEITAS NÃO OPERACIONAIS'
    ELSE NULLIF(TRIM(t), '')
  END;
$$;

COMMENT ON FUNCTION public.canonical_plano_contas(text) IS
  'Converte plano_contas VIOS (com ou sem acentos corrompidos) para rótulo UTF-8 canônico.';

COMMENT ON FUNCTION public.canonical_grupo_conta(text) IS
  'Converte grupo_conta VIOS (com ou sem acentos corrompidos) para rótulo UTF-8 canônico.';

-- Corrige dados existentes.
UPDATE financeiro_parcelas_itens
SET
  plano_contas = public.canonical_plano_contas(plano_contas),
  grupo_conta = public.canonical_grupo_conta(grupo_conta)
WHERE plano_contas IS DISTINCT FROM public.canonical_plano_contas(plano_contas)
   OR grupo_conta IS DISTINCT FROM public.canonical_grupo_conta(grupo_conta);

-- Reaplica grupo_conta após ajuste de espaços na normalização.
UPDATE financeiro_parcelas_itens
SET grupo_conta = public.canonical_grupo_conta(grupo_conta)
WHERE grupo_conta IS DISTINCT FROM public.canonical_grupo_conta(grupo_conta);

-- Sync passa a gravar valores canônicos.
CREATE OR REPLACE FUNCTION public.sync_relatorio_financeiro_itens_replace(
  p_ci_items integer[] DEFAULT '{}',
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
  DELETE FROM financeiro_parcelas_itens
  WHERE (p_ci_items IS NULL OR array_length(p_ci_items, 1) IS NULL OR array_length(p_ci_items, 1) = 0)
     OR NOT (ci_item = ANY(p_ci_items));
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF jsonb_array_length(p_rows) > 0 THEN
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
  ELSE
    upserted_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'deleted',  deleted_count,
    'upserted', upserted_count
  );
END;
$$;
