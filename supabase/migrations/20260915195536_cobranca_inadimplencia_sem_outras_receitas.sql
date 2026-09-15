-- Inadimplência / cobrança: só o plano OUTRAS RECEITAS fica de fora.
-- Honorários (mensais, spot, êxito, sucumbência, manutenção, hora trabalhada,
-- advocatícios) e qualquer outro plano que não seja OUTRAS RECEITAS entram.

CREATE OR REPLACE FUNCTION public.plano_contas_eh_outras_receitas(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.normalize_plano_contas(t) = 'OUTRAS RECEITAS';
$$;

COMMENT ON FUNCTION public.plano_contas_eh_outras_receitas(text) IS
  'True só para o plano OUTRAS RECEITAS (não inclui REPASSE DE OUTRAS RECEITAS).';

CREATE OR REPLACE FUNCTION public.financeiro_parcela_valor_sem_outras_receitas(
  p_ci_titulo integer,
  p_valor_parcela numeric,
  p_plano_parcela text
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.financeiro_parcelas_itens i
      WHERE i.ci_titulo = p_ci_titulo
        AND public.financeiro_titulo_eh_receber(i.tipo)
    ) THEN
      COALESCE(
        (
          SELECT ROUND(SUM(GREATEST(
            COALESCE(i.valor_item, 0) - COALESCE(i.valor_pago_item, 0),
            0
          )), 2)
          FROM public.financeiro_parcelas_itens i
          WHERE i.ci_titulo = p_ci_titulo
            AND public.financeiro_titulo_eh_receber(i.tipo)
            AND NOT public.plano_contas_eh_outras_receitas(i.plano_contas)
        ),
        0
      )
    WHEN public.plano_contas_eh_outras_receitas(p_plano_parcela) THEN 0
    ELSE COALESCE(p_valor_parcela, 0)
  END;
$$;

COMMENT ON FUNCTION public.financeiro_parcela_valor_sem_outras_receitas(integer, numeric, text) IS
  'Saldo da parcela sem itens de OUTRAS RECEITAS.';

CREATE OR REPLACE FUNCTION public.financeiro_parcela_plano_sem_outras_receitas(
  p_ci_titulo integer,
  p_plano_parcela text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      (
        SELECT string_agg(DISTINCT trim(i.plano_contas), ', ' ORDER BY trim(i.plano_contas))
        FROM public.financeiro_parcelas_itens i
        WHERE i.ci_titulo = p_ci_titulo
          AND public.financeiro_titulo_eh_receber(i.tipo)
          AND NOT public.plano_contas_eh_outras_receitas(i.plano_contas)
          AND NULLIF(trim(i.plano_contas), '') IS NOT NULL
      ),
      ''
    ),
    CASE
      WHEN public.plano_contas_eh_outras_receitas(p_plano_parcela) THEN NULL
      ELSE p_plano_parcela
    END
  );
$$;

GRANT EXECUTE ON FUNCTION public.plano_contas_eh_outras_receitas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_parcela_valor_sem_outras_receitas(integer, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_parcela_plano_sem_outras_receitas(integer, text) TO anon, authenticated;

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
    adj.plano_contas,
    fp.data_vencimento,
    adj.valor,
    (CURRENT_DATE - fp.data_vencimento)::integer AS dias_atraso
  FROM public.financeiro_parcelas fp
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  CROSS JOIN LATERAL (
    SELECT
      public.financeiro_parcela_valor_sem_outras_receitas(fp.ci_titulo, fp.valor, fp.plano_contas) AS valor,
      public.financeiro_parcela_plano_sem_outras_receitas(fp.ci_titulo, fp.plano_contas) AS plano_contas
  ) adj
  WHERE fp.situacao = 'ABERTO'
    AND public.financeiro_titulo_eh_receber(fp.tipo)
    AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
    AND fp.data_vencimento < CURRENT_DATE
    AND (CURRENT_DATE - fp.data_vencimento) BETWEEN 1 AND 60
    AND CURRENT_DATE > public.cobranca_prazo_d1(fp.data_vencimento)
    AND adj.valor > 0.005;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_titulos_base() IS
  'Títulos a receber em aberto, 1–60 dias de atraso, após prazo D+1, sem itens de OUTRAS RECEITAS.';

CREATE OR REPLACE FUNCTION public.cobranca_seguimento_titulos_acima_60_base()
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
    adj.plano_contas,
    fp.data_vencimento,
    adj.valor,
    (CURRENT_DATE - fp.data_vencimento)::integer AS dias_atraso
  FROM public.financeiro_parcelas fp
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  CROSS JOIN LATERAL (
    SELECT
      public.financeiro_parcela_valor_sem_outras_receitas(fp.ci_titulo, fp.valor, fp.plano_contas) AS valor,
      public.financeiro_parcela_plano_sem_outras_receitas(fp.ci_titulo, fp.plano_contas) AS plano_contas
  ) adj
  WHERE fp.situacao = 'ABERTO'
    AND public.financeiro_titulo_eh_receber(fp.tipo)
    AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
    AND fp.data_vencimento < CURRENT_DATE
    AND (CURRENT_DATE - fp.data_vencimento) > 60
    AND adj.valor > 0.005;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_titulos_acima_60_base() IS
  'Títulos a receber em aberto com mais de 60 dias de atraso, sem itens de OUTRAS RECEITAS.';

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
      sum(GREATEST(COALESCE(i.valor_item, 0) - COALESCE(i.valor_pago_item, 0), 0)) AS valor
    FROM titulos t
    JOIN public.financeiro_parcelas fp ON fp.id = t.parcela_id
    JOIN public.financeiro_parcelas_itens i ON i.ci_titulo = fp.ci_titulo
      AND public.financeiro_titulo_eh_receber(i.tipo)
      AND NOT public.plano_contas_eh_outras_receitas(i.plano_contas)
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
  'Dashboard de seguimento pós-D+1: KPIs, top 10, grupos e departamento — sem OUTRAS RECEITAS.';

DROP VIEW IF EXISTS cobranca_kpi;
DROP VIEW IF EXISTS cobranca_painel;

CREATE VIEW cobranca_painel
WITH (security_invoker = on)
AS
SELECT
  fp.id                          AS parcela_id,
  fp.pessoa_id,
  fp.cliente,
  fp.nro_titulo,
  fp.parcela,
  fp.parcelas,
  fp.descricao,
  adj.plano_contas,
  fp.data_vencimento,
  adj.valor,
  GREATEST(
    0,
    (CURRENT_DATE - public.cobranca_prazo_d1(fp.data_vencimento))::integer
  ) AS dias_atraso,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  public.cobranca_vencimento_efetivo(fp.data_vencimento) AS data_vencimento_efetivo,
  public.cobranca_prazo_d1(fp.data_vencimento) AS data_prazo_d1,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_whatsapp_d1, false) AS tem_whatsapp_d1,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  ev.ultima_cobranca_canal,
  COALESCE(ev.tem_whatsapp, false) AS concluido
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
CROSS JOIN LATERAL (
  SELECT
    public.financeiro_parcela_valor_sem_outras_receitas(fp.ci_titulo, fp.valor, fp.plano_contas) AS valor,
    public.financeiro_parcela_plano_sem_outras_receitas(fp.ci_titulo, fp.plano_contas) AS plano_contas
) adj
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(
      ce.canal = 'whatsapp'
      AND ce.status = 'enviado'
      AND (ce.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        = public.cobranca_prazo_d1(fp.data_vencimento)
    ) AS tem_whatsapp_d1,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at) FILTER (WHERE ce.status = 'enviado')  AS ultima_cobranca_at,
    (
      SELECT ce2.canal::text
      FROM cobranca_eventos ce2
      WHERE ce2.parcela_id = fp.id AND ce2.status = 'enviado'
      ORDER BY ce2.created_at DESC
      LIMIT 1
    ) AS ultima_cobranca_canal
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND public.financeiro_titulo_eh_receber(fp.tipo)
  AND CURRENT_DATE >= public.cobranca_prazo_d1(fp.data_vencimento)
  AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
  AND adj.valor > 0.005
  AND NOT EXISTS (
    SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id
  );

