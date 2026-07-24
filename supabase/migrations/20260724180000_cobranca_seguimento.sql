-- Cobrança pós-D+1 (Seguimento): títulos vencidos 1–60 dias após prazo D+1, agrupados por grupo_cliente canônico.

CREATE TABLE IF NOT EXISTS public.cobranca_seguimento_acoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_chave      TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN (
    'ligacao', 'email', 'whatsapp', 'reuniao', 'acordo', 'promessa_pagamento', 'outro'
  )),
  descricao        TEXT NOT NULL,
  data_acao        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_follow_up   DATE,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cobranca_seguimento_acoes IS
  'Ações manuais de seguimento de cobrança pós-D+1 (segunda cobrança), por grupo.';

CREATE INDEX IF NOT EXISTS idx_cobranca_seguimento_acoes_grupo
  ON public.cobranca_seguimento_acoes (grupo_chave, data_acao DESC);

ALTER TABLE public.cobranca_seguimento_acoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cobranca_seguimento_acoes_select_authenticated ON public.cobranca_seguimento_acoes;
CREATE POLICY cobranca_seguimento_acoes_select_authenticated
  ON public.cobranca_seguimento_acoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cobranca_seguimento_acoes_insert_authenticated ON public.cobranca_seguimento_acoes;
CREATE POLICY cobranca_seguimento_acoes_insert_authenticated
  ON public.cobranca_seguimento_acoes FOR INSERT TO authenticated WITH CHECK (true);

