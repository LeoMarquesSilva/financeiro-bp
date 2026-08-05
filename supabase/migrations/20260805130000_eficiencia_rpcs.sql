-- RPCs de apuração do painel Eficiência Operacional, sobre as tabelas sp_* (sync SharePoint).
-- Padrão: funções STABLE SECURITY DEFINER retornando TABLE, mesmo estilo de receita_totais_mensais.

-- ============================================================
-- SLA de Vistagem D+1 (sp_publicacoes) — série mensal + total, por risco/comum e área
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,   -- true = só demanda de risco, false = só comum, NULL = ambas
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM disponibilizado_vistagem)::integer AS mes,
    COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
    COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL), 0) * 100,
        0
      ), 2
    ) AS pct_d1
  FROM sp_publicacoes
  WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
    AND (p_risco IS NULL OR (demanda_risco = 'Sim') = p_risco)
    AND (p_area IS NULL OR area = p_area)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_por_usuario(
  p_ano integer,
  p_mes integer DEFAULT NULL,
  p_risco boolean DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT vistado_por, vistado_d1
    FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = p_mes)
      AND (p_risco IS NULL OR (demanda_risco = 'Sim') = p_risco)
      AND vistado_por IS NOT NULL
  ),
  por_usuario AS (
    SELECT
      vistado_por AS usuario,
      COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
      COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1
    FROM base
    GROUP BY 1
  ),
  total_geral AS (
    SELECT COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric AS v FROM base
  )
  SELECT
    usuario,
    total,
    vistado_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF(total, 0) * 100, 0), 2) AS pct_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF((SELECT v FROM total_geral), 0) * 100, 0), 2) AS pct_do_total
  FROM por_usuario
  ORDER BY total DESC;
$$;

-- ============================================================
-- SLA de Protocolo (sp_tarefas_historico / "Nova") — série mensal + total + meta
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_total integer,
  pct_eficiencia numeric,
  meta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM conclusao_completa)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1') AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'FATAL') AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')) AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1')::numeric
          / NULLIF(COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_fatal integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao AS usuario
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL'
      AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes)
      AND usuario_conclusao IS NOT NULL
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

-- ============================================================
-- Eficiência de Protocolo (sp_protocolos) — % sem inconsistência jurídica
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA') AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_inconsistencia integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT criado_por AS usuario
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = p_mes)
      AND criado_por IS NOT NULL
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

-- ============================================================
-- Agendamento / Ciência D+1 (sp_tarefas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  dentro_prazo integer,
  fora_prazo integer,
  pct_dentro_prazo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Nota: o BI grava "Dentro do prazo" (p minúsculo) e "Fora do Prazo" (P maiúsculo) —
  -- comparação abaixo é case-insensitive para não depender dessa inconsistência de origem.
  SELECT
    EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo') AS dentro_prazo,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo') AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'),
              0
            ) * 100,
        0
      ), 2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_por_usuario(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  dentro_prazo integer,
  fora_prazo integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao, fatal_sem18_d1
    FROM sp_tarefas
    WHERE (fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo')
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = p_mes)
      AND usuario_conclusao IS NOT NULL
  ),
  total AS (SELECT COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric AS v FROM base)
  SELECT
    usuario_conclusao AS usuario,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF((SELECT v FROM total), 0) * 100,
        0
      ), 2
    ) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY dentro_prazo DESC;
$$;

-- ============================================================
-- Turnover / Retenção de talentos (sp_turnover)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_turnover_anual(p_ano integer)
RETURNS TABLE (
  funcionarios_ativos integer,
  saidas_voluntarias integer,
  pct_retencao numeric,
  meta_pct_retencao_minima numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
  ),
  saidas AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE tipo_desligamento = 'Voluntário'
      AND EXTRACT(YEAR FROM desligamento)::integer = p_ano
  )
  -- Meta do BI: máximo de 15% de saídas voluntárias no ano -> mínimo de 85% de retenção.
  SELECT
    ativos.n,
    saidas.n,
    ROUND(100 - COALESCE(saidas.n::numeric / NULLIF(ativos.n, 0) * 100, 0), 2) AS pct_retencao,
    85.0 AS meta_pct_retencao_minima
  FROM ativos, saidas;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_turnover_desligamentos(p_ano integer)
