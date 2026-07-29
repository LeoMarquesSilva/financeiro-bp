-- Upsert parcial: não sobrescrever campos omitidos (null) com defaults.

DROP FUNCTION IF EXISTS public.opex_orcamento_upsert_linha(uuid, integer, integer, text, text, text, text, text, numeric);

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
  IF p_id IS NOT NULL THEN
    UPDATE public.opex_orcamento_linha
    SET
      mes = COALESCE(p_mes, mes),
      grupo_conta = CASE
        WHEN p_grupo_conta IS NOT NULL THEN public.opex_orcamento_norm_grupo(p_grupo_conta)
        ELSE grupo_conta
      END,
      plano_contas = CASE
        WHEN p_plano_contas IS NOT NULL THEN public.opex_orcamento_norm_plano(p_plano_contas)
        ELSE plano_contas
      END,
      conta_numero = COALESCE(p_conta_numero, conta_numero),
      titulo_ref = CASE
        WHEN p_titulo_ref IS NOT NULL THEN COALESCE(NULLIF(TRIM(p_titulo_ref), ''), '—')
        ELSE titulo_ref
      END,
      descricao = COALESCE(p_descricao, descricao),
      departamento = CASE
        WHEN p_departamento IS NOT NULL THEN COALESCE(NULLIF(TRIM(p_departamento), ''), 'Sem departamento')
        ELSE departamento
      END,
      valor = COALESCE(ROUND(p_valor, 2), valor),
      fixo = public.opex_grupo_fixo(
        CASE
          WHEN p_grupo_conta IS NOT NULL THEN public.opex_orcamento_norm_grupo(p_grupo_conta)
          ELSE grupo_conta
        END
      )
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Linha de orçamento não encontrada';
    END IF;

    RETURN v_id;
  END IF;

  v_grupo := public.opex_orcamento_norm_grupo(p_grupo_conta);
  v_plano := public.opex_orcamento_norm_plano(p_plano_contas);
  v_titulo := COALESCE(NULLIF(TRIM(p_titulo_ref), ''), '—');

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
    COALESCE(p_conta_numero, ''),
    v_titulo,
    COALESCE(p_descricao, ''),
    COALESCE(NULLIF(TRIM(p_departamento), ''), 'Sem departamento'),
    ROUND(p_valor, 2),
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

COMMENT ON FUNCTION public.opex_orcamento_upsert_linha(uuid, integer, integer, text, text, text, text, text, text, numeric) IS
  'Insert ou update parcial por id — parâmetros null não alteram o campo existente.';