-- Base de títulos elegíveis para seguimento (1–60 dias, pós-D+1).
CREATE OR REPLACE FUNCTION public.cobranca_seguimento_titulos_base()
RETURNS TABLE (
  parcela_id uuid,
  pessoa_id uuid,
  cliente text,
  pessoa_nome text,
  grupo_chave text,
  nro_titulo text,
  parcela text,
  parcelas text,
  descricao text,
  plano_contas text,
  data_vencimento date,
  valor numeric,
  dias_atraso integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fp.id AS parcela_id,
    fp.pessoa_id,
    fp.cliente,
    p.nome AS pessoa_nome,
    public.receita_inadimplencia_chave_grupo(
      public.receita_grupo_cliente_canonico(fp.cliente, fp.pessoa_id),
      fp.cliente
    ) AS grupo_chave,
    fp.nro_titulo,
    fp.parcela,
    fp.parcelas,
    fp.descricao,
    fp.plano_contas,
    fp.data_vencimento,
    fp.valor,
    (CURRENT_DATE - fp.data_vencimento)::integer AS dias_atraso
  FROM public.financeiro_parcelas fp
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  WHERE fp.situacao = 'ABERTO'
    AND public.financeiro_titulo_eh_receber(fp.tipo)
    AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
    AND fp.data_vencimento < CURRENT_DATE
    AND (CURRENT_DATE - fp.data_vencimento) BETWEEN 1 AND 60
    AND CURRENT_DATE > public.cobranca_prazo_d1(fp.data_vencimento);
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_titulos_base() IS
  'Títulos a receber em aberto, 1–60 dias de atraso, após prazo D+1, com chave de grupo canônica.';

CREATE OR REPLACE FUNCTION public.cobranca_seguimento_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH titulos AS (
    SELECT * FROM public.cobranca_seguimento_titulos_base()
  ),
  eventos_d1 AS (
    SELECT
      t.grupo_chave,
      bool_or(ce.status = 'enviado') AS cobranca_d1_realizada,
      max(ce.created_at) FILTER (WHERE ce.status = 'enviado') AS ultima_cobranca_d1_at,
      (
        SELECT ce2.canal
        FROM public.cobranca_eventos ce2
        JOIN titulos t2 ON t2.parcela_id = ce2.parcela_id
        WHERE t2.grupo_chave = t.grupo_chave
          AND ce2.status = 'enviado'
        ORDER BY ce2.created_at DESC
        LIMIT 1
      ) AS ultima_cobranca_d1_canal
    FROM titulos t
    LEFT JOIN public.cobranca_eventos ce ON ce.parcela_id = t.parcela_id
    GROUP BY t.grupo_chave
  ),
  acoes AS (
    SELECT
      a.grupo_chave,
      max(a.created_at) AS ultima_acao_seguimento_at,
      (
        SELECT a2.tipo
        FROM public.cobranca_seguimento_acoes a2
        WHERE a2.grupo_chave = a.grupo_chave
        ORDER BY a2.data_acao DESC, a2.created_at DESC
        LIMIT 1
      ) AS ultima_acao_seguimento_tipo,
      (
        SELECT a2.data_follow_up
        FROM public.cobranca_seguimento_acoes a2
        WHERE a2.grupo_chave = a.grupo_chave
          AND a2.data_follow_up IS NOT NULL
        ORDER BY a2.data_acao DESC, a2.created_at DESC
        LIMIT 1
      ) AS proximo_follow_up
    FROM public.cobranca_seguimento_acoes a
    GROUP BY a.grupo_chave
  ),
  grupos AS (
    SELECT
      t.grupo_chave,
      count(*)::integer AS qtd_titulos,
      coalesce(sum(t.valor), 0) AS valor_total,
      max(t.dias_atraso)::integer AS max_dias_atraso,
      round(avg(t.dias_atraso))::integer AS media_dias_atraso,
      count(DISTINCT coalesce(t.pessoa_nome, t.cliente))::integer AS qtd_razoes,
      coalesce(ed.cobranca_d1_realizada, false) AS cobranca_d1_realizada,
      ed.ultima_cobranca_d1_at,
      ed.ultima_cobranca_d1_canal,
      ac.ultima_acao_seguimento_at,
      ac.ultima_acao_seguimento_tipo,
      ac.proximo_follow_up
    FROM titulos t
    LEFT JOIN eventos_d1 ed ON ed.grupo_chave = t.grupo_chave
    LEFT JOIN acoes ac ON ac.grupo_chave = t.grupo_chave
    GROUP BY
      t.grupo_chave,
      ed.cobranca_d1_realizada,
      ed.ultima_cobranca_d1_at,
      ed.ultima_cobranca_d1_canal,
      ac.ultima_acao_seguimento_at,
      ac.ultima_acao_seguimento_tipo,
      ac.proximo_follow_up
  ),
  kpis AS (
    SELECT
      coalesce(sum(valor_total), 0) AS valor_total,
      coalesce(sum(qtd_titulos), 0)::integer AS qtd_titulos,
      count(*)::integer AS qtd_grupos,
      coalesce(sum(valor_total) FILTER (WHERE max_dias_atraso <= 30), 0) AS valor_faixa_1_30,
      coalesce(sum(valor_total) FILTER (WHERE max_dias_atraso > 30), 0) AS valor_faixa_31_60,
      coalesce(round(avg(media_dias_atraso)), 0)::integer AS media_dias_atraso
    FROM grupos
  ),
  top_dev AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'grupo_chave', g.grupo_chave,
        'valor_total', g.valor_total,
        'qtd_titulos', g.qtd_titulos,
        'max_dias_atraso', g.max_dias_atraso
      )
      ORDER BY g.valor_total DESC
    ) AS items
    FROM (
      SELECT * FROM grupos ORDER BY valor_total DESC LIMIT 10
    ) g
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(k.*) FROM kpis k),
    'top_devedores', coalesce((SELECT items FROM top_dev), '[]'::jsonb),
    'grupos', coalesce(
      (
        SELECT jsonb_agg(to_jsonb(g.*) ORDER BY g.valor_total DESC)
        FROM grupos g
      ),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_dashboard() IS
  'Dashboard de seguimento pós-D+1: KPIs, top 10 devedores e lista de grupos.';

CREATE OR REPLACE FUNCTION public.cobranca_seguimento_grupo_detalhe(p_grupo_chave text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_grupo_chave IS NULL OR trim(p_grupo_chave) = '' THEN
    RETURN jsonb_build_object('titulos', '[]'::jsonb, 'historico_d1', '[]'::jsonb, 'acoes_seguimento', '[]'::jsonb);
  END IF;

  WITH titulos AS (
    SELECT *
    FROM public.cobranca_seguimento_titulos_base()
    WHERE grupo_chave = p_grupo_chave
  ),
  historico AS (
    SELECT
      ce.id,
      ce.parcela_id,
      t.nro_titulo,
      t.cliente,
      ce.canal,
      ce.status,
      ce.created_at,
      left(coalesce(ce.mensagem, ''), 200) AS mensagem_resumo,
      ce.created_by
    FROM public.cobranca_eventos ce
    JOIN titulos t ON t.parcela_id = ce.parcela_id
    WHERE ce.status = 'enviado'
    ORDER BY ce.created_at DESC
  ),
  acoes AS (
    SELECT
      a.id,
      a.tipo,
      a.descricao,
      a.data_acao,
      a.data_follow_up,
      a.created_by,
      a.created_at
    FROM public.cobranca_seguimento_acoes a
    WHERE a.grupo_chave = p_grupo_chave
    ORDER BY a.data_acao DESC, a.created_at DESC
  )
  SELECT jsonb_build_object(
    'grupo_chave', p_grupo_chave,
    'titulos', coalesce(
      (SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.dias_atraso DESC, t.data_vencimento)
       FROM titulos t),
      '[]'::jsonb
    ),
    'historico_d1', coalesce(
      (SELECT jsonb_agg(to_jsonb(h.*) ORDER BY h.created_at DESC) FROM historico h),
      '[]'::jsonb
    ),
    'acoes_seguimento', coalesce(
      (SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.data_acao DESC, a.created_at DESC) FROM acoes a),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_grupo_detalhe(text) IS
  'Detalhe de um grupo no seguimento pós-D+1: títulos, histórico D+1 e ações de seguimento.';

GRANT EXECUTE ON FUNCTION public.cobranca_seguimento_titulos_base() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_seguimento_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_seguimento_grupo_detalhe(text) TO authenticated;
