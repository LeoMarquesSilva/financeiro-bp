-- Ops Legais RG = espelho do BI "OPERAÇÕES LEGAIS".
-- Páginas SLA PROTOCOLOS / PUBLICAÇÕES / TAREFAS / CADASTRO / TREINAMENTOS
-- não pré-filtram por área — população completa (só datas / status / tipo de tarefa).

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

COMMENT ON FUNCTION public.eficiencia_ops_legais_agendamento_mensal(integer) IS
  'BI Ops Legais / TAREFAS: Ciência dos Agendamentos — sem filtro de área.';
COMMENT ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer) IS
  'BI Ops Legais / CADASTRO — sem filtro de área.';
COMMENT ON FUNCTION public.eficiencia_ops_legais_publicacoes_mensal(integer) IS
  'BI Ops Legais / SLA PUBLICAÇÕES — sem filtro de área.';
