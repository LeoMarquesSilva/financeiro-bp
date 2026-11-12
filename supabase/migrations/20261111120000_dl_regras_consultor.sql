-- DL: regras confirmadas com o consultor financeiro (2026-11-11) e fechamento do mês.
--   1. Alíquota do imposto por mês (dl_aliquotas). Varia com o faturamento; mês sem cadastro usa o último
--      mês cadastrado (16,0587% se não houver nenhum).
--   2. Profissionais por área: mês sem valor manual conta pelo cadastro de RH (sp_turnover): quem trabalhou
--      ao menos um dia no mês na área, exceto quem entrou no último dia e advogado parceiro.
--   3. % da Controladoria = % de horas da Ops por área no Fechamento Legal Ops (legal_ops_rateio_mensal).
--      Mês sem valor manual usa o rateio do mês (ou o último disponível, marcado como herdado).
--   4. Carteira do gestor: cliente da área entra automaticamente; só fica fora quem estiver marcado como
--      excluído (dl_gestor_clientes.incluido = false).
--   5. Liberação de Recursos (recebimentos em nome do Banco do Brasil) aparece separada dentro da receita.
--   6. Regra do DL negativo por área: 'mensal' (zera o mês) ou 'acumulado' (compensa no ano). Padrão mensal.
--   7. Fechamento do mês: grava a foto do mês. O que mudar depois no VIOS entra como ajuste no DL do
--      próximo mês fechado.

