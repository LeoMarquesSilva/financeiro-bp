-- Módulo DL (Distribuição de Lucros por área), calculado direto do SIOE (financeiro_parcelas_itens).
-- Regras reproduzidas do fechamento oficial (Resultado DL 2026_V2.xlsx), base caixa (data de pagamento):
--   Receita bruta    = honorários recebidos pelo departamento do item
--   Impostos         = 16,0587% do recebido quando o título tem NFS-e (número)
--   Desp. operac.    = pagamentos do departamento, exceto repasses, investimentos e impostos s/ faturamento
--   Desp. Controlad. = pagamentos de Operações Legais × % de agendamentos da área (parâmetro)
--   Desp. indiretas  = (Facilities, Financeiro, Marketing, R.H., T.I., Comercial + parcela fixa dos sócios)
--                      ÷ profissionais do escritório × profissionais da área (parâmetro)
-- Parâmetros de um mês sem cadastro herdam o último mês cadastrado do mesmo ano.

CREATE TABLE IF NOT EXISTS public.dl_areas (
  area_key text PRIMARY KEY,
  nome text NOT NULL,
  departamento text NOT NULL UNIQUE,
  referencia_mercado numeric(6, 4),
  ordem integer NOT NULL
);

INSERT INTO public.dl_areas (area_key, nome, departamento, referencia_mercado, ordem) VALUES
  ('civel', 'Cível', 'Cível', 0.57, 1),
  ('insolvencia', 'Insolvência', 'Insolvência', 0.58, 2),
  ('contratos', 'Contratos', 'Contratos', 0.80, 3),
  ('add', 'ADD (Distressed Deals)', 'Distressed Deals', 0.75, 4),
  ('rec_credito', 'Recuperação de Crédito', 'Recuperação de Crédito', 0.58, 5),
  ('trabalhista', 'Trabalhista', 'Trabalhista', 0.47, 6),
  ('tributario', 'Tributário', 'Tributário', 0.68, 7)
