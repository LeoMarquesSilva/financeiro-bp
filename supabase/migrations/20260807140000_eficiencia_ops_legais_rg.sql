-- Operações Legais (RG) — RPCs isoladas para validação do BI
-- "DASHBOARD - EFICIÊNCIA OPERACIONAL - OPERAÇÕES LEGAIS".
-- Não alteram as funções do consolidado (que excluam Ops Legais da população).

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_protocolo_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_sem_inconsistencia numeric,
  eficiencia_ok integer,
  eficiencia_nok integer,
  pct_eficiencia_operacional numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::integer AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_sem_inconsistencia,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
    )::integer AS eficiencia_ok,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO')
    )::integer AS eficiencia_nok,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
        )::numeric
          / NULLIF(
              COUNT(*) FILTER (
                WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('SIM', 'NÃO', 'NAO')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia_operacional
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND area = 'Operações Legais'
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_protocolo_ranking(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_inconsistencia integer,
  qtd_eficiencia_nok integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(protocolado_por), ''), NULLIF(TRIM(nome_limpo), ''), 'Sem responsável') AS usuario,
      status_inconsistencia,
      eficiencia_operacional
    FROM sp_protocolos
    WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND area = 'Operações Legais'
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
  ),
  agreg AS (
    SELECT
      usuario,
      COUNT(*) FILTER (WHERE status_inconsistencia = 'INCONSISTÊNCIA')::integer AS qtd_inconsistencia,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO')
      )::integer AS qtd_eficiencia_nok
    FROM base
    GROUP BY 1
  ),
  total AS (
    SELECT NULLIF(SUM(qtd_inconsistencia + qtd_eficiencia_nok), 0)::numeric AS v FROM agreg
  )
  SELECT
    a.usuario,
    a.qtd_inconsistencia,
    a.qtd_eficiencia_nok,
    ROUND(
      COALESCE((a.qtd_inconsistencia + a.qtd_eficiencia_nok)::numeric / (SELECT v FROM total) * 100, 0),
      2
    ) AS pct_do_total
  FROM agreg a
  WHERE a.qtd_inconsistencia > 0 OR a.qtd_eficiencia_nok > 0
  ORDER BY (a.qtd_inconsistencia + a.qtd_eficiencia_nok) DESC, a.usuario;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_agendamento_mensal(p_ano integer)
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
  SELECT
    EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_sem18_d1 ILIKE 'dentro do prazo'
                   OR fatal_sem18_d1 ILIKE 'fora do prazo'
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
    AND area_conclusao = 'Operações Legais'
    AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_agendamento_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
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
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = ANY (p_meses))
      AND area_conclusao = 'Operações Legais'
      AND usuario_conclusao IS NOT NULL
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  ),
  total AS (
    SELECT COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::numeric AS v FROM base
  )
  SELECT
    usuario_conclusao AS usuario,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::numeric
          / NULLIF((SELECT v FROM total), 0) * 100,
        0
      ),
      2
    ) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY fora_prazo DESC, usuario;
$$;

-- Cadastro / Abertura / Encerramento (página CADASTRO do BI Ops Legais)
CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_mensal(p_ano integer)
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
  SELECT
    EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_sem18_d1 ILIKE 'dentro do prazo'
                   OR fatal_sem18_d1 ILIKE 'fora do prazo'
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
    AND area_conclusao = 'Operações Legais'
    AND tarefa IN (
      'CADASTRO DE PASTA',
      'CADASTRO DE CLIENTE',
      'ATUALIZAÇÃO DE CADASTRO',
      'CIÊNCIA DA ABERTURA DE PASTA',
      'VERIFICAR ENCERRAMENTO DA PASTA'
    )
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
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
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = ANY (p_meses))
      AND area_conclusao = 'Operações Legais'
      AND usuario_conclusao IS NOT NULL
      AND tarefa IN (
        'CADASTRO DE PASTA',
        'CADASTRO DE CLIENTE',
        'ATUALIZAÇÃO DE CADASTRO',
        'CIÊNCIA DA ABERTURA DE PASTA',
        'VERIFICAR ENCERRAMENTO DA PASTA'
      )
  ),
  total AS (
    SELECT COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::numeric AS v FROM base
  )
  SELECT
    usuario_conclusao AS usuario,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::numeric
          / NULLIF((SELECT v FROM total), 0) * 100,
        0
      ),
      2
    ) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY fora_prazo DESC, usuario;
$$;

-- SLA Publicações: população Ops Legais (no consolidado a área fica de fora).
-- Campo EFICIÊNCIA da lista está vazio no sync — usamos Vistagem D+1 quando há vistado_por
-- (proxy até fechar DAX de KPI_HTML_AGENDAPUB / ANALISEPUB).
CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_publicacoes_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total integer,
  com_vistador integer,
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
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(vistado_por), '') IS NOT NULL)::integer AS com_vistador,
    COUNT(*) FILTER (
      WHERE NULLIF(TRIM(vistado_por), '') IS NOT NULL
        AND vistado_d1 = 'Sim'
    )::integer AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (
          WHERE NULLIF(TRIM(vistado_por), '') IS NOT NULL
            AND vistado_d1 = 'Sim'
        )::numeric
          / NULLIF(
              COUNT(*) FILTER (WHERE NULLIF(TRIM(vistado_por), '') IS NOT NULL),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_d1
  FROM sp_publicacoes
  WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
    AND area = 'Operações Legais'
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_publicacoes_por_tipo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  tipo_agendamento text,
  qtd integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(
          TRIM(BOTH FROM regexp_replace(COALESCE(tipo_agendamento, ''), '[\[\]"]', '', 'g')),
          ''
        ),
        'Sem tipo'
      ) AS tipo_agendamento
    FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND area = 'Operações Legais'
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = ANY (p_meses))
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    tipo_agendamento,
    COUNT(*)::integer AS qtd,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) IS
  'RG Ops Legais: eficiência protocolo (sem inconsistência) + eficiência operacional (SIM/NÃO).';
COMMENT ON FUNCTION public.eficiencia_ops_legais_agendamento_mensal(integer) IS
  'RG Ops Legais: Ciência dos Agendamentos D+1 filtrando area_conclusao = Operações Legais.';
COMMENT ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer) IS
  'RG Ops Legais: cadastro/abertura/encerramento (tarefas do BI CADASTRO) D+1.';
COMMENT ON FUNCTION public.eficiencia_ops_legais_publicacoes_mensal(integer) IS
  'RG Ops Legais: publicações da área; % D+1 quando há vistado_por (proxy Agenda/Análise PUB).';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_protocolo_ranking(integer, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_agendamento_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_agendamento_por_usuario(integer, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(integer, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_publicacoes_mensal(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_publicacoes_por_tipo(integer, integer[]) TO anon, authenticated;
