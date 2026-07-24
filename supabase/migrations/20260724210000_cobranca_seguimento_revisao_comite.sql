-- Revisão comitê: grupos >60d com lista de títulos para inclusão no Comitê de Inadimplência.

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
      count(DISTINCT coalesce(t.pessoa_nome, t.cliente))::integer AS qtd_razoes,
      (array_agg(t.pessoa_id ORDER BY t.dias_atraso DESC, t.valor DESC))[1] AS pessoa_id_principal,
      jsonb_agg(
        jsonb_build_object(
          'parcela_id', t.parcela_id,
          'cliente', t.cliente,
          'pessoa_nome', t.pessoa_nome,
          'nro_titulo', t.nro_titulo,
          'parcela', t.parcela,
          'data_vencimento', t.data_vencimento,
          'valor', t.valor,
          'dias_atraso', t.dias_atraso
        )
        ORDER BY t.dias_atraso DESC, t.data_vencimento
      ) AS titulos
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
            'qtd_razoes', g.qtd_razoes,
            'pessoa_id_principal', g.pessoa_id_principal,
            'titulos', g.titulos
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
  'Grupos com títulos >60 dias, incluindo lista de títulos para revisão e inclusão no Comitê.';
