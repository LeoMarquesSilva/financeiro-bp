-- Corrige SLA Vistagem mensal: a migração 20260805180000 passou a exigir
-- vistado_por IS NOT NULL na série do Overview, mas a grande maioria das
-- publicações tem vistado_por nulo (mesmo com vistado_d1 preenchido).
-- Ranking por usuário mantém o filtro — lá o usuário é obrigatório.

DROP FUNCTION IF EXISTS public.eficiencia_sla_vistagem_mensal(integer, boolean, text);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,
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
    AND (p_area IS NULL OR area = p_area)
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND demanda_risco IS DISTINCT FROM 'Não'
        AND (p_area IS NOT NULL OR area IS NULL OR area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          p_area IS NOT NULL
          OR area IS NULL
          OR area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
        )
      )
    )
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) IS
  'SLA Vistagem D+1 mensal (Overview). Não filtra por vistado_por — ranking por usuário exige.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) TO anon, authenticated;
