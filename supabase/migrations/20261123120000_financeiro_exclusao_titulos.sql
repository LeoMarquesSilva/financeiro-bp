-- Exclusão manual de títulos pela responsável do Financeiro (tela "Exclusão de Títulos").
--
-- Por quê: a sync do VIOS só faz upsert (sync_relatorio_financeiro_upsert) e nunca
-- apaga. Título excluído no VIOS ficava no SIOE até alguém apagar à mão no banco.
--
-- O que esta migration cria:
-- 1) financeiro_exclusao_autorizados: quem pode excluir. É por PESSOA, não por perfil
--    (há vários admins e só a responsável do Financeiro deve excluir). Não tem política
--    de escrita: só muda por SQL com service role, nunca pela tela de Usuários.
-- 2) financeiro_titulos_excluidos: histórico (quem, quando, motivo) com backup completo
--    do título e dos dependentes. Enquanto não for restaurado, também trava a sync:
--    o título não volta mesmo se ainda existir no VIOS.
-- 3) RPCs: current_user_pode_excluir_titulos, financeiro_exclusao_buscar,
--    financeiro_exclusao_excluir, financeiro_exclusao_restaurar.
-- 4) sync_relatorio_financeiro_upsert passa a ignorar títulos excluídos.

-- =========================================================
-- 1) Quem pode excluir
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financeiro_exclusao_autorizados (
  team_member_id uuid PRIMARY KEY REFERENCES public.team_members (id) ON DELETE CASCADE,
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financeiro_exclusao_autorizados IS
  'Pessoas que podem excluir títulos do financeiro pelo SIOE. Só muda por SQL (service role).';

ALTER TABLE public.financeiro_exclusao_autorizados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_exclusao_autorizados FROM anon, authenticated;

-- Juliana Pires (Financeiro). Pelo id para não depender do e-mail de login.
INSERT INTO public.financeiro_exclusao_autorizados (team_member_id, observacao)
SELECT tm.id, 'Responsável do Financeiro'
FROM public.team_members tm
WHERE tm.id = '7c59b974-0529-45ea-a764-ddb62936e8d8'
ON CONFLICT (team_member_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_pode_excluir_titulos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.financeiro_exclusao_autorizados a
    JOIN public.team_members tm ON tm.id = a.team_member_id
    WHERE lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND coalesce(tm.is_active, true) = true
  );
$$;

COMMENT ON FUNCTION public.current_user_pode_excluir_titulos() IS
  'True se o usuário logado está em financeiro_exclusao_autorizados e ativo.';

REVOKE ALL ON FUNCTION public.current_user_pode_excluir_titulos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_pode_excluir_titulos() TO authenticated;

-- =========================================================
-- 2) Histórico + backup + trava da sync
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financeiro_titulos_excluidos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id              uuid NOT NULL,
  ci_titulo            integer NOT NULL,
  nro_titulo           text,
  tipo                 text,
  cliente              text,
  data_vencimento      date,
  valor                numeric,
  motivo               text NOT NULL CHECK (length(btrim(motivo)) >= 5),
  backup               jsonb NOT NULL,
  excluido_por_email   text NOT NULL,
  excluido_por_nome    text,
  excluido_em          timestamptz NOT NULL DEFAULT now(),
  restaurado_em        timestamptz,
  restaurado_por_email text,
  restaurado_por_nome  text
);

COMMENT ON TABLE public.financeiro_titulos_excluidos IS
  'Títulos excluídos manualmente no SIOE (backup completo). Sem restaurado_em, a sync do VIOS não traz o título de volta.';

-- Um título só pode estar "excluído e não restaurado" uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_titulos_excluidos_ativo_uidx
  ON public.financeiro_titulos_excluidos (ci_titulo)
  WHERE restaurado_em IS NULL;

CREATE INDEX IF NOT EXISTS financeiro_titulos_excluidos_excluido_em_idx
  ON public.financeiro_titulos_excluidos (excluido_em DESC);

ALTER TABLE public.financeiro_titulos_excluidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_titulos_excluidos FROM anon, authenticated;
GRANT SELECT ON public.financeiro_titulos_excluidos TO authenticated;

-- Leitura: quem exclui e os admins (auditoria). Escrita só pelas RPCs abaixo.
DROP POLICY IF EXISTS financeiro_titulos_excluidos_select ON public.financeiro_titulos_excluidos;
CREATE POLICY financeiro_titulos_excluidos_select
  ON public.financeiro_titulos_excluidos
  FOR SELECT TO authenticated
  USING (public.current_user_pode_excluir_titulos() OR public.current_user_is_admin());

