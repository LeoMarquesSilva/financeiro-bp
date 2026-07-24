-- Orçamento OPEX congelado (separado do previsto operacional VIOS).

CREATE TABLE public.opex_orcamento_ano (
  ano           integer PRIMARY KEY,
  congelado_em  timestamptz NOT NULL DEFAULT now(),
  congelado_por text,
  origem        text NOT NULL DEFAULT 'import' CHECK (origem IN ('import', 'manual')),
  observacao    text
);

COMMENT ON TABLE public.opex_orcamento_ano IS
  'Metadados do orçamento OPEX congelado por ano.';

CREATE TABLE public.opex_orcamento_linha (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           integer NOT NULL REFERENCES public.opex_orcamento_ano (ano) ON DELETE CASCADE,
  mes           integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  grupo_conta   text NOT NULL,
  plano_contas  text NOT NULL,
  conta_numero  text NOT NULL DEFAULT '',
  titulo_ref    text NOT NULL DEFAULT '',
  descricao     text NOT NULL DEFAULT '',
  valor         numeric(15, 2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  fixo          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opex_orcamento_linha_unique
    UNIQUE (ano, mes, grupo_conta, plano_contas, titulo_ref)
);

CREATE INDEX opex_orcamento_linha_ano_mes_idx
  ON public.opex_orcamento_linha (ano, mes);

CREATE INDEX opex_orcamento_linha_grupo_idx
  ON public.opex_orcamento_linha (ano, grupo_conta);

COMMENT ON TABLE public.opex_orcamento_linha IS
  'Linhas do orçamento OPEX congelado por ano/mês/grupo/plano/título.';

CREATE OR REPLACE FUNCTION public.opex_orcamento_linha_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER opex_orcamento_linha_updated_at
  BEFORE UPDATE ON public.opex_orcamento_linha
  FOR EACH ROW
  EXECUTE FUNCTION public.opex_orcamento_linha_updated_at();

ALTER TABLE public.opex_orcamento_ano ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_orcamento_linha ENABLE ROW LEVEL SECURITY;

CREATE POLICY opex_orcamento_ano_select ON public.opex_orcamento_ano
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY opex_orcamento_linha_select ON public.opex_orcamento_linha
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY opex_orcamento_ano_write ON public.opex_orcamento_ano
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY opex_orcamento_linha_write ON public.opex_orcamento_linha
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.opex_orcamento_norm_grupo(p_grupo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    public.canonical_grupo_conta(p_grupo),
    coalesce(nullif(trim(p_grupo), ''), 'Sem grupo')
  );
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_norm_plano(p_plano text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    public.canonical_plano_contas(p_plano),
    coalesce(nullif(trim(p_plano), ''), 'Sem plano')
  );
$$;

CREATE OR REPLACE FUNCTION public.opex_tem_orcamento(p_ano integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opex_orcamento_ano WHERE ano = p_ano
  );
$$;

CREATE OR REPLACE FUNCTION public.opex_previsto_orcamento_mes(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(round(sum(l.valor), 2), 0)::numeric(15, 2)
  FROM public.opex_orcamento_linha l
  WHERE l.ano = p_ano AND l.mes = p_mes;
$$;

CREATE OR REPLACE FUNCTION public.opex_previsto_vios_mes(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(round(sum(public.opex_valor_item(i))::numeric, 2), 0)::numeric(15, 2)
  FROM financeiro_parcelas_itens i
  WHERE public.opex_item_elegivel(i)
    AND i.data_vencimento IS NOT NULL
    AND extract(year FROM i.data_vencimento)::int = p_ano
    AND extract(month FROM i.data_vencimento)::int = p_mes;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_get_ano(p_ano integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN a.ano IS NULL THEN jsonb_build_object('ano', p_ano, 'importado', false)
    ELSE jsonb_build_object(
      'ano', a.ano,
      'importado', true,
      'congelado_em', a.congelado_em,
      'congelado_por', a.congelado_por,
      'origem', a.origem,
      'observacao', a.observacao,
      'total_ano', (
        SELECT coalesce(round(sum(l.valor), 2), 0)
        FROM public.opex_orcamento_linha l
        WHERE l.ano = a.ano
      ),
      'qtd_linhas', (
        SELECT count(*)::integer
        FROM public.opex_orcamento_linha l
        WHERE l.ano = a.ano
      )
    )
  END
  FROM (SELECT p_ano AS ano) x
  LEFT JOIN public.opex_orcamento_ano a ON a.ano = x.ano;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_resumo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  grupo_conta text,
  previsto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.mes,
    l.grupo_conta,
    round(sum(l.valor), 2)::numeric(15, 2) AS previsto
  FROM public.opex_orcamento_linha l
  WHERE l.ano = p_ano
    AND (
      p_meses IS NULL
      OR cardinality(p_meses) = 0
      OR l.mes = ANY(p_meses)
    )
  GROUP BY l.mes, l.grupo_conta
  ORDER BY l.mes, previsto DESC;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_list(
  p_ano integer,
  p_mes integer DEFAULT NULL,
  p_grupo text DEFAULT NULL,
  p_busca text DEFAULT NULL
)
RETURNS SETOF public.opex_orcamento_linha
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.opex_orcamento_linha l
  WHERE l.ano = p_ano
    AND (p_mes IS NULL OR l.mes = p_mes)
    AND (p_grupo IS NULL OR l.grupo_conta = p_grupo)
    AND (
      p_busca IS NULL
      OR trim(p_busca) = ''
      OR l.grupo_conta ILIKE '%' || trim(p_busca) || '%'
      OR l.plano_contas ILIKE '%' || trim(p_busca) || '%'
      OR l.titulo_ref ILIKE '%' || trim(p_busca) || '%'
      OR l.descricao ILIKE '%' || trim(p_busca) || '%'
    )
  ORDER BY l.mes, l.grupo_conta, l.plano_contas, l.titulo_ref;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_import_replace(
  p_ano integer,
  p_linhas jsonb,
  p_origem text DEFAULT 'import',
  p_observacao text DEFAULT NULL,
  p_congelado_por text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linha jsonb;
  v_count integer := 0;
  v_total numeric := 0;
  v_grupo text;
  v_plano text;
  v_titulo text;
BEGIN
  IF p_ano IS NULL OR p_ano < 2000 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'p_linhas deve ser um array JSON';
  END IF;

  DELETE FROM public.opex_orcamento_linha WHERE ano = p_ano;
  DELETE FROM public.opex_orcamento_ano WHERE ano = p_ano;

  INSERT INTO public.opex_orcamento_ano (ano, origem, observacao, congelado_por)
  VALUES (
    p_ano,
    CASE WHEN coalesce(p_origem, 'import') IN ('import', 'manual') THEN p_origem ELSE 'import' END,
    p_observacao,
    p_congelado_por
  );

  FOR v_linha IN SELECT value FROM jsonb_array_elements(p_linhas)
  LOOP
    v_grupo := public.opex_orcamento_norm_grupo(v_linha->>'grupo_conta');
    v_plano := public.opex_orcamento_norm_plano(v_linha->>'plano_contas');
    v_titulo := coalesce(nullif(trim(v_linha->>'titulo_ref'), ''), '—');

    INSERT INTO public.opex_orcamento_linha (
      ano, mes, grupo_conta, plano_contas, conta_numero, titulo_ref, descricao, valor, fixo
    ) VALUES (
      p_ano,
      (v_linha->>'mes')::integer,
      v_grupo,
      v_plano,
      coalesce(nullif(trim(v_linha->>'conta_numero'), ''), ''),
      v_titulo,
      coalesce(nullif(trim(v_linha->>'descricao'), ''), ''),
      round(coalesce((v_linha->>'valor')::numeric, 0), 2),
      coalesce((v_linha->>'fixo')::boolean, public.opex_grupo_fixo(v_grupo))
    )
    ON CONFLICT (ano, mes, grupo_conta, plano_contas, titulo_ref)
    DO UPDATE SET
      conta_numero = EXCLUDED.conta_numero,
      descricao = EXCLUDED.descricao,
      valor = EXCLUDED.valor,
      fixo = EXCLUDED.fixo,
      updated_at = now();

    v_count := v_count + 1;
    v_total := v_total + round(coalesce((v_linha->>'valor')::numeric, 0), 2);
  END LOOP;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'qtd_linhas', v_count,
    'total', round(v_total, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_upsert_linha(
  p_id uuid DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_grupo_conta text DEFAULT NULL,
  p_plano_contas text DEFAULT NULL,
  p_conta_numero text DEFAULT NULL,
  p_titulo_ref text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_grupo text;
  v_plano text;
  v_titulo text;
  v_ano integer;
BEGIN
  v_grupo := public.opex_orcamento_norm_grupo(p_grupo_conta);
  v_plano := public.opex_orcamento_norm_plano(p_plano_contas);
  v_titulo := coalesce(nullif(trim(p_titulo_ref), ''), '—');

  IF p_id IS NOT NULL THEN
    UPDATE public.opex_orcamento_linha
    SET
      mes = coalesce(p_mes, mes),
      grupo_conta = coalesce(v_grupo, grupo_conta),
      plano_contas = coalesce(v_plano, plano_contas),
      conta_numero = coalesce(p_conta_numero, conta_numero),
      titulo_ref = coalesce(v_titulo, titulo_ref),
      descricao = coalesce(p_descricao, descricao),
      valor = coalesce(round(p_valor, 2), valor),
      fixo = public.opex_grupo_fixo(coalesce(v_grupo, grupo_conta))
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Linha de orçamento não encontrada';
    END IF;

    RETURN v_id;
  END IF;

  IF p_ano IS NULL OR p_mes IS NULL OR v_grupo IS NULL OR v_plano IS NULL OR p_valor IS NULL THEN
    RAISE EXCEPTION 'Campos obrigatórios: ano, mes, grupo_conta, plano_contas, valor';
  END IF;

  INSERT INTO public.opex_orcamento_ano (ano, origem)
  VALUES (p_ano, 'manual')
  ON CONFLICT (ano) DO NOTHING;

  INSERT INTO public.opex_orcamento_linha (
    ano, mes, grupo_conta, plano_contas, conta_numero, titulo_ref, descricao, valor, fixo
  ) VALUES (
    p_ano,
    p_mes,
    v_grupo,
    v_plano,
    coalesce(p_conta_numero, ''),
    v_titulo,
    coalesce(p_descricao, ''),
    round(p_valor, 2),
    public.opex_grupo_fixo(v_grupo)
  )
  ON CONFLICT (ano, mes, grupo_conta, plano_contas, titulo_ref)
  DO UPDATE SET
    conta_numero = EXCLUDED.conta_numero,
    descricao = EXCLUDED.descricao,
    valor = EXCLUDED.valor,
    fixo = EXCLUDED.fixo,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.opex_orcamento_delete_linha(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer;
BEGIN
  DELETE FROM public.opex_orcamento_linha
  WHERE id = p_id
  RETURNING ano INTO v_ano;

  IF v_ano IS NULL THEN
    RAISE EXCEPTION 'Linha de orçamento não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.opex_orcamento_linha WHERE ano = v_ano) THEN
    DELETE FROM public.opex_orcamento_ano WHERE ano = v_ano;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.opex_orcamento_norm_grupo(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_norm_plano(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_tem_orcamento(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_previsto_orcamento_mes(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_previsto_vios_mes(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_get_ano(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_resumo(integer, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_list(integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_import_replace(integer, jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_upsert_linha(uuid, integer, integer, text, text, text, text, text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_orcamento_delete_linha(uuid) TO anon, authenticated;
