-- Filtro nativo do BI para SLA Ciência Agendamentos (tabela "Tarefas" / sp_tarefas):
--   Área (na conclusão) não é Tributário; Tarefa é '1. CIÊNCIA DOS AGENDAMENTOS'.

DROP FUNCTION IF EXISTS public.eficiencia_agendamento_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_agendamento_por_usuario(integer, integer);

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(p_ano integer, p_area text DEFAULT NULL)
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
    AND (p_area IS NULL OR area_conclusao = p_area)
    AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
    AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
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
      AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
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

COMMENT ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) IS
  'Agendamento/Ciência D+1 mensal (sp_tarefas). Réplica dos filtros nativos do BI: exclui área Tributário, só tarefa "1. CIÊNCIA DOS AGENDAMENTOS".';

GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_por_usuario(integer, integer) TO anon, authenticated;
