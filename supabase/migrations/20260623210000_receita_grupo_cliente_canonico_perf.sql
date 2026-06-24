-- Corrige timeout: grupo canônico via lookup (JOIN) em vez de função por linha na view.

CREATE OR REPLACE VIEW public.receita_grupo_por_nome_cliente AS
SELECT DISTINCT ON (lower(trim(p.nome)))
  lower(trim(p.nome)) AS cliente_norm,
  NULLIF(trim(p.grupo_cliente), '') AS grupo_cliente
FROM public.pessoas p
WHERE NULLIF(trim(p.nome), '') IS NOT NULL
  AND NULLIF(trim(p.grupo_cliente), '') IS NOT NULL
ORDER BY
  lower(trim(p.nome)),
  CASE
    WHEN lower(trim(COALESCE(p.categoria, ''))) LIKE '%prospec%' THEN 90
    WHEN lower(trim(COALESCE(p.categoria, ''))) = 'cliente ativo' THEN 1
    WHEN lower(trim(COALESCE(p.categoria, ''))) = 'cliente inativo' THEN 2
    WHEN lower(trim(COALESCE(p.categoria, ''))) LIKE '%ex-cliente%' THEN 3
    ELSE 10
  END,
  NULLIF(trim(p.grupo_cliente), '');

COMMENT ON VIEW public.receita_grupo_por_nome_cliente IS
  'Melhor grupo_cliente por nome (prioriza Cliente ativo sobre Prospecção).';

CREATE OR REPLACE FUNCTION public.receita_grupo_cliente_canonico(
  p_cliente text,
  p_pessoa_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT g.grupo_cliente
      FROM public.receita_grupo_por_nome_cliente g
      WHERE g.cliente_norm = lower(trim(COALESCE(p_cliente, '')))
    ),
    (
      SELECT NULLIF(trim(p.grupo_cliente), '')
      FROM public.pessoas p
      WHERE p_pessoa_id IS NOT NULL AND p.id = p_pessoa_id
    ),
    'Sem grupo'
  );
$$;

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
  COALESCE(
    gc.grupo_cliente,
    NULLIF(trim(p.grupo_cliente), ''),
    'Sem grupo'
  ) AS grupo_cliente,
  p.categoria
FROM public.financeiro_parcelas_itens i
INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
LEFT JOIN public.receita_grupo_por_nome_cliente gc
  ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
  AND public.plano_contas_na_cota(i.plano_contas);

COMMENT ON VIEW public.receita_itens_inadimplencia_elegiveis IS
  'Base da inadimplência na Receita: planos da cota; grupo_cliente canônico via lookup.';

GRANT SELECT ON public.receita_grupo_por_nome_cliente TO anon, authenticated;
