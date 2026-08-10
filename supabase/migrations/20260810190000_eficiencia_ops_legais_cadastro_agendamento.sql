-- BI Ops Legais / CADASTRO — % Eficiência Cadastro Processos
-- Fonte: sp_agendamento (lista SOLICITAÇÃO DE AGENDAMENTOS = entidade Agendamento)
-- % = 1 - (INCONSISTÊNCIA / (OK + INCONSISTÊNCIA))
-- DePara no SIOE: 'Eficiência'/'OK' = conformidade · 'Inconsistência' = inconsistência
-- População: controladoria ativa (Isadora, Maria Júlia, Marina, Natália)

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_controladoria()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'Isadora Godoy Conte',
    'Maria Julia Pereira',
    'Marina Silva Pinelli',
    'Natalia Borges Breve'
  ]::text[];
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
  WITH base AS (
    SELECT
      EXTRACT(MONTH FROM solicitado_em)::integer AS mes,
      CASE
        WHEN de_para ILIKE '%inconsist%' THEN 'inconsistencia'
        ELSE 'ok'
      END AS status_cad
    FROM sp_agendamento
    WHERE solicitado_em IS NOT NULL
      AND EXTRACT(YEAR FROM solicitado_em)::integer = p_ano
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(public.eficiencia_ops_legais_cadastro_controladoria()) AS n(nome)
        WHERE agendado_por ILIKE n.nome || '%'
      )
  )
  SELECT
    mes,
    COUNT(*) FILTER (WHERE status_cad = 'ok')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE status_cad = 'inconsistencia')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_cad = 'ok')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_dentro_prazo
  FROM base
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer) IS
  'BI Ops Legais / Eficiência Cadastro: % OK (sem inconsistência) em sp_agendamento · controladoria ativa.';

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
    SELECT
      TRIM(agendado_por) AS usuario,
      CASE
        WHEN de_para ILIKE '%inconsist%' THEN 'inconsistencia'
        ELSE 'ok'
      END AS status_cad
    FROM sp_agendamento
    WHERE solicitado_em IS NOT NULL
      AND EXTRACT(YEAR FROM solicitado_em)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM solicitado_em)::integer = ANY (p_meses))
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(public.eficiencia_ops_legais_cadastro_controladoria()) AS n(nome)
        WHERE agendado_por ILIKE n.nome || '%'
      )
  ),
  agg AS (
    SELECT
      usuario,
      COUNT(*) FILTER (WHERE status_cad = 'ok')::integer AS dentro_prazo,
      COUNT(*) FILTER (WHERE status_cad = 'inconsistencia')::integer AS fora_prazo
    FROM base
    GROUP BY 1
  ),
  tot AS (
    SELECT COALESCE(SUM(fora_prazo), 0)::numeric AS total_inconsist FROM agg
  )
  SELECT
    a.usuario,
    a.dentro_prazo,
    a.fora_prazo,
    ROUND(
      COALESCE(a.fora_prazo::numeric / NULLIF(t.total_inconsist, 0) * 100, 0),
      2
    ) AS pct_do_total
  FROM agg a
  CROSS JOIN tot t
  ORDER BY a.fora_prazo DESC, a.usuario;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(integer, integer[]) IS
  'BI Ops Legais / Cadastro: inconsistências por Agendado por (controladoria ativa).';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_controladoria()
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(integer, integer[])
  TO anon, authenticated;
