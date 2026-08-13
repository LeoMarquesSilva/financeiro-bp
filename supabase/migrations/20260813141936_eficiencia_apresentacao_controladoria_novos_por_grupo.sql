-- Novos Clientes Controladoria: 1º Cliente ativo por grupo_cliente

CREATE OR REPLACE FUNCTION public.eficiencia_apresentacao_controladoria(p_ano integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  WITH
  meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  pub AS (
    SELECT
      EXTRACT(MONTH FROM data_recebimento_kurier)::integer AS mes,
      COUNT(*)::integer AS qtd
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = p_ano
    GROUP BY 1
  ),
  pastas AS (
    SELECT
      EXTRACT(MONTH FROM data_cadastro)::integer AS mes,
      COUNT(*)::integer AS qtd
    FROM processos_completo
    WHERE data_cadastro IS NOT NULL
      AND EXTRACT(YEAR FROM data_cadastro)::integer = p_ano
    GROUP BY 1
  ),
  prot AS (
    SELECT
      EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
      COUNT(*)::integer AS qtd
    FROM sp_protocolos
    WHERE protocolado_em IS NOT NULL
      AND NULLIF(trim(protocolado_por), '') IS NOT NULL
      AND EXTRACT(YEAR FROM protocolado_em)::integer = p_ano
    GROUP BY 1
  ),
  novos_base AS (
    SELECT
      lower(trim(grupo_cliente)) AS chave,
      data_cadastro
    FROM pessoas
    WHERE data_cadastro IS NOT NULL
      AND NULLIF(trim(grupo_cliente), '') IS NOT NULL
      AND trim(categoria) = 'Cliente ativo'
  ),
  novos_primeiro AS (
    SELECT DISTINCT ON (chave)
      chave,
      data_cadastro
    FROM novos_base
    ORDER BY chave, data_cadastro ASC
  ),
  novos AS (
    SELECT
      EXTRACT(MONTH FROM data_cadastro)::integer AS mes,
      COUNT(*)::integer AS qtd
    FROM novos_primeiro
    WHERE EXTRACT(YEAR FROM data_cadastro)::integer = p_ano
    GROUP BY 1
  ),
  serie AS (
    SELECT
      m.mes,
      COALESCE(pub.qtd, 0) AS publicacoes,
      COALESCE(pastas.qtd, 0) AS pastas_cadastradas,
      COALESCE(prot.qtd, 0) AS protocolos,
      COALESCE(novos.qtd, 0) AS novos_clientes
    FROM meses m
    LEFT JOIN pub ON pub.mes = m.mes
    LEFT JOIN pastas ON pastas.mes = m.mes
    LEFT JOIN prot ON prot.mes = m.mes
    LEFT JOIN novos ON novos.mes = m.mes
  )
  SELECT jsonb_build_object(
    'ano', p_ano,
    'mensal', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'mes', mes,
            'publicacoes', publicacoes,
            'pastas_cadastradas', pastas_cadastradas,
            'protocolos', protocolos,
            'novos_clientes', novos_clientes
          )
          ORDER BY mes
        )
        FROM serie
      ),
      '[]'::jsonb
    ),
    'totais', jsonb_build_object(
      'publicacoes', (SELECT COALESCE(SUM(publicacoes), 0)::integer FROM serie),
      'pastas_cadastradas', (SELECT COALESCE(SUM(pastas_cadastradas), 0)::integer FROM serie),
      'protocolos', (SELECT COALESCE(SUM(protocolos), 0)::integer FROM serie),
      'novos_clientes', (SELECT COALESCE(SUM(novos_clientes), 0)::integer FROM serie)
    )
  );
$$;

COMMENT ON FUNCTION public.eficiencia_apresentacao_controladoria(integer) IS
  'Apresentação — Big Numbers Controladoria: pub, pastas, protocolos, novos clientes (1º Cliente ativo por grupo).';

GRANT EXECUTE ON FUNCTION public.eficiencia_apresentacao_controladoria(integer) TO anon, authenticated;