COMMENT ON VIEW cobranca_painel IS
  'Painel de cobrança (RECEBER), sem itens de OUTRAS RECEITAS. ultima_cobranca_at/canal = último disparo enviado.';

CREATE VIEW cobranca_kpi
WITH (security_invoker = on)
AS
SELECT
  count(*)                                                          AS titulos_vencidos,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS titulos_cobrados,
  count(*) FILTER (WHERE NOT tem_whatsapp_d1)                       AS titulos_pendentes,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS com_whatsapp,
  count(*) FILTER (WHERE tem_email)                                 AS com_email,
  count(*) FILTER (WHERE tem_whatsapp_d1)                           AS concluidos,
  COALESCE(sum(valor), 0)                                           AS valor_vencido,
  COALESCE(sum(valor) FILTER (WHERE tem_whatsapp_d1), 0)            AS valor_cobrado,
  COALESCE(sum(valor) FILTER (WHERE NOT tem_whatsapp_d1), 0)        AS valor_pendente,
  CASE WHEN count(*) > 0
    THEN round(100.0 * count(*) FILTER (WHERE tem_whatsapp_d1) / count(*), 1)
    ELSE 100
  END                                                              AS efetividade_pct
FROM cobranca_painel
WHERE data_vencimento >= DATE '2026-05-01';

DROP VIEW IF EXISTS cobranca_titulos_abertos;

CREATE VIEW cobranca_titulos_abertos
WITH (security_invoker = on)
AS
SELECT
  fp.id                          AS parcela_id,
  fp.pessoa_id,
  fp.cliente,
  fp.nro_titulo,
  fp.parcela,
  fp.parcelas,
  fp.descricao,
  adj.plano_contas,
  fp.data_vencimento,
  adj.valor,
  GREATEST(
    0,
    (CURRENT_DATE - public.cobranca_prazo_d1(fp.data_vencimento))::integer
  ) AS dias_atraso,
  (fp.data_vencimento >= CURRENT_DATE)                     AS a_vencer,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  regexp_replace(COALESCE(p.telefone, ''), '\D', '', 'g')  AS telefone_digits,
  public.cobranca_vencimento_efetivo(fp.data_vencimento) AS data_vencimento_efetivo,
  public.cobranca_prazo_d1(fp.data_vencimento) AS data_prazo_d1,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  ev.ultima_cobranca_canal,
  EXISTS (SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id) AS arquivado
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
CROSS JOIN LATERAL (
  SELECT
    public.financeiro_parcela_valor_sem_outras_receitas(fp.ci_titulo, fp.valor, fp.plano_contas) AS valor,
    public.financeiro_parcela_plano_sem_outras_receitas(fp.ci_titulo, fp.plano_contas) AS plano_contas
) adj
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at) FILTER (WHERE ce.status = 'enviado')  AS ultima_cobranca_at,
    (
      SELECT ce2.canal::text
      FROM cobranca_eventos ce2
      WHERE ce2.parcela_id = fp.id AND ce2.status = 'enviado'
      ORDER BY ce2.created_at DESC
      LIMIT 1
    ) AS ultima_cobranca_canal
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND public.financeiro_titulo_eh_receber(fp.tipo)
  AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
  AND adj.valor > 0.005;