-- 1. Alíquota por mês -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dl_aliquotas (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  aliquota numeric(7, 4) NOT NULL CHECK (aliquota >= 0 AND aliquota < 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (ano, mes)
);

-- A planilha usou 16,0587% de jan a ago/2026.
INSERT INTO public.dl_aliquotas (ano, mes, aliquota, updated_by)
SELECT 2026, m, 16.0587, 'planilha DL 2026' FROM generate_series(1, 8) AS m
ON CONFLICT (ano, mes) DO NOTHING;

CREATE OR REPLACE FUNCTION public.dl_aliquota(p_ano integer, p_mes integer)
RETURNS TABLE(aliquota numeric, herdada boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(x.aliquota, 16.0587), x.ano IS DISTINCT FROM p_ano OR x.mes IS DISTINCT FROM p_mes
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT a.ano, a.mes, a.aliquota FROM dl_aliquotas a
    WHERE (a.ano, a.mes) <= (p_ano, p_mes)
    ORDER BY a.ano DESC, a.mes DESC
    LIMIT 1
  ) x ON true;
$function$;

-- 2 e 3. Áreas: nome no RH e no Fechamento Legal Ops; regra do negativo ------------------------------
ALTER TABLE public.dl_areas ADD COLUMN IF NOT EXISTS areas_rh text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.dl_areas ADD COLUMN IF NOT EXISTS area_legal_ops text;
ALTER TABLE public.dl_areas ADD COLUMN IF NOT EXISTS regra_negativo text NOT NULL DEFAULT 'mensal';
ALTER TABLE public.dl_areas DROP CONSTRAINT IF EXISTS dl_areas_regra_negativo_check;
ALTER TABLE public.dl_areas ADD CONSTRAINT dl_areas_regra_negativo_check CHECK (regra_negativo IN ('mensal', 'acumulado'));

UPDATE public.dl_areas SET areas_rh = v.rh, area_legal_ops = v.lo
FROM (VALUES
  ('civel', ARRAY['Cível'], 'Cível'),
  ('insolvencia', ARRAY['Reestruturação', 'Insolvência'], 'Reestruturação'),
  ('contratos', ARRAY['Contratos'], 'Contratos'),
  ('add', ARRAY['Distressd Deals', 'Distressed Deals'], 'Distressed Deals'),
  ('rec_credito', ARRAY['Recuperação de Crédito'], 'Recuperação de Crédito'),
  ('trabalhista', ARRAY['Trabalhista'], 'Trabalhista'),
  ('tributario', ARRAY['Tributário'], 'Tributário')
) AS v(area_key, rh, lo)
WHERE dl_areas.area_key = v.area_key;

-- Horas da Ops por área no Fechamento Legal Ops (aba TIME SHEET - FECHAMENTO), gravadas a cada fechamento.
CREATE TABLE IF NOT EXISTS public.legal_ops_rateio_mensal (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area text NOT NULL,
  horas numeric(10, 2) NOT NULL CHECK (horas >= 0),
  pct numeric(8, 4) NOT NULL CHECK (pct >= 0 AND pct <= 100),
  fonte text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (ano, mes, area)
);

-- Parâmetros mensais: valor nulo = automático (RH / Legal Ops).
ALTER TABLE public.dl_parametros_mensais ALTER COLUMN profissionais DROP NOT NULL;
ALTER TABLE public.dl_parametros_mensais ALTER COLUMN profissionais DROP DEFAULT;
ALTER TABLE public.dl_parametros_mensais ALTER COLUMN pct_controladoria DROP NOT NULL;
ALTER TABLE public.dl_parametros_mensais ALTER COLUMN pct_controladoria DROP DEFAULT;

-- 4. Carteira: cliente fora da lista entra; incluido = false exclui ------------------------------------
ALTER TABLE public.dl_gestor_clientes ADD COLUMN IF NOT EXISTS incluido boolean NOT NULL DEFAULT true;

-- 7. Fechamento ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dl_fechamentos (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por text,
  observacao text,
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS public.dl_fechamento_areas (
  ano integer NOT NULL,
  mes integer NOT NULL,
  area_key text NOT NULL REFERENCES public.dl_areas (area_key),
  receita_bruta numeric(15, 2) NOT NULL,
  liberacao_recursos numeric(15, 2) NOT NULL,
  impostos numeric(15, 2) NOT NULL,
  aliquota numeric(7, 4) NOT NULL,
  desp_operacionais numeric(15, 2) NOT NULL,
  desp_controladoria numeric(15, 2) NOT NULL,
  desp_indiretas numeric(15, 2) NOT NULL,
  profissionais numeric(6, 2) NOT NULL,
  pct_controladoria numeric(8, 4) NOT NULL,
  origem_profissionais text NOT NULL,
  origem_controladoria text NOT NULL,
  socios_prolabore numeric(15, 2) NOT NULL,
  PRIMARY KEY (ano, mes, area_key),
  FOREIGN KEY (ano, mes) REFERENCES public.dl_fechamentos (ano, mes) ON DELETE CASCADE
);

-- Gestor com mês fechado não pode ser apagado (encerre a vigência).
CREATE TABLE IF NOT EXISTS public.dl_fechamento_gestores (
  ano integer NOT NULL,
  mes integer NOT NULL,
  gestor_id uuid NOT NULL REFERENCES public.dl_gestores (id),
  clientes integer NOT NULL,
  liquido_clientes numeric(15, 2) NOT NULL,
  resultado_clientes numeric(15, 2) NOT NULL,
  dl_calculado numeric(15, 2) NOT NULL,
  ajuste numeric(15, 2) NOT NULL,
  dl numeric(15, 2) NOT NULL,
  PRIMARY KEY (ano, mes, gestor_id),
  FOREIGN KEY (ano, mes) REFERENCES public.dl_fechamentos (ano, mes) ON DELETE CASCADE
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dl_aliquotas', 'legal_ops_rateio_mensal', 'dl_fechamentos', 'dl_fechamento_areas', 'dl_fechamento_gestores'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())',
      t || '_admin', t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Fechamento só pelas funções (snapshot consistente); leitura continua liberada ao admin.
REVOKE INSERT, UPDATE, DELETE ON public.dl_fechamentos, public.dl_fechamento_areas, public.dl_fechamento_gestores FROM authenticated;

-- Cálculo ao vivo por área --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dl_resultado_mensal_vivo(p_ano integer)
RETURNS TABLE(
  area_key text,
  mes integer,
  receita_bruta numeric,
  liberacao_recursos numeric,
  impostos numeric,
  aliquota numeric,
  aliquota_herdada boolean,
  desp_operacionais numeric,
  desp_controladoria numeric,
  desp_indiretas numeric,
  profissionais numeric,
  pct_controladoria numeric,
  origem_profissionais text,
  origem_controladoria text,
  socios_prolabore numeric
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
    SELECT g AS mes, make_date(p_ano, g, 1) AS ini, (make_date(p_ano, g, 1) + interval '1 month - 1 day')::date AS fim
    FROM generate_series(1, 12) AS g
  ),
  aliq AS (
    SELECT ms.mes, a.aliquota, a.herdada FROM meses ms CROSS JOIN LATERAL public.dl_aliquota(p_ano, ms.mes) a
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
      sum(i.valor_pago_item) FILTER (WHERE i.cliente ILIKE 'banco do brasil%') AS lib,
      sum(i.valor_pago_item) FILTER (WHERE trim(i.nfse_titulo) ~ '^[0-9]+$') AS base_nf
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
    -- OPEX, menos impostos sobre faturamento (já descontados na receita líquida).
    SELECT i.departamento, i.m, abs(coalesce(i.valor_pago_item, 0)) AS v
    FROM itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND NOT public.opex_grupo_excluido(i.grupo_conta)
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
  socios AS (
    SELECT i.m, sum(abs(coalesce(i.valor_pago_item, 0))) AS v
    FROM itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo) AND i.plano_contas = 'PRÓ-LABORE'
    GROUP BY 1
  ),
  rh AS (
    -- Trabalhou ao menos um dia no mês na área (quem entra no último dia conta no mês seguinte).
    SELECT a.area_key, ms.mes, count(t.id)::numeric AS n
    FROM dl_areas a
    CROSS JOIN meses ms
    LEFT JOIN sp_turnover t
      ON t.area = ANY (a.areas_rh)
     AND coalesce(t.cargo, '') NOT ILIKE '%parceiro%'
     AND t.admissao < ms.fim
     AND (t.desligamento IS NULL OR t.desligamento >= ms.ini)
    GROUP BY 1, 2
  ),
  lo_mes AS (
    SELECT ms.mes, (SELECT max(x.mes) FROM legal_ops_rateio_mensal x WHERE x.ano = p_ano AND x.mes <= ms.mes) AS mes_fonte
    FROM meses ms
  ),
  lo AS (
    SELECT a.area_key, l.mes, l.mes_fonte, r.pct
    FROM dl_areas a
    CROSS JOIN lo_mes l
    LEFT JOIN legal_ops_rateio_mensal r ON r.ano = p_ano AND r.mes = l.mes_fonte AND r.area = a.area_legal_ops
  ),
  params AS (
    SELECT a.area_key, ms.mes,
      coalesce(pm.profissionais, rh.n, 0) AS prof,
      CASE WHEN pm.profissionais IS NOT NULL THEN 'manual' ELSE 'cadastro_rh' END AS origem_prof,
      coalesce(pm.pct_controladoria, CASE WHEN lo.mes_fonte IS NOT NULL THEN coalesce(lo.pct, 0) END, 0) AS pct,
      CASE
        WHEN pm.pct_controladoria IS NOT NULL THEN 'manual'
        WHEN lo.mes_fonte = ms.mes THEN 'legal_ops'
        WHEN lo.mes_fonte IS NOT NULL THEN 'legal_ops_herdado'
        ELSE 'sem_dado'
      END AS origem_pct
    FROM dl_areas a
    CROSS JOIN meses ms
    LEFT JOIN dl_parametros_mensais pm ON pm.ano = p_ano AND pm.mes = ms.mes AND pm.area_key = a.area_key
    LEFT JOIN rh ON rh.area_key = a.area_key AND rh.mes = ms.mes
    LEFT JOIN lo ON lo.area_key = a.area_key AND lo.mes = ms.mes
  ),
  hc AS (
    SELECT p.mes, sum(p.prof) AS total FROM params p GROUP BY 1
  )
  SELECT
    p.area_key,
    p.mes,
    round(coalesce(r.bruto, 0)::numeric, 2),
    round(coalesce(r.lib, 0)::numeric, 2),
    round((coalesce(r.base_nf, 0) * al.aliquota / 100)::numeric, 2),
    al.aliquota,
    al.herdada,
    round(coalesce(da.v, 0)::numeric, 2),
    round((coalesce(c.v, 0) * p.pct / 100)::numeric, 2),
    round(CASE
      WHEN coalesce(h.total, 0) > 0 AND (ix.v IS NOT NULL OR r.bruto IS NOT NULL)
        THEN (coalesce(ix.v, 0) + coalesce(s.v, 0)) / h.total * p.prof
      ELSE 0
    END::numeric, 2),
    p.prof,
    p.pct,
    p.origem_prof,
    p.origem_pct,
    round(coalesce(s.v, 0)::numeric, 2)
  FROM params p
  JOIN hc h ON h.mes = p.mes
  JOIN aliq al ON al.mes = p.mes
  LEFT JOIN socios s ON s.m = p.mes
  LEFT JOIN rec r ON r.area_key = p.area_key AND r.m = p.mes
  LEFT JOIN desp_area da ON da.area_key = p.area_key AND da.m = p.mes
  LEFT JOIN ctrl c ON c.m = p.mes
  LEFT JOIN indir ix ON ix.m = p.mes
  ORDER BY p.area_key, p.mes;
END;
$function$;

-- Cálculo ao vivo por gestor ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dl_gestor_mensal_vivo(p_ano integer)
RETURNS TABLE(gestor_id uuid, mes integer, clientes integer, liquido_clientes numeric, resultado_clientes numeric, dl numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  WITH area AS (
    SELECT r.area_key, r.mes, r.aliquota,
      r.receita_bruta - r.impostos AS liquido,
      r.desp_operacionais + r.desp_controladoria + r.desp_indiretas AS despesas
    FROM public.dl_resultado_mensal_vivo(p_ano) r
  ),
  cli AS (
    SELECT a.area_key, extract(month FROM i.data_pagamento)::integer AS m, trim(i.cliente) AS cliente,
      (trim(i.nfse_titulo) ~ '^[0-9]+$') AS tem_nf, i.valor_pago_item AS v
    FROM financeiro_parcelas_itens i
    JOIN dl_areas a ON a.departamento = i.departamento
    WHERE i.tipo = 'RECEBER'
      AND i.data_pagamento >= make_date(p_ano, 1, 1)
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
      AND i.plano_contas IN (
        'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
        'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
        'HONORÁRIOS POR HORA TRABALHADA'
      )
  ),
  cli_liq AS (
    SELECT c.area_key, c.m, c.cliente,
      sum(c.v * CASE WHEN c.tem_nf THEN 1 - ar.aliquota / 100 ELSE 1 END) AS liq
    FROM cli c
    JOIN area ar ON ar.area_key = c.area_key AND ar.mes = c.m
    GROUP BY 1, 2, 3
  ),
  g AS (
    SELECT x.id, x.area_key, x.pct, x.mes_inicio, x.mes_fim, a.regra_negativo
    FROM dl_gestores x JOIN dl_areas a ON a.area_key = x.area_key
    WHERE x.ano = p_ano
  ),
  base AS (
    SELECT g.id, g.pct, g.regra_negativo, ms.mes, c.cliente, c.liq,
      CASE WHEN ar.liquido > 0 THEN c.liq - ar.despesas * c.liq / ar.liquido ELSE 0 END AS res
    FROM g
    CROSS JOIN LATERAL generate_series(g.mes_inicio, g.mes_fim) AS ms(mes)
    JOIN area ar ON ar.area_key = g.area_key AND ar.mes = ms.mes
    LEFT JOIN cli_liq c ON c.area_key = g.area_key AND c.m = ms.mes
      AND coalesce(
        (SELECT gc.incluido FROM dl_gestor_clientes gc WHERE gc.gestor_id = g.id AND gc.cliente = c.cliente),
        true
      )
  ),
  mensal AS (
    SELECT b.id, b.mes, max(b.pct) AS pct, max(b.regra_negativo) AS regra,
      count(b.cliente)::integer AS n, coalesce(sum(b.liq), 0) AS liq, coalesce(sum(b.res), 0) AS res
    FROM base b
    GROUP BY b.id, b.mes
  ),
  acum AS (
    -- Regra acumulada: o DL pago até o mês nunca passa de % × resultado acumulado no ano (pico já pago fica).
    SELECT m.*, greatest(max(sum_res * m.pct / 100) OVER (PARTITION BY m.id ORDER BY m.mes), 0) AS teto
    FROM (SELECT x.*, sum(x.res) OVER (PARTITION BY x.id ORDER BY x.mes) AS sum_res FROM mensal x) m
  )
  SELECT a.id, a.mes, a.n,
    round(a.liq::numeric, 2),
    round(a.res::numeric, 2),
    round(CASE
      WHEN a.regra = 'acumulado' THEN a.teto - coalesce(lag(a.teto) OVER (PARTITION BY a.id ORDER BY a.mes), 0)
      ELSE greatest(a.res * a.pct / 100, 0)
    END::numeric, 2)
  FROM acum a
  ORDER BY a.id, a.mes;
END;
$function$;

-- Funções públicas: mês fechado devolve a foto; mês aberto, o cálculo ao vivo ---------------------------
DROP FUNCTION IF EXISTS public.dl_resultado_mensal(integer);

CREATE FUNCTION public.dl_resultado_mensal(p_ano integer)
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
  parametro_herdado boolean,
  socios_prolabore numeric,
  liberacao_recursos numeric,
  aliquota numeric,
  aliquota_herdada boolean,
  origem_profissionais text,
  origem_controladoria text,
  fechado boolean
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
  SELECT v.area_key, v.mes, v.receita_bruta, v.impostos, v.desp_operacionais, v.desp_controladoria,
    v.desp_indiretas, v.profissionais, v.pct_controladoria,
    v.origem_controladoria IN ('legal_ops_herdado', 'sem_dado'),
    v.socios_prolabore, v.liberacao_recursos, v.aliquota, v.aliquota_herdada,
    v.origem_profissionais, v.origem_controladoria, false
  FROM public.dl_resultado_mensal_vivo(p_ano) v
  WHERE NOT EXISTS (SELECT 1 FROM dl_fechamentos f WHERE f.ano = p_ano AND f.mes = v.mes)
  UNION ALL
  SELECT s.area_key, s.mes, s.receita_bruta, s.impostos, s.desp_operacionais, s.desp_controladoria,
    s.desp_indiretas, s.profissionais, s.pct_controladoria,
    s.origem_controladoria IN ('legal_ops_herdado', 'sem_dado'),
    s.socios_prolabore, s.liberacao_recursos, s.aliquota, false,
    s.origem_profissionais, s.origem_controladoria, true
  FROM dl_fechamento_areas s
  WHERE s.ano = p_ano
  ORDER BY 1, 2;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_resultado_mensal(integer) TO authenticated;

DROP FUNCTION IF EXISTS public.dl_gestor_mensal(integer);

-- Ajuste: diferença entre o recálculo de hoje e a foto dos meses fechados, menos o que já foi ajustado.
-- Entra no primeiro mês aberto depois do último fechado e não deixa o DL do mês negativo (o resto segue
-- pendente para o mês seguinte).
CREATE FUNCTION public.dl_gestor_mensal(p_ano integer)
RETURNS TABLE(
  gestor_id uuid,
  mes integer,
  clientes integer,
  liquido_clientes numeric,
  resultado_clientes numeric,
  dl numeric,
  dl_calculado numeric,
  ajuste numeric,
  fechado boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo integer;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  SELECT max(f.mes) INTO v_ultimo FROM dl_fechamentos f WHERE f.ano = p_ano;

  RETURN QUERY
  WITH vivo AS (
    SELECT * FROM public.dl_gestor_mensal_vivo(p_ano)
  ),
  pendente AS (
    SELECT v.gestor_id, sum(v.dl - coalesce(s.dl_calculado, 0) - coalesce(s.ajuste, 0)) AS valor
    FROM vivo v
    LEFT JOIN dl_fechamento_gestores s ON s.ano = p_ano AND s.mes = v.mes AND s.gestor_id = v.gestor_id
    WHERE v.mes <= coalesce(v_ultimo, 0)
    GROUP BY 1
  ),
  aberto AS (
    SELECT v.gestor_id, v.mes, v.clientes, v.liquido_clientes, v.resultado_clientes, v.dl AS calc,
      CASE WHEN v.mes = coalesce(v_ultimo, 0) + 1
        THEN round(greatest(coalesce(p.valor, 0), -v.dl)::numeric, 2)
        ELSE 0
      END AS aj
    FROM vivo v
    LEFT JOIN pendente p ON p.gestor_id = v.gestor_id
    WHERE v.mes > coalesce(v_ultimo, 0)
  )
  SELECT a.gestor_id, a.mes, a.clientes, a.liquido_clientes, a.resultado_clientes,
    a.calc + a.aj, a.calc, a.aj, false
  FROM aberto a
  UNION ALL
  SELECT s.gestor_id, s.mes, s.clientes, s.liquido_clientes, s.resultado_clientes, s.dl, s.dl_calculado, s.ajuste, true
  FROM dl_fechamento_gestores s
  WHERE s.ano = p_ano
  ORDER BY 1, 2;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_gestor_mensal(integer) TO authenticated;

-- Fecha todos os meses abertos até p_mes, em ordem (cada um leva o ajuste dos anteriores).
CREATE OR REPLACE FUNCTION public.dl_fechar_mes(p_ano integer, p_mes integer, p_observacao text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes integer;
  v_fechados integer := 0;
  v_por text := coalesce(auth.jwt() ->> 'email', current_user);
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Mês inválido';
  END IF;
  IF (make_date(p_ano, p_mes, 1) + interval '1 month')::date > current_date THEN
    RAISE EXCEPTION 'O mês ainda não terminou';
  END IF;

  SELECT coalesce(max(f.mes), 0) + 1 INTO v_mes FROM dl_fechamentos f WHERE f.ano = p_ano;

  WHILE v_mes <= p_mes LOOP
    -- O DL dos gestores (com o ajuste) é lido antes de o mês constar como fechado: um único comando,
    -- em que a leitura enxerga o banco de antes do INSERT.
    WITH gest AS (
      SELECT g.* FROM public.dl_gestor_mensal(p_ano) g WHERE g.mes = v_mes AND NOT g.fechado
    ),
    fech AS (
      INSERT INTO dl_fechamentos (ano, mes, fechado_por, observacao)
      VALUES (p_ano, v_mes, v_por, p_observacao)
      RETURNING ano, mes
    )
    INSERT INTO dl_fechamento_gestores (
      ano, mes, gestor_id, clientes, liquido_clientes, resultado_clientes, dl_calculado, ajuste, dl
    )
    SELECT f.ano, f.mes, g.gestor_id, g.clientes, g.liquido_clientes, g.resultado_clientes, g.dl_calculado, g.ajuste, g.dl
    FROM gest g CROSS JOIN fech f;
    -- (O INSERT de um CTE roda sempre, mesmo sem gestor vigente no mês.)

    INSERT INTO dl_fechamento_areas (
      ano, mes, area_key, receita_bruta, liberacao_recursos, impostos, aliquota, desp_operacionais,
      desp_controladoria, desp_indiretas, profissionais, pct_controladoria, origem_profissionais,
      origem_controladoria, socios_prolabore
    )
    SELECT p_ano, v.mes, v.area_key, v.receita_bruta, v.liberacao_recursos, v.impostos, v.aliquota,
      v.desp_operacionais, v.desp_controladoria, v.desp_indiretas, v.profissionais, v.pct_controladoria,
      v.origem_profissionais, v.origem_controladoria, v.socios_prolabore
    FROM public.dl_resultado_mensal_vivo(p_ano) v
    WHERE v.mes = v_mes;

    v_fechados := v_fechados + 1;
    v_mes := v_mes + 1;
  END LOOP;

  RETURN v_fechados;
END;
$function$;

-- Reabre só o último mês fechado do ano.
CREATE OR REPLACE FUNCTION public.dl_reabrir_mes(p_ano integer, p_mes integer)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;
  IF p_mes IS DISTINCT FROM (SELECT max(f.mes) FROM dl_fechamentos f WHERE f.ano = p_ano) THEN
    RAISE EXCEPTION 'Só o último mês fechado pode ser reaberto';
  END IF;
  DELETE FROM dl_fechamentos WHERE ano = p_ano AND mes = p_mes;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dl_fechar_mes(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dl_reabrir_mes(integer, integer) TO authenticated;

-- Clientes da área com a alíquota do mês (lista da carteira).
CREATE OR REPLACE FUNCTION public.dl_clientes_area(p_ano integer)
RETURNS TABLE(area_key text, cliente text, liquido numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  SELECT a.area_key, trim(i.cliente),
    round(sum(i.valor_pago_item * CASE WHEN trim(i.nfse_titulo) ~ '^[0-9]+$' THEN 1 - al.aliquota / 100 ELSE 1 END)::numeric, 2)
  FROM financeiro_parcelas_itens i
  JOIN dl_areas a ON a.departamento = i.departamento
  CROSS JOIN LATERAL public.dl_aliquota(p_ano, extract(month FROM i.data_pagamento)::integer) al
  WHERE i.tipo = 'RECEBER'
    AND i.cliente IS NOT NULL
    AND i.data_pagamento >= make_date(p_ano, 1, 1)
    AND i.data_pagamento < make_date(p_ano + 1, 1, 1)
    AND i.plano_contas IN (
      'HONORÁRIOS ADVOCATÍCIOS', 'HONORÁRIOS DE ÊXITO', 'HONORÁRIOS DE MANUTENÇÃO',
      'HONORÁRIOS DE SUCUMBÊNCIA', 'HONORÁRIOS MENSAIS', 'HONORÁRIOS SPOT',
      'HONORÁRIOS POR HORA TRABALHADA'
    )
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
END;
$function$;

-- Rateio Legal Ops, exclusões da carteira (clientes com 0% na planilha) e o segundo gestor de Rec. Crédito
-- foram carregados direto no banco de produção, fora do repositório: são dados da Controladoria.
