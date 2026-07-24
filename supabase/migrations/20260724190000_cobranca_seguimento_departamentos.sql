-- Repartição por departamento (VIOS) nos grupos do seguimento pós-D+1.

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
  item_dept AS (
    SELECT
      t.grupo_chave,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      sum(abs(coalesce(i.valor_item, i.valor_fluxo_item, 0))) AS valor
    FROM titulos t
    JOIN public.financeiro_parcelas fp ON fp.id = t.parcela_id
    JOIN public.financeiro_parcelas_itens i ON i.ci_titulo = fp.ci_titulo
      AND public.financeiro_titulo_eh_receber(i.tipo)
    GROUP BY t.grupo_chave, departamento
  ),
  parcel_sem_item AS (
    SELECT
      t.grupo_chave,
      'Sem departamento'::text AS departamento,
      sum(t.valor) AS valor
    FROM titulos t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.financeiro_parcelas fp
      JOIN public.financeiro_parcelas_itens i ON i.ci_titulo = fp.ci_titulo
        AND public.financeiro_titulo_eh_receber(i.tipo)
      WHERE fp.id = t.parcela_id
    )
    GROUP BY t.grupo_chave
  ),
  dept_agg AS (
    SELECT grupo_chave, departamento, sum(valor) AS valor
    FROM (
      SELECT * FROM item_dept
      UNION ALL
      SELECT * FROM parcel_sem_item
    ) u
    GROUP BY grupo_chave, departamento
  ),
  grupos_base AS (
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
  grupos AS (
    SELECT
      gb.*,
      coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'departamento', da.departamento,
              'valor', da.valor,
              'pct', round(100.0 * da.valor / nullif(gb.valor_total, 0), 2)
            )
            ORDER BY da.valor DESC
          )
          FROM dept_agg da
          WHERE da.grupo_chave = gb.grupo_chave
        ),
        '[]'::jsonb
      ) AS departamentos
    FROM grupos_base gb
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
  'Dashboard de seguimento pós-D+1: KPIs, top 10 devedores, grupos e repartição por departamento VIOS.';
