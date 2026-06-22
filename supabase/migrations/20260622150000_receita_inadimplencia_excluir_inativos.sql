-- Inadimplência na Receita: desconsidera clientes/grupos com categoria 'Cliente inativo'.

CREATE OR REPLACE FUNCTION public.receita_pessoa_categoria_inativa(categoria text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(categoria), '') = 'Cliente inativo';
$$;

COMMENT ON FUNCTION public.receita_pessoa_categoria_inativa(text) IS
  'Mesmo critério do Escritório (valor_em_atraso_ativos): categoria Cliente inativo.';

-- Retorna false se o item pertence a pessoa/grupo inativo; true se ativo ou sem vínculo.
CREATE OR REPLACE FUNCTION public.receita_item_cliente_ativo(i public.financeiro_parcelas_itens)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Título vinculado a pessoa inativa
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN pessoas p ON p.id = fp.pessoa_id
      WHERE fp.ci_titulo = i.ci_titulo
        AND public.receita_pessoa_categoria_inativa(p.categoria)
    ) THEN false
    -- Grupo inteiro inativo (todas as empresas do grupo_cliente)
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN pessoas p ON p.id = fp.pessoa_id
      WHERE fp.ci_titulo = i.ci_titulo
        AND p.grupo_cliente IS NOT NULL
        AND trim(p.grupo_cliente) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM pessoas p2
          WHERE p2.grupo_cliente = p.grupo_cliente
            AND NOT public.receita_pessoa_categoria_inativa(p2.categoria)
        )
    ) THEN false
    -- Sem pessoa no título: tenta casar pelo nome do cliente no item
    WHEN NOT EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      WHERE fp.ci_titulo = i.ci_titulo
        AND fp.pessoa_id IS NOT NULL
    )
    AND trim(coalesce(i.cliente, '')) <> ''
    AND EXISTS (
      SELECT 1
      FROM pessoas p
      WHERE upper(trim(p.nome)) = upper(trim(i.cliente))
        AND public.receita_pessoa_categoria_inativa(p.categoria)
    ) THEN false
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.receita_itens_cota_filtrados()
RETURNS SETOF public.financeiro_parcelas_itens
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_valor_inadimplencia(i) > 0
    AND public.receita_item_cliente_ativo(i);
$$;

COMMENT ON FUNCTION public.receita_item_cliente_ativo(public.financeiro_parcelas_itens) IS
  'Exclui itens de pessoas ou grupos (grupo_cliente) com categoria Cliente inativo.';

GRANT EXECUTE ON FUNCTION public.receita_pessoa_categoria_inativa(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_cliente_ativo(public.financeiro_parcelas_itens) TO anon, authenticated;