-- =========================================================
-- 3) RPCs
-- =========================================================

-- Busca por número do título (com ou sem "-1") e/ou por cliente (só em aberto).
CREATE OR REPLACE FUNCTION public.financeiro_exclusao_buscar(
  p_numeros text[] DEFAULT '{}',
  p_cliente text DEFAULT NULL
)
RETURNS TABLE (
  ci_titulo       integer,
  nro_titulo      text,
  tipo            text,
  cliente         text,
  data_vencimento date,
  valor           numeric,
  situacao        text,
  plano_contas    text,
  descricao       text,
  qtd_itens       integer,
  qtd_cobrancas   integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_numeros text[] := coalesce(p_numeros, '{}');
  v_cliente text := nullif(btrim(coalesce(p_cliente, '')), '');
BEGIN
  IF NOT public.current_user_pode_excluir_titulos() THEN
    RAISE EXCEPTION 'Sem permissão para excluir títulos.' USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_numeros) = 0 AND (v_cliente IS NULL OR length(v_cliente) < 3) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fp.ci_titulo,
    fp.nro_titulo,
    fp.tipo,
    fp.cliente,
    fp.data_vencimento,
    fp.valor,
    fp.situacao,
    fp.plano_contas,
    fp.descricao,
    (SELECT count(*)::integer FROM financeiro_parcelas_itens i WHERE i.ci_titulo = fp.ci_titulo),
    (SELECT count(*)::integer FROM cobranca_eventos e WHERE e.parcela_id = fp.id)
  FROM financeiro_parcelas fp
  WHERE (
      cardinality(v_numeros) > 0
      AND (fp.nro_titulo = ANY (v_numeros) OR split_part(fp.nro_titulo, '-', 1) = ANY (v_numeros))
    )
    OR (
      v_cliente IS NOT NULL
      AND length(v_cliente) >= 3
      AND fp.situacao = 'ABERTO'
      AND fp.cliente ILIKE '%' || v_cliente || '%'
    )
  ORDER BY fp.cliente, fp.data_vencimento, fp.nro_titulo
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_exclusao_buscar(text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_exclusao_buscar(text[], text) TO authenticated;

-- Exclui os títulos (só em aberto), guardando backup de tudo que o CASCADE apaga.
CREATE OR REPLACE FUNCTION public.financeiro_exclusao_excluir(
  p_ci_titulos integer[],
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome       text;
  v_lote       uuid := gen_random_uuid();
  v_motivo     text := btrim(coalesce(p_motivo, ''));
  v_pedidos    integer[];
  v_qtd_achados integer;
  v_pagos      text[];
  v_excluidos  integer;
BEGIN
  IF NOT public.current_user_pode_excluir_titulos() THEN
    RAISE EXCEPTION 'Sem permissão para excluir títulos.' USING ERRCODE = '42501';
  END IF;

  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão.';
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_pedidos
  FROM unnest(coalesce(p_ci_titulos, '{}')) AS x
  WHERE x IS NOT NULL;

  IF v_pedidos IS NULL THEN
    RAISE EXCEPTION 'Nenhum título selecionado.';
  END IF;
  IF cardinality(v_pedidos) > 200 THEN
    RAISE EXCEPTION 'Selecione no máximo 200 títulos por vez.';
  END IF;

  SELECT tm.full_name INTO v_nome
  FROM team_members tm
  WHERE lower(tm.email) = v_email
  LIMIT 1;

  -- Trava as linhas: a sync não mexe nelas enquanto a exclusão roda.
  PERFORM 1 FROM financeiro_parcelas fp WHERE fp.ci_titulo = ANY (v_pedidos) FOR UPDATE;

  SELECT count(*) INTO v_qtd_achados FROM financeiro_parcelas fp WHERE fp.ci_titulo = ANY (v_pedidos);
  IF v_qtd_achados <> cardinality(v_pedidos) THEN
    RAISE EXCEPTION 'Algum título selecionado não está mais no SIOE. Refaça a busca e tente de novo.';
  END IF;

  SELECT array_agg(fp.nro_titulo ORDER BY fp.nro_titulo) INTO v_pagos
  FROM financeiro_parcelas fp
  WHERE fp.ci_titulo = ANY (v_pedidos)
    AND fp.situacao IS DISTINCT FROM 'ABERTO';
  IF v_pagos IS NOT NULL THEN
    RAISE EXCEPTION 'Só títulos em aberto podem ser excluídos. Pagos: %', array_to_string(v_pagos, ', ');
  END IF;

  INSERT INTO financeiro_titulos_excluidos (
    lote_id, ci_titulo, nro_titulo, tipo, cliente, data_vencimento, valor,
    motivo, backup, excluido_por_email, excluido_por_nome
  )
  SELECT
    v_lote,
    fp.ci_titulo,
    fp.nro_titulo,
    fp.tipo,
    fp.cliente,
    fp.data_vencimento,
    fp.valor,
    v_motivo,
    jsonb_build_object(
      'financeiro_parcelas', to_jsonb(fp),
      'financeiro_parcelas_itens', coalesce(
        (SELECT jsonb_agg(to_jsonb(i)) FROM financeiro_parcelas_itens i WHERE i.ci_titulo = fp.ci_titulo),
        '[]'::jsonb
      ),
      'cobranca_arquivamentos', coalesce(
        (SELECT jsonb_agg(to_jsonb(a)) FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id),
        '[]'::jsonb
      ),
      'cobranca_eventos', coalesce(
        (SELECT jsonb_agg(to_jsonb(e)) FROM cobranca_eventos e WHERE e.parcela_id = fp.id),
        '[]'::jsonb
      )
    ),
    v_email,
    v_nome
  FROM financeiro_parcelas fp
  WHERE fp.ci_titulo = ANY (v_pedidos);

  -- CASCADE apaga itens, arquivamentos e eventos de cobrança (já no backup).
  DELETE FROM financeiro_parcelas fp WHERE fp.ci_titulo = ANY (v_pedidos);
  GET DIAGNOSTICS v_excluidos = ROW_COUNT;

  RETURN jsonb_build_object('lote_id', v_lote, 'excluidos', v_excluidos);
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_exclusao_excluir(integer[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_exclusao_excluir(integer[], text) TO authenticated;

-- Desfaz uma exclusão: devolve o título e os dependentes a partir do backup.
CREATE OR REPLACE FUNCTION public.financeiro_exclusao_restaurar(p_exclusao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome  text;
  v_ex    financeiro_titulos_excluidos%ROWTYPE;
BEGIN
  IF NOT public.current_user_pode_excluir_titulos() THEN
    RAISE EXCEPTION 'Sem permissão para restaurar títulos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ex FROM financeiro_titulos_excluidos WHERE id = p_exclusao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exclusão não encontrada.';
  END IF;
  IF v_ex.restaurado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Este título já foi restaurado.';
  END IF;
  IF EXISTS (SELECT 1 FROM financeiro_parcelas fp WHERE fp.ci_titulo = v_ex.ci_titulo) THEN
    RAISE EXCEPTION 'O título % já está no SIOE.', v_ex.nro_titulo;
  END IF;

  SELECT tm.full_name INTO v_nome
  FROM team_members tm
  WHERE lower(tm.email) = v_email
  LIMIT 1;

  INSERT INTO financeiro_parcelas
  SELECT * FROM jsonb_populate_record(NULL::financeiro_parcelas, v_ex.backup -> 'financeiro_parcelas');

  INSERT INTO financeiro_parcelas_itens
  SELECT * FROM jsonb_populate_recordset(
    NULL::financeiro_parcelas_itens,
    coalesce(v_ex.backup -> 'financeiro_parcelas_itens', '[]'::jsonb)
  );

  INSERT INTO cobranca_arquivamentos
  SELECT * FROM jsonb_populate_recordset(
    NULL::cobranca_arquivamentos,
    coalesce(v_ex.backup -> 'cobranca_arquivamentos', '[]'::jsonb)
  );

  INSERT INTO cobranca_eventos
  SELECT * FROM jsonb_populate_recordset(
    NULL::cobranca_eventos,
    coalesce(v_ex.backup -> 'cobranca_eventos', '[]'::jsonb)
  );

  UPDATE financeiro_titulos_excluidos
  SET restaurado_em = now(),
      restaurado_por_email = v_email,
      restaurado_por_nome = v_nome
  WHERE id = p_exclusao_id;

  RETURN jsonb_build_object('ci_titulo', v_ex.ci_titulo, 'nro_titulo', v_ex.nro_titulo);
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_exclusao_restaurar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_exclusao_restaurar(uuid) TO authenticated;

-- =========================================================
-- 4) Sync do VIOS não traz de volta título excluído
-- =========================================================
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM financeiro_titulos_excluidos ex
    WHERE ex.ci_titulo = (r->>'ci_titulo')::integer
      AND ex.restaurado_em IS NULL
  )
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
  'Upsert pontual de parcelas VIOS: atualiza e inclui CIs do payload, exceto os excluídos manualmente no SIOE. Não remove o que ficou de fora do arquivo.';
