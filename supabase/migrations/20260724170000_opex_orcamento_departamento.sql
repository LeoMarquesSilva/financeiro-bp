-- Orçamento OPEX: departamento na linha (nível hierárquico abaixo de fornecedor).

ALTER TABLE public.opex_orcamento_linha
  ADD COLUMN IF NOT EXISTS departamento text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.opex_orcamento_linha.departamento IS
  'Departamento/área de alocação da linha do orçamento congelado.';

-- Backfill a partir dos itens VIOS (CI / nº título).
UPDATE public.opex_orcamento_linha ol
SET departamento = src.departamento
FROM (
  SELECT DISTINCT ON (ol2.id)
    ol2.id,
    coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') AS departamento
  FROM public.opex_orcamento_linha ol2
  JOIN public.financeiro_parcelas_itens i
    ON (
     (
       ol2.titulo_ref ~ '^CI\s+\d+$'
       AND i.ci_item = (regexp_replace(trim(ol2.titulo_ref), '^CI\s+', '', 'i'))::integer
     )
     OR (
       nullif(trim(ol2.titulo_ref), '') IS NOT NULL
       AND ol2.titulo_ref <> '—'
       AND trim(i.nro_titulo) = trim(ol2.titulo_ref)
     )
   )
  WHERE coalesce(trim(ol2.departamento), '') = ''
  ORDER BY ol2.id, i.ci_item DESC NULLS LAST
) src
WHERE ol.id = src.id;

UPDATE public.opex_orcamento_linha
SET departamento = 'Sem departamento'
WHERE coalesce(trim(departamento), '') = '';

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
      ano, mes, grupo_conta, plano_contas, conta_numero, titulo_ref, descricao, departamento, valor, fixo
    ) VALUES (
      p_ano,
      (v_linha->>'mes')::integer,
      v_grupo,
      v_plano,
      coalesce(nullif(trim(v_linha->>'conta_numero'), ''), ''),
      v_titulo,
      coalesce(nullif(trim(v_linha->>'descricao'), ''), ''),
      coalesce(nullif(trim(v_linha->>'departamento'), ''), 'Sem departamento'),
      round(coalesce((v_linha->>'valor')::numeric, 0), 2),
      coalesce((v_linha->>'fixo')::boolean, public.opex_grupo_fixo(v_grupo))
    )
    ON CONFLICT (ano, mes, grupo_conta, plano_contas, titulo_ref)
    DO UPDATE SET
      conta_numero = EXCLUDED.conta_numero,
      descricao = EXCLUDED.descricao,
      departamento = EXCLUDED.departamento,
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
  p_departamento text DEFAULT NULL,
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
      departamento = coalesce(nullif(trim(p_departamento), ''), departamento),
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
    ano, mes, grupo_conta, plano_contas, conta_numero, titulo_ref, descricao, departamento, valor, fixo
  ) VALUES (
    p_ano,
    p_mes,
    v_grupo,
    v_plano,
    coalesce(p_conta_numero, ''),
    v_titulo,
    coalesce(p_descricao, ''),
    coalesce(nullif(trim(p_departamento), ''), 'Sem departamento'),
    round(p_valor, 2),
    public.opex_grupo_fixo(v_grupo)
  )
  ON CONFLICT (ano, mes, grupo_conta, plano_contas, titulo_ref)
  DO UPDATE SET
    conta_numero = EXCLUDED.conta_numero,
    descricao = EXCLUDED.descricao,
    departamento = EXCLUDED.departamento,
    valor = EXCLUDED.valor,
    fixo = EXCLUDED.fixo,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
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
      OR l.departamento ILIKE '%' || trim(p_busca) || '%'
    )
  ORDER BY l.mes, l.grupo_conta, l.plano_contas, l.titulo_ref;
$$;

GRANT EXECUTE ON FUNCTION public.opex_orcamento_upsert_linha(uuid, integer, integer, text, text, text, text, text, text, numeric) TO anon, authenticated;
