-- Grupos com títulos vencidos há mais de 60 dias (fora do painel de seguimento 1–60d).
-- Usado para alertar cadastro no Comitê de Inadimplência.

CREATE OR REPLACE FUNCTION public.cobranca_seguimento_titulos_acima_60_base()
RETURNS TABLE (
  parcela_id uuid,
  pessoa_id uuid,
  cliente text,
  pessoa_nome text,
  grupo_chave text,
  nro_titulo text,
  parcela text,
  parcelas text,
  descricao text,
  plano_contas text,
  data_vencimento date,
  valor numeric,
  dias_atraso integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fp.id AS parcela_id,
    fp.pessoa_id,
    fp.cliente,
    p.nome AS pessoa_nome,
    public.receita_inadimplencia_chave_grupo(
      public.receita_grupo_cliente_canonico(fp.cliente, fp.pessoa_id),
      fp.cliente
    ) AS grupo_chave,
    fp.nro_titulo,
    fp.parcela,
    fp.parcelas,
    fp.descricao,
    fp.plano_contas,
    fp.data_vencimento,
    fp.valor,
    (CURRENT_DATE - fp.data_vencimento)::integer AS dias_atraso
  FROM public.financeiro_parcelas fp
  LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
  WHERE fp.situacao = 'ABERTO'
    AND public.financeiro_titulo_eh_receber(fp.tipo)
    AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
    AND fp.data_vencimento < CURRENT_DATE
    AND (CURRENT_DATE - fp.data_vencimento) > 60;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_titulos_acima_60_base() IS
  'Títulos a receber em aberto com mais de 60 dias de atraso (escalonamento ao Comitê de Inadimplência).';

CREATE OR REPLACE FUNCTION public.cobranca_seguimento_grupos_acima_60()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH titulos AS (
    SELECT * FROM public.cobranca_seguimento_titulos_acima_60_base()
  ),
  grupos AS (
    SELECT
      t.grupo_chave,
      count(*)::integer AS qtd_titulos,
      coalesce(sum(t.valor), 0) AS valor_total,
      max(t.dias_atraso)::integer AS max_dias_atraso,
      count(DISTINCT coalesce(t.pessoa_nome, t.cliente))::integer AS qtd_razoes
    FROM titulos t
    GROUP BY t.grupo_chave
  ),
  kpis AS (
    SELECT
      count(*)::integer AS qtd_grupos,
      coalesce(sum(qtd_titulos), 0)::integer AS qtd_titulos,
      coalesce(sum(valor_total), 0) AS valor_total
    FROM grupos
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(k.*) FROM kpis k),
    'grupos', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'grupo_chave', g.grupo_chave,
            'qtd_titulos', g.qtd_titulos,
            'valor_total', g.valor_total,
            'max_dias_atraso', g.max_dias_atraso,
            'qtd_razoes', g.qtd_razoes
          )
          ORDER BY g.max_dias_atraso DESC, g.valor_total DESC
        )
        FROM grupos g
      ),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.cobranca_seguimento_grupos_acima_60() IS
  'Grupos com títulos vencidos há mais de 60 dias — candidatos ao Comitê de Inadimplência.';

GRANT EXECUTE ON FUNCTION public.cobranca_seguimento_titulos_acima_60_base() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_seguimento_grupos_acima_60() TO authenticated;
