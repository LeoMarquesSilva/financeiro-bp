-- BI Ops Legais / FATURAMENTO HONORÁRIOS — % Antecipação Honorários
-- Fonte: sp_tarefas (tarefa REALIZAR FATURAMENTO) ≡ AntecipacaoHonorarios
-- Status Antecipação:
--   Pendente          → data_conclusao IS NULL
--   ✅ Dentro do prazo → data_conclusao <= data_limite
--   Fora do prazo     → demais concluídos
-- % = DentroDoPrazo / TotalFaturavel
-- TotalFaturavel = data_para_conclusao NOT NULL AND Status <> Pendente

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_antecipacao_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total_faturavel integer,
  qtd_dentro_prazo integer,
  qtd_fora_prazo integer,
  pct_antecipacao numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
      CASE
        WHEN data_limite IS NOT NULL AND data_conclusao <= data_limite
          THEN 'dentro'
        ELSE 'fora'
      END AS status_antecip
    FROM sp_tarefas
    WHERE tarefa = 'REALIZAR FATURAMENTO'
      AND data_conclusao IS NOT NULL
      AND data_para_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
  )
  SELECT
    mes,
    COUNT(*)::integer AS total_faturavel,
    COUNT(*) FILTER (WHERE status_antecip = 'dentro')::integer AS qtd_dentro_prazo,
    COUNT(*) FILTER (WHERE status_antecip = 'fora')::integer AS qtd_fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_antecip = 'dentro')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_antecipacao
  FROM base
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_antecipacao_mensal(integer) IS
  'BI Ops Legais / Antecipação Honorários: % dentro do prazo (REALIZAR FATURAMENTO) por mês de conclusão.';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_antecipacao_mensal(integer)
  TO anon, authenticated;