RETURNS TABLE (
  nome text,
  area text,
  cargo text,
  admissao date,
  desligamento date,
  tipo_desligamento text,
  meses_casa integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    nome, area, cargo, admissao, desligamento, tipo_desligamento,
    CASE WHEN admissao IS NOT NULL AND desligamento IS NOT NULL
      THEN (EXTRACT(YEAR FROM age(desligamento, admissao)) * 12
            + EXTRACT(MONTH FROM age(desligamento, admissao)))::integer
      ELSE NULL
    END AS meses_casa
  FROM sp_turnover
  WHERE EXTRACT(YEAR FROM desligamento)::integer = p_ano
  ORDER BY desligamento DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_turnover_top5_tempo_casa(p_ano integer)
RETURNS TABLE (
  nome text,
  area text,
  cargo text,
  admissao date,
  meses_casa integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    nome, area, cargo, admissao,
    (EXTRACT(YEAR FROM age(make_date(p_ano, 12, 31), admissao)) * 12
      + EXTRACT(MONTH FROM age(make_date(p_ano, 12, 31), admissao)))::integer AS meses_casa
  FROM sp_turnover
  WHERE admissao IS NOT NULL
    AND EXTRACT(YEAR FROM admissao)::integer <= p_ano
    AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
  ORDER BY admissao ASC
  LIMIT 5;
$$;

-- ============================================================
-- Treinamentos (sp_treinamentos_presenca) — meta 14h/pessoa ativa/ano
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_anual(p_ano integer)
RETURNS TABLE (
  minutos_lancados numeric,
  pessoas_ativas integer,
  meta_minutos numeric,
  pct_atingimento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH minutos AS (
    SELECT COALESCE(SUM(duracao_minutos), 0) AS v
    FROM sp_treinamentos_presenca
    WHERE EXTRACT(YEAR FROM data)::integer = p_ano
  ),
  ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
  )
  SELECT
    minutos.v,
    ativos.n,
    (ativos.n * 14 * 60)::numeric AS meta_minutos,
    ROUND(COALESCE(minutos.v / NULLIF(ativos.n * 14 * 60, 0) * 100, 0), 2) AS pct_atingimento
  FROM minutos, ativos;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_por_pessoa(p_ano integer)
RETURNS TABLE (
  colaborador text,
  minutos_lancados numeric,
  horas_formatadas text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    colaborador,
    COALESCE(SUM(duracao_minutos), 0) AS minutos_lancados,
    LPAD((FLOOR(COALESCE(SUM(duracao_minutos), 0) / 60))::text, 2, '0') || ':' ||
      LPAD((MOD(COALESCE(SUM(duracao_minutos), 0)::integer, 60))::text, 2, '0') AS horas_formatadas
  FROM sp_treinamentos_presenca
  WHERE EXTRACT(YEAR FROM data)::integer = p_ano
    AND colaborador IS NOT NULL
  GROUP BY colaborador
  ORDER BY minutos_lancados DESC;
$$;

-- ============================================================
-- Benefício econômico (sp_decisoes_processuais)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_beneficio_economico_anual(p_ano integer)
RETURNS TABLE (
  qtd_decisoes integer,
  valor_acao numeric,
  valor_condenacao numeric,
  beneficio_economico numeric,
  pct_beneficio numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(valor_acao), 0),
    COALESCE(SUM(valor_condenacao), 0),
    COALESCE(SUM(valor_acao), 0) - COALESCE(SUM(valor_condenacao), 0),
    ROUND(
      COALESCE(
        (COALESCE(SUM(valor_acao), 0) - COALESCE(SUM(valor_condenacao), 0))
          / NULLIF(SUM(valor_acao), 0) * 100,
        0
      ), 2
    )
  FROM sp_decisoes_processuais
  WHERE EXTRACT(YEAR FROM data_decisao)::integer = p_ano;
$$;

-- ============================================================
-- Última atualização por fonte (para o cabeçalho "atualizado em")
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_ultima_atualizacao()
RETURNS TABLE (
  fonte text,
  executado_em timestamptz,
  upserted integer,
  deleted integer,
  errors integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (fonte)
    fonte, executado_em, upserted, deleted, errors
  FROM sharepoint_sync_log
  ORDER BY fonte, executado_em DESC;
$$;

-- ============================================================
-- Comentários e grants
-- ============================================================
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) IS
  'SLA de Vistagem D+1 mensal (sp_publicacoes), filtrável por demanda de risco e área.';
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_por_usuario(integer, integer, boolean) IS
  'Ranking de SLA de Vistagem D+1 por usuário vistador.';
COMMENT ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer) IS
  'SLA de Protocolo mensal (sp_tarefas_historico / "Nova"): D-1 vs FATAL, com meta vigente no período.';
COMMENT ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer) IS
  'Ranking de FATAL não-excludente por usuário (SLA de Protocolo).';
COMMENT ON FUNCTION public.eficiencia_protocolo_mensal(integer) IS
  'Eficiência de Protocolo mensal (sp_protocolos): % sem inconsistência jurídica.';
COMMENT ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer) IS
  'Ranking de inconsistência jurídica por usuário (Eficiência de Protocolo).';
COMMENT ON FUNCTION public.eficiencia_agendamento_mensal(integer) IS
  'Agendamento/Ciência D+1 mensal (sp_tarefas).';
COMMENT ON FUNCTION public.eficiencia_agendamento_por_usuario(integer, integer) IS
  'Ranking de Agendamento/Ciência D+1 por usuário.';
COMMENT ON FUNCTION public.eficiencia_turnover_anual(integer) IS
  'Turnover anual: funcionários ativos, saídas voluntárias, % retenção e meta máxima (15%).';
COMMENT ON FUNCTION public.eficiencia_turnover_desligamentos(integer) IS
  'Lista de desligamentos do ano com tempo de casa.';
COMMENT ON FUNCTION public.eficiencia_turnover_top5_tempo_casa(integer) IS
  'Top 5 colaboradores ativos por tempo de casa no ano de referência.';
COMMENT ON FUNCTION public.eficiencia_treinamentos_anual(integer) IS
  'Atingimento anual de treinamentos: minutos lançados vs meta (14h/pessoa ativa).';
COMMENT ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer) IS
  'Minutos/horas de treinamento lançados por colaborador no ano.';
COMMENT ON FUNCTION public.eficiencia_beneficio_economico_anual(integer) IS
  'Benefício econômico anual (valor da ação - valor da condenação) das decisões processuais.';
COMMENT ON FUNCTION public.eficiencia_ultima_atualizacao() IS
  'Última execução de sync por fonte SharePoint, para exibir "atualizado em" no painel.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_por_usuario(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_por_usuario(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_anual(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_desligamentos(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_top5_tempo_casa(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_anual(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_por_pessoa(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_beneficio_economico_anual(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ultima_atualizacao() TO anon, authenticated;
