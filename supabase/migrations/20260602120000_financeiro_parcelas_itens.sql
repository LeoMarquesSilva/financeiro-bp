-- Detalhamento por item do relatório VIOS (linhas do título).
-- Vinculado a financeiro_parcelas via ci_titulo. Sync diário: sync_relatorio_financeiro_itens_replace.

CREATE TABLE public.financeiro_parcelas_itens (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_item                 INTEGER NOT NULL,
  ci_titulo               INTEGER NOT NULL REFERENCES public.financeiro_parcelas (ci_titulo) ON DELETE CASCADE,
  etiquetas_titulo        TEXT,
  data_cadastro_titulo    DATE,
  data_cadastro_item      DATE,
  competencia_titulo      DATE,
  escritorio              TEXT,
  departamento            TEXT,
  tipo                    TEXT,
  nro_titulo              TEXT,
  serie_titulo            TEXT,
  cliente                 TEXT,
  terceiro_titulo         TEXT,
  terceiros_item          TEXT,
  reincidencia_titulo     TEXT,
  nfse_titulo             TEXT,
  conta_numero            TEXT,
  plano_contas            TEXT,
  grupo_conta             TEXT,
  descricao               TEXT,
  valor_item              NUMERIC(15, 2),
  valor_fluxo_item        NUMERIC(15, 2),
  valor_pago_item         NUMERIC(15, 2),
  valor_bruto_titulo      NUMERIC(15, 2),
  valor_liquido_titulo    NUMERIC(15, 2),
  situacao_titulo         TEXT,
  data_vencimento         DATE,
  data_pagamento          DATE,
  contrato                TEXT,
  conta_caixa_banco       TEXT,
  valor_parcial_aberto    NUMERIC(15, 2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_parcelas_itens_ci_item_key UNIQUE (ci_item)
);

CREATE INDEX financeiro_parcelas_itens_ci_titulo_idx
  ON public.financeiro_parcelas_itens (ci_titulo);

CREATE INDEX financeiro_parcelas_itens_cliente_idx
  ON public.financeiro_parcelas_itens (cliente);

CREATE INDEX financeiro_parcelas_itens_departamento_idx
  ON public.financeiro_parcelas_itens (departamento);

CREATE INDEX financeiro_parcelas_itens_situacao_titulo_idx
  ON public.financeiro_parcelas_itens (situacao_titulo);

COMMENT ON TABLE public.financeiro_parcelas_itens IS
  'Itens do relatório financeiro VIOS (detalhamento por CI Item). Um título (ci_titulo) pode ter vários itens. Sync diário via sync_relatorio_financeiro_itens_replace.';

COMMENT ON COLUMN public.financeiro_parcelas_itens.ci_titulo IS
  'FK para financeiro_parcelas.ci_titulo (CI - Título no VIOS).';

COMMENT ON COLUMN public.financeiro_parcelas_itens.ci_item IS
  'Identificador único do item no VIOS (CI - Item). Chave natural do sync.';

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_financeiro_parcelas_itens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER financeiro_parcelas_itens_updated_at
  BEFORE UPDATE ON public.financeiro_parcelas_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_financeiro_parcelas_itens_updated_at();

-- RLS (mesmo padrão de financeiro_parcelas)
ALTER TABLE public.financeiro_parcelas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon"
  ON public.financeiro_parcelas_itens
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated"
  ON public.financeiro_parcelas_itens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Sync replace: relatório = fonte da verdade (por ci_item)
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
      NULLIF((r->>'valor_item')::numeric, 0),
      NULLIF((r->>'valor_fluxo_item')::numeric, 0),
      NULLIF((r->>'valor_pago_item')::numeric, 0),
      NULLIF((r->>'valor_bruto_titulo')::numeric, 0),
      NULLIF((r->>'valor_liquido_titulo')::numeric, 0),
      NULLIF(TRIM(r->>'situacao_titulo'), ''),
      NULLIF(r->>'data_vencimento', '')::date,
      NULLIF(r->>'data_pagamento', '')::date,
      NULLIF(TRIM(r->>'contrato'), ''),
      NULLIF(TRIM(r->>'conta_caixa_banco'), ''),
      NULLIF((r->>'valor_parcial_aberto')::numeric, 0)
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

COMMENT ON FUNCTION public.sync_relatorio_financeiro_itens_replace(integer[], jsonb) IS
  'Sync do relatório de itens VIOS: remove itens ausentes no relatório e faz upsert por ci_item. Relatório = fonte da verdade.';

GRANT EXECUTE ON FUNCTION public.sync_relatorio_financeiro_itens_replace(integer[], jsonb) TO anon, authenticated;
