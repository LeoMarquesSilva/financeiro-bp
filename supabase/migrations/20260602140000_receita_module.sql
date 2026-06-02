-- Módulo Receita: agregação mensal + correção de parse numérico no sync de itens.

CREATE OR REPLACE FUNCTION public.jsonb_to_numeric(j jsonb, key text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL OR j -> key IS NULL OR j ->> key = '' THEN NULL
    ELSE (j ->> key)::numeric
  END;
$$;

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
      NULLIF(TRIM(r->>'plano_contas'), ''),
      NULLIF(TRIM(r->>'grupo_conta'), ''),
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

-- Planos de contas excluídos do módulo Receita (honorários fora do escopo operacional).
CREATE OR REPLACE FUNCTION public.receita_totais_mensais(p_ano integer)
RETURNS TABLE (
  mes integer,
  recebido numeric,
  previsto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH excluidos AS (
    SELECT unnest(ARRAY[
      'HONORÁRIOS MENSAIS',
      'HONORÁRIOS SPOT',
      'HONORÁRIOS DE SUCUMBÊNCIA',
      'HONORÁRIOS DE ÊXITO',
      'HONORÁRIOS DE MANUTENÇÃO',
      'HONORÁRIOS POR HORA TRABALHADA'
    ]::text[]) AS plano
  ),
  base AS (
    SELECT *
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND (i.plano_contas IS NULL OR NOT EXISTS (
        SELECT 1 FROM excluidos e WHERE upper(trim(i.plano_contas)) = upper(trim(e.plano))
      ))
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(valor_pago_item), 0) AS total
    FROM base
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  prev AS (
    SELECT
      EXTRACT(MONTH FROM data_vencimento)::integer AS mes,
      COALESCE(SUM(valor_item), 0) AS total
    FROM base
    WHERE data_vencimento IS NOT NULL
      AND valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(1, 12) AS mes
  )
  SELECT
    m.mes,
    COALESCE(r.total, 0),
    COALESCE(p.total, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais de recebido (data_pagamento + valor_pago_item) e previsto (data_vencimento + valor_item), excluindo planos de honorários fora do escopo.';

GRANT EXECUTE ON FUNCTION public.receita_totais_mensais(integer) TO anon, authenticated;

-- Metas padrão (imagem de referência: mai–dez/2026)
INSERT INTO app_settings (key, value)
VALUES (
  'receita_metas',
  '{
    "ano": 2026,
    "meses": [5, 6, 7, 8, 9, 10, 11, 12],
    "meta": 1428571.43,
    "projetado_base_abril": 1173008.66,
    "projetado_real": {
      "5": 1172379.75,
      "6": 1169484.68,
      "7": 1126982.14,
      "8": 1103817.14,
      "9": 1168013.73,
      "10": 1066187.15,
      "11": 1068230.49,
      "12": 1069730.49
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
