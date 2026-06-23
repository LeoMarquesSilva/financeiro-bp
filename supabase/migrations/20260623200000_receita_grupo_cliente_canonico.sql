-- Resolve grupo_cliente na Receita quando há cadastros duplicados no VIOS (mesmo nome, categorias diferentes).
-- Ex.: Weslley Michael Ferreira — título ligado a "Prospecção / Grupo prospect", mas cliente ativo em "Grupo Weslley Michael".

CREATE OR REPLACE FUNCTION public.receita_grupo_cliente_canonico(
  p_cliente text,
  p_pessoa_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  WITH norm AS (
    SELECT lower(trim(COALESCE(p_cliente, ''))) AS nome
  ),
  candidatos AS (
    SELECT
      NULLIF(trim(p.grupo_cliente), '') AS grupo_cliente,
      CASE
        WHEN lower(trim(COALESCE(p.categoria, ''))) LIKE '%prospec%' THEN 90
        WHEN lower(trim(COALESCE(p.categoria, ''))) = 'cliente ativo' THEN 1
        WHEN lower(trim(COALESCE(p.categoria, ''))) = 'cliente inativo' THEN 2
        WHEN lower(trim(COALESCE(p.categoria, ''))) LIKE '%ex-cliente%' THEN 3
        ELSE 10
      END AS prioridade
    FROM public.pessoas p
    CROSS JOIN norm n
    WHERE n.nome <> ''
      AND lower(trim(p.nome)) = n.nome
      AND NULLIF(trim(p.grupo_cliente), '') IS NOT NULL
  ),
  melhor AS (
    SELECT c.grupo_cliente
    FROM candidatos c
    ORDER BY c.prioridade, c.grupo_cliente
    LIMIT 1
  ),
  titulo AS (
    SELECT NULLIF(trim(p.grupo_cliente), '') AS grupo_cliente
    FROM public.pessoas p
    WHERE p_pessoa_id IS NOT NULL AND p.id = p_pessoa_id
  )
  SELECT COALESCE(
    (SELECT grupo_cliente FROM melhor),
    (SELECT grupo_cliente FROM titulo),
    'Sem grupo'
  );
$$;

COMMENT ON FUNCTION public.receita_grupo_cliente_canonico(text, uuid) IS
  'Grupo canônico por nome do cliente: prioriza Cliente ativo sobre Prospecção quando há duplicatas no cadastro VIOS.';

CREATE OR REPLACE VIEW public.receita_itens_inadimplencia_elegiveis AS
SELECT
  i.id,
  i.ci_item,
  i.ci_titulo,
  i.cliente,
  i.plano_contas,
  i.tipo,
  i.valor_item,
  i.valor_parcial_aberto,
  i.valor_pago_item,
  i.situacao_titulo,
  i.data_vencimento,
  i.data_pagamento,
  fp.pessoa_id,
  public.receita_grupo_cliente_canonico(i.cliente, fp.pessoa_id) AS grupo_cliente,
  p.categoria
FROM public.financeiro_parcelas_itens i
INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
  AND public.plano_contas_na_cota(i.plano_contas);

COMMENT ON VIEW public.receita_itens_inadimplencia_elegiveis IS
  'Base da inadimplência na Receita: planos da cota; grupo_cliente canônico (evita prospecção duplicada).';
