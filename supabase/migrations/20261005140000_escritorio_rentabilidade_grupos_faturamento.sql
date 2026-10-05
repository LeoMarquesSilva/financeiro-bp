-- Grupos com faturamento (valor_item, vencimento) no intervalo — filtro da cópia para apresentação.

CREATE OR REPLACE FUNCTION public.escritorio_rentabilidade_grupos_com_faturamento(
  p_data_inicio date,
  p_data_fim date,
  p_area text DEFAULT NULL
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT g.chave ORDER BY g.chave),
    '{}'::text[]
  )
  FROM (
    SELECT
      public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente) AS chave
    FROM public.receita_itens_inadimplencia_base b
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
    WHERE i.data_vencimento IS NOT NULL
      AND i.data_vencimento BETWEEN p_data_inicio AND p_data_fim
      AND COALESCE(i.valor_item, 0) > 0
      AND public.escritorio_levantamento_area_match(
        NULLIF(trim(COALESCE(p_area, '')), ''),
        i.departamento
      )
      AND NULLIF(trim(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)), '') IS NOT NULL
    GROUP BY 1
    HAVING SUM(i.valor_item) > 0
  ) g;
$$;

COMMENT ON FUNCTION public.escritorio_rentabilidade_grupos_com_faturamento(date, date, text) IS
  'Chaves de grupo cliente com faturamento (vencimento no intervalo). Usado na cópia do ranking de rentabilidade.';

GRANT EXECUTE ON FUNCTION public.escritorio_rentabilidade_grupos_com_faturamento(date, date, text)
  TO anon, authenticated;