ON CONFLICT (area_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dl_parametros_mensais (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area_key text NOT NULL REFERENCES public.dl_areas (area_key),
  profissionais numeric(6, 2) NOT NULL DEFAULT 0 CHECK (profissionais >= 0),
  pct_controladoria numeric(7, 4) NOT NULL DEFAULT 0 CHECK (pct_controladoria >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (ano, mes, area_key)
);

CREATE TABLE IF NOT EXISTS public.dl_parametros_gerais (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  socios_parcela_fixa numeric(15, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS public.dl_gestores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  area_key text NOT NULL REFERENCES public.dl_areas (area_key),
  nome text NOT NULL,
  pct numeric(6, 3) NOT NULL CHECK (pct >= 0 AND pct <= 100),
  mes_inicio integer NOT NULL DEFAULT 1 CHECK (mes_inicio BETWEEN 1 AND 12),
  mes_fim integer NOT NULL DEFAULT 12 CHECK (mes_fim BETWEEN 1 AND 12),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mes_inicio <= mes_fim)
);

ALTER TABLE public.dl_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_parametros_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_parametros_gerais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_gestores ENABLE ROW LEVEL SECURITY;

-- DL envolve remuneração de sócios e gestores: leitura e escrita só para admin.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dl_areas', 'dl_parametros_mensais', 'dl_parametros_gerais', 'dl_gestores'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())',
      t || '_admin', t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.dl_resultado_mensal(p_ano integer)
RETURNS TABLE(
  area_key text,
  mes integer,
  receita_bruta numeric,
  impostos numeric,
  desp_operacionais numeric,
  desp_controladoria numeric,
  desp_indiretas numeric,
  profissionais numeric,
  pct_controladoria numeric,
  parametro_herdado boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  itens AS (
    SELECT i.*, extract(month FROM i.data_pagamento)::integer AS m
    FROM financeiro_parcelas_itens i
    WHERE i.data_pagamento >= make_date(p_ano, 1, 1)
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
  ),
  rec AS (
    SELECT a.area_key, i.m,
      sum(i.valor_pago_item) AS bruto,
      sum(i.valor_pago_item * CASE WHEN trim(i.nfse_titulo) ~ '^[0-9]+$' THEN 0.160587 ELSE 0 END) AS imposto
    FROM itens i
    JOIN dl_areas a ON a.departamento = i.departamento
    WHERE i.tipo = 'RECEBER'
      AND i.plano_contas IN (
        'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
        'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
        'HONORÁRIOS POR HORA TRABALHADA'
      )
    GROUP BY 1, 2
  ),
  pag AS (
    SELECT i.departamento, i.m, abs(coalesce(i.valor_pago_item, 0)) AS v
    FROM itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND public.opex_norm_grupo(i.grupo_conta) NOT IN ('OUTRAS RECEITAS OPERACIONAIS', 'INVESTIMENTOS')
      AND coalesce(i.conta_numero, '') NOT LIKE '5.14.03%'
      AND coalesce(i.conta_numero, '') NOT LIKE '3.3.%'
  ),
  desp_area AS (
    SELECT a.area_key, p.m, sum(p.v) AS v
    FROM pag p JOIN dl_areas a ON a.departamento = p.departamento
    GROUP BY 1, 2
  ),
  ctrl AS (
    SELECT p.m, sum(p.v) AS v FROM pag p WHERE p.departamento = 'Operações Legais' GROUP BY 1
  ),
  indir AS (
    SELECT p.m, sum(p.v) AS v
    FROM pag p
    WHERE p.departamento IN ('Facilities', 'Financeiro', 'Marketing', 'R.H.', 'T.I.', 'Comercial')
    GROUP BY 1
  ),
  params AS (
    SELECT a.area_key, ms.mes, pm.profissionais, pm.pct_controladoria, pm.mes <> ms.mes AS herdado
    FROM dl_areas a
    CROSS JOIN meses ms
    LEFT JOIN LATERAL (
      SELECT x.mes, x.profissionais, x.pct_controladoria
      FROM dl_parametros_mensais x
      WHERE x.ano = p_ano AND x.area_key = a.area_key AND x.mes <= ms.mes
      ORDER BY x.mes DESC
      LIMIT 1
    ) pm ON true
  ),
  socios AS (
    SELECT ms.mes, coalesce(g.socios_parcela_fixa, 0) AS v
    FROM meses ms
    LEFT JOIN LATERAL (
      SELECT x.socios_parcela_fixa FROM dl_parametros_gerais x
      WHERE x.ano = p_ano AND x.mes <= ms.mes ORDER BY x.mes DESC LIMIT 1
    ) g ON true
  ),
  hc AS (
    SELECT p.mes, sum(coalesce(p.profissionais, 0)) AS total FROM params p GROUP BY 1
  )
  SELECT
    p.area_key,
    p.mes,
    round(coalesce(r.bruto, 0)::numeric, 2),
    round(coalesce(r.imposto, 0)::numeric, 2),
    round(coalesce(da.v, 0)::numeric, 2),
    round((coalesce(c.v, 0) * coalesce(p.pct_controladoria, 0) / 100)::numeric, 2),
    round(CASE
      WHEN coalesce(h.total, 0) > 0 AND (ix.v IS NOT NULL OR r.bruto IS NOT NULL)
        THEN (coalesce(ix.v, 0) + s.v) / h.total * coalesce(p.profissionais, 0)
      ELSE 0
    END::numeric, 2),
    coalesce(p.profissionais, 0),
    coalesce(p.pct_controladoria, 0),
    coalesce(p.herdado, true)
  FROM params p
  JOIN socios s ON s.mes = p.mes
  JOIN hc h ON h.mes = p.mes
  LEFT JOIN rec r ON r.area_key = p.area_key AND r.m = p.mes
  LEFT JOIN desp_area da ON da.area_key = p.area_key AND da.m = p.mes
  LEFT JOIN ctrl c ON c.m = p.mes
  LEFT JOIN indir ix ON ix.m = p.mes
  ORDER BY p.area_key, p.mes;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_resultado_mensal(integer) TO authenticated;

-- Rateios (profissionais e % de agendamentos), parcela fixa e gestores do fechamento oficial foram
-- carregados direto no banco de produção, fora do repositório: são dados da Controladoria.

-- Libera a rota do módulo para o perfil admin na configuração salva de acessos.
UPDATE public.app_settings
SET value = jsonb_set(value, '{admin}', (value -> 'admin') || '"/financeiro/dl"'::jsonb)
WHERE key = 'role_route_access_defaults'
  AND NOT (value -> 'admin') ? '/financeiro/dl';
