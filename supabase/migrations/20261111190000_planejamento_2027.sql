-- Planejamento Estratégico 2027.
--
-- Módulo aberto por link (fora do menu): qualquer pessoa logada no SIOE lê e edita cenários.
-- As funções de leitura são SECURITY DEFINER porque as tabelas do DL (dl_areas, rateio da
-- Controladoria) são só de admin; elas devolvem apenas totais por área, nada por gestor.
--
-- Regras (decisões do usuário em 11/11/2026):
--   * Receita = regra da Receita (honorários de plano na cota, recebido sem juros, por data de pagamento).
--     Departamento fora das 7 áreas do DL usa a classificação manual por cliente; sem ela fica "sem_area".
--   * Margem de contribuição = receita − imposto (alíquota do DL × receita com NF) − OPEX da área
--     (mesma regra do DL) − rateio da Controladoria (OPEX de Operações Legais × % de horas da Ops).
--   * 2025: custos de pessoas lançados em departamento fora das áreas (quase tudo em "Facilities")
--     vão para o departamento da pessoa — o da folha de 2026 ou, sem folha em 2026, o do cadastro de RH.
--   * Folha (Pessoas) por competência: pagamento até o dia 15 conta no mês anterior.

-- Tabelas ------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.planejamento_receita_classificacao (
  cliente text PRIMARY KEY,
  area_key text NOT NULL REFERENCES public.dl_areas (area_key),
  classificado_por uuid DEFAULT auth.uid(),
  classificado_por_email text,
  classificado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planejamento_cenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_alvo integer NOT NULL DEFAULT 2027,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  descricao text,
  premissas jsonb NOT NULL DEFAULT '{}'::jsonb,
  oficial boolean NOT NULL DEFAULT false,
  oficializado_em timestamptz,
  oficializado_por_email text,
  created_by uuid DEFAULT auth.uid(),
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_by_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS planejamento_cenarios_um_oficial
  ON public.planejamento_cenarios (ano_alvo) WHERE oficial;

CREATE TABLE IF NOT EXISTS public.planejamento_metas_oficiais (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area_key text NOT NULL,
  receita_bruta numeric(15, 2) NOT NULL DEFAULT 0,
  impostos numeric(15, 2) NOT NULL DEFAULT 0,
  opex_area numeric(15, 2) NOT NULL DEFAULT 0,
  controladoria numeric(15, 2) NOT NULL DEFAULT 0,
  margem numeric(15, 2) NOT NULL DEFAULT 0,
  inadimplencia_pct numeric(8, 4),
  cenario_id uuid NOT NULL REFERENCES public.planejamento_cenarios (id),
  PRIMARY KEY (ano, mes, area_key)
);

CREATE TABLE IF NOT EXISTS public.planejamento_metas_operacionais_oficiais (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ano integer NOT NULL,
  indicador text NOT NULL,
  area_key text,
  meta numeric(15, 4) NOT NULL,
  unidade text NOT NULL,
  cenario_id uuid NOT NULL REFERENCES public.planejamento_cenarios (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS planejamento_metas_operacionais_oficiais_uk
  ON public.planejamento_metas_operacionais_oficiais (ano, indicador, coalesce(area_key, ''));

-- Quem criou/editou: e-mail gravado pelo banco (não vem do navegador).
CREATE OR REPLACE FUNCTION public.planejamento_cenarios_autoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := (SELECT u.email FROM auth.users u WHERE u.id = auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_by_email := v_email;
    NEW.created_at := now();
    NEW.oficial := false;
    NEW.oficializado_em := NULL;
    NEW.oficializado_por_email := NULL;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_by_email := OLD.created_by_email;
    NEW.created_at := OLD.created_at;
    -- Oficial só muda pela função planejamento_oficializar.
    IF coalesce(current_setting('planejamento.oficializando', true), '') <> '1' THEN
      NEW.oficial := OLD.oficial;
      NEW.oficializado_em := OLD.oficializado_em;
      NEW.oficializado_por_email := OLD.oficializado_por_email;
    END IF;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_by_email := v_email;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS planejamento_cenarios_autoria ON public.planejamento_cenarios;
CREATE TRIGGER planejamento_cenarios_autoria
  BEFORE INSERT OR UPDATE ON public.planejamento_cenarios
  FOR EACH ROW EXECUTE FUNCTION public.planejamento_cenarios_autoria();

CREATE OR REPLACE FUNCTION public.planejamento_classificacao_autoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.classificado_por := auth.uid();
  NEW.classificado_por_email := (SELECT u.email FROM auth.users u WHERE u.id = auth.uid());
  NEW.classificado_em := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS planejamento_classificacao_autoria ON public.planejamento_receita_classificacao;
CREATE TRIGGER planejamento_classificacao_autoria
  BEFORE INSERT OR UPDATE ON public.planejamento_receita_classificacao
  FOR EACH ROW EXECUTE FUNCTION public.planejamento_classificacao_autoria();

-- RLS: logado lê tudo; edita cenários e classificação; metas oficiais só pela função.
ALTER TABLE public.planejamento_receita_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_cenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_metas_oficiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_metas_operacionais_oficiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planejamento_classificacao_logado ON public.planejamento_receita_classificacao;
CREATE POLICY planejamento_classificacao_logado ON public.planejamento_receita_classificacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS planejamento_cenarios_leitura ON public.planejamento_cenarios;
CREATE POLICY planejamento_cenarios_leitura ON public.planejamento_cenarios
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS planejamento_cenarios_insere ON public.planejamento_cenarios;
CREATE POLICY planejamento_cenarios_insere ON public.planejamento_cenarios
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS planejamento_cenarios_edita ON public.planejamento_cenarios;
CREATE POLICY planejamento_cenarios_edita ON public.planejamento_cenarios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- Apagar: quem criou ou admin, e nunca o oficial.
DROP POLICY IF EXISTS planejamento_cenarios_apaga ON public.planejamento_cenarios;
CREATE POLICY planejamento_cenarios_apaga ON public.planejamento_cenarios
  FOR DELETE TO authenticated
  USING (NOT oficial AND (created_by = auth.uid() OR public.current_user_is_admin()));

DROP POLICY IF EXISTS planejamento_metas_oficiais_leitura ON public.planejamento_metas_oficiais;
CREATE POLICY planejamento_metas_oficiais_leitura ON public.planejamento_metas_oficiais
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS planejamento_metas_operacionais_leitura ON public.planejamento_metas_operacionais_oficiais;
CREATE POLICY planejamento_metas_operacionais_leitura ON public.planejamento_metas_operacionais_oficiais
  FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_receita_classificacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_cenarios TO authenticated;
GRANT SELECT ON public.planejamento_metas_oficiais, public.planejamento_metas_operacionais_oficiais TO authenticated;
REVOKE ALL ON public.planejamento_receita_classificacao, public.planejamento_cenarios,
  public.planejamento_metas_oficiais, public.planejamento_metas_operacionais_oficiais FROM anon;

-- Funções internas (sem acesso direto pelo app) ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.planejamento_norm_nome(t text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT lower(extensions.unaccent(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g')));
$function$;

-- Subgrupo de Pessoas da conta (maior prefixo em opex_v2_classificacao); null = não é Pessoas.
CREATE OR REPLACE FUNCTION public.planejamento_subgrupo_pessoas(p_conta text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT c.subgrupo
  FROM opex_v2_classificacao c
  WHERE c.grupo_gerencial = 'Pessoas' AND coalesce(p_conta, '') LIKE c.conta_prefixo || '%'
  ORDER BY length(c.conta_prefixo) DESC
  LIMIT 1;
$function$;

-- Departamento de cada pessoa: o da folha de 2026 em diante (onde mais recebeu);
-- quem não tem folha em 2026 usa a área do cadastro de RH (sp_turnover).
CREATE OR REPLACE FUNCTION public.planejamento_pessoa_departamento()
RETURNS TABLE(nome_norm text, departamento text, origem text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH folha AS (
    SELECT public.planejamento_norm_nome(i.cliente) AS n, i.departamento, sum(abs(coalesce(i.valor_pago_item, 0))) AS v
    FROM financeiro_parcelas_itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND i.data_pagamento >= DATE '2026-01-01'
      AND (i.conta_numero LIKE '8.1.01%' OR i.conta_numero LIKE '8.1.02%')
      AND coalesce(i.departamento, '') <> ''
    GROUP BY 1, 2
  ),
  da_folha AS (
    SELECT DISTINCT ON (f.n) f.n, f.departamento FROM folha f WHERE f.n <> '' ORDER BY f.n, f.v DESC
  ),
  rh AS (
    SELECT DISTINCT ON (public.planejamento_norm_nome(t.nome))
      public.planejamento_norm_nome(t.nome) AS n,
      coalesce(
        (SELECT a.departamento FROM dl_areas a WHERE t.area = ANY (a.areas_rh) LIMIT 1),
        CASE WHEN t.area = 'Operações Legais' THEN 'Operações Legais' END
      ) AS departamento
    FROM sp_turnover t
    WHERE coalesce(trim(t.nome), '') <> ''
    ORDER BY public.planejamento_norm_nome(t.nome), t.admissao DESC NULLS LAST
  )
  SELECT f.n, f.departamento, 'folha_2026' FROM da_folha f
  UNION ALL
  SELECT r.n, r.departamento, 'cadastro_rh' FROM rh r
  WHERE r.departamento IS NOT NULL AND NOT EXISTS (SELECT 1 FROM da_folha f WHERE f.n = r.n);
$function$;

-- Itens pagos (OPEX) do ano com o departamento efetivo: em 2025, custo de pessoas fora das áreas
-- vai para o departamento da pessoa. `reclassificado` marca o que mudou.
CREATE OR REPLACE FUNCTION public.planejamento_pagos_ano(p_ano integer)
RETURNS TABLE(
  mes integer,
  departamento_vios text,
  departamento text,
  valor numeric,
  subgrupo_pessoas text,
  folha boolean,
  data_pagamento date,
  reclassificado boolean,
  pessoa_sem_match boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH pessoas AS (SELECT * FROM public.planejamento_pessoa_departamento()),
  itens AS (
    SELECT
      i.*,
      public.planejamento_subgrupo_pessoas(i.conta_numero) AS sub,
      coalesce(i.descricao, '') ILIKE '%folha%' AS desc_folha,
      coalesce(i.departamento IN (SELECT a.departamento FROM dl_areas a) OR i.departamento = 'Operações Legais', false) AS dep_operacional
    FROM financeiro_parcelas_itens i
    WHERE public.financeiro_titulo_eh_pagar(i.tipo)
      AND NOT public.opex_grupo_excluido(i.grupo_conta)
      AND coalesce(i.conta_numero, '') NOT LIKE '5.14.03%'
      AND coalesce(i.conta_numero, '') NOT LIKE '3.3.%'
      AND i.data_pagamento >= make_date(p_ano, 1, 1) - interval '1 month'
      AND i.data_pagamento < make_date(p_ano + 1, 1, 1) + interval '1 month'
  ),
  marcados AS (
    SELECT
      i.*,
      (i.sub IS NOT NULL OR i.desc_folha) AS de_pessoas,
      p.departamento AS dep_pessoa
    FROM itens i
    LEFT JOIN pessoas p ON p.nome_norm = public.planejamento_norm_nome(i.cliente)
  )
  SELECT
    extract(month FROM m.data_pagamento)::integer,
    m.departamento,
    CASE
      WHEN p_ano <= 2025 AND m.de_pessoas AND NOT m.dep_operacional AND m.dep_pessoa IS NOT NULL THEN m.dep_pessoa
      ELSE m.departamento
    END,
    abs(coalesce(m.valor_pago_item, 0)),
    m.sub,
    coalesce(m.sub IN ('Associados', 'CLT'), false) OR (m.desc_folha AND m.dep_pessoa IS NOT NULL),
    m.data_pagamento,
    p_ano <= 2025 AND m.de_pessoas AND NOT m.dep_operacional AND m.dep_pessoa IS NOT NULL
      AND m.dep_pessoa IS DISTINCT FROM m.departamento,
    p_ano <= 2025 AND m.de_pessoas AND NOT m.dep_operacional AND m.dep_pessoa IS NULL
  FROM marcados m;
$function$;

-- Itens de receita do ano com a área: departamento → área do DL; senão classificação manual por cliente.
CREATE OR REPLACE FUNCTION public.planejamento_receita_itens(p_ano integer)
RETURNS TABLE(mes integer, area_key text, cliente text, departamento text, valor numeric, com_nf boolean, origem text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    extract(month FROM i.data_pagamento)::integer,
    coalesce(a.area_key, c.area_key, 'sem_area'),
    i.cliente,
    i.departamento,
    public.receita_item_recebido_liquido(i),
    trim(coalesce(i.nfse_titulo, '')) ~ '^[0-9]+$',
    CASE WHEN a.area_key IS NOT NULL THEN 'departamento' WHEN c.area_key IS NOT NULL THEN 'classificado' ELSE 'sem_area' END
  FROM financeiro_parcelas_itens i
  LEFT JOIN dl_areas a ON a.departamento = i.departamento
  LEFT JOIN planejamento_receita_classificacao c ON a.area_key IS NULL AND c.cliente = i.cliente
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento >= make_date(p_ano, 1, 1)
    AND i.data_pagamento < make_date(p_ano + 1, 1, 1);
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_pessoa_departamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.planejamento_pagos_ano(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.planejamento_receita_itens(integer) FROM PUBLIC, anon, authenticated;

-- RPCs do app ------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planejamento_exigir_login()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login no SIOE para ver o planejamento';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.planejamento_areas()
RETURNS TABLE(area_key text, nome text, departamento text, ordem integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY SELECT a.area_key, a.nome, a.departamento, a.ordem::integer FROM dl_areas a ORDER BY a.ordem;
END;
$function$;

CREATE OR REPLACE FUNCTION public.planejamento_receita_mensal(p_ano integer)
RETURNS TABLE(mes integer, area_key text, origem text, recebido numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  SELECT r.mes, r.area_key, r.origem, round(sum(r.valor), 2)
  FROM public.planejamento_receita_itens(p_ano) r
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
END;
$function$;

-- Clientes com receita sem área no ano, com a sugestão (área onde o cliente mais pagou em qualquer
-- departamento de área, 2025 em diante) e a classificação já feita.
CREATE OR REPLACE FUNCTION public.planejamento_receita_sem_area(p_ano integer)
RETURNS TABLE(
  cliente text,
  departamentos_vios text,
  total numeric,
  titulos integer,
  sugestao_area_key text,
  area_key text,
  classificado_por_email text,
  classificado_em timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH base AS (
    SELECT i.cliente, i.departamento, i.valor
    FROM public.planejamento_receita_itens(p_ano) i
    WHERE i.origem <> 'departamento'
  ),
  hist AS (
    SELECT i.cliente, a.area_key, sum(public.receita_item_recebido_liquido(i)) AS v
    FROM financeiro_parcelas_itens i
    JOIN dl_areas a ON a.departamento = i.departamento
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND public.plano_contas_na_cota(i.plano_contas)
      AND i.data_pagamento >= DATE '2025-01-01'
      AND i.cliente IN (SELECT b.cliente FROM base b)
    GROUP BY 1, 2
  ),
  sug AS (
    SELECT DISTINCT ON (h.cliente) h.cliente, h.area_key FROM hist h ORDER BY h.cliente, h.v DESC
  )
  SELECT
    coalesce(b.cliente, '(sem cliente)'),
    string_agg(DISTINCT coalesce(b.departamento, '(vazio)'), ', '),
    round(sum(b.valor), 2),
    count(*)::integer,
    s.area_key,
    c.area_key,
    c.classificado_por_email,
    c.classificado_em
  FROM base b
  LEFT JOIN sug s ON s.cliente = b.cliente
  LEFT JOIN planejamento_receita_classificacao c ON c.cliente = b.cliente
  GROUP BY b.cliente, s.area_key, c.area_key, c.classificado_por_email, c.classificado_em
  ORDER BY 3 DESC;
END;
$function$;

-- Margem de contribuição por área e mês (base caixa).
CREATE OR REPLACE FUNCTION public.planejamento_margem_mensal(p_ano integer)
RETURNS TABLE(
  area_key text,
  mes integer,
  receita_bruta numeric,
  base_nf numeric,
  aliquota numeric,
  aliquota_herdada boolean,
  impostos numeric,
  desp_pessoas numeric,
  desp_demais numeric,
  desp_operacionais numeric,
  pct_controladoria numeric,
  origem_controladoria text,
  desp_controladoria numeric,
  pessoas_reclassificadas numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH meses AS (SELECT g AS mes FROM generate_series(1, 12) g),
  aliq AS (
    SELECT ms.mes, a.aliquota, a.herdada FROM meses ms CROSS JOIN LATERAL public.dl_aliquota(p_ano, ms.mes) a
  ),
  rec AS (
    SELECT r.area_key, r.mes, sum(r.valor) AS bruto, sum(r.valor) FILTER (WHERE r.com_nf) AS base_nf
    FROM public.planejamento_receita_itens(p_ano) r
    GROUP BY 1, 2
  ),
  pag AS (
    SELECT p.* FROM public.planejamento_pagos_ano(p_ano) p
    WHERE p.data_pagamento >= make_date(p_ano, 1, 1) AND p.data_pagamento < make_date(p_ano + 1, 1, 1)
  ),
  desp AS (
    SELECT a.area_key, p.mes,
      sum(p.valor) FILTER (WHERE p.subgrupo_pessoas IS NOT NULL OR p.folha) AS pessoas,
      sum(p.valor) FILTER (WHERE NOT (p.subgrupo_pessoas IS NOT NULL OR p.folha)) AS demais,
      sum(p.valor) FILTER (WHERE p.reclassificado) AS reclass
    FROM pag p JOIN dl_areas a ON a.departamento = p.departamento
    GROUP BY 1, 2
  ),
  ctrl AS (SELECT p.mes, sum(p.valor) AS v FROM pag p WHERE p.departamento = 'Operações Legais' GROUP BY 1),
  -- Rateio: mês do ano; senão o último mês anterior do mesmo ano; senão o primeiro mês disponível depois.
  lo_mes AS (
    SELECT ms.mes,
      coalesce(
        (SELECT x.ano * 100 + x.mes FROM legal_ops_rateio_mensal x
          WHERE x.ano = p_ano AND x.mes <= ms.mes
          ORDER BY x.mes DESC LIMIT 1),
        (SELECT x.ano * 100 + x.mes FROM legal_ops_rateio_mensal x
          WHERE (x.ano, x.mes) > (p_ano, ms.mes)
          ORDER BY x.ano, x.mes LIMIT 1)
      ) AS fonte
    FROM meses ms
  ),
  lo_fonte AS (
    SELECT l.mes, (l.fonte / 100)::integer AS ano_fonte, (l.fonte % 100)::integer AS mes_fonte FROM lo_mes l
  ),
  pct AS (
    SELECT a.area_key, f.mes,
      coalesce(pm.pct_controladoria, r.pct, CASE WHEN f.mes_fonte IS NOT NULL THEN 0 END, 0) AS pct,
      CASE
        WHEN pm.pct_controladoria IS NOT NULL THEN 'manual'
        WHEN f.ano_fonte = p_ano AND f.mes_fonte = f.mes THEN 'legal_ops'
        WHEN f.mes_fonte IS NOT NULL THEN 'herdado ' || lpad(f.mes_fonte::text, 2, '0') || '/' || f.ano_fonte
        ELSE 'sem_dado'
      END AS origem
    FROM dl_areas a
    CROSS JOIN lo_fonte f
    LEFT JOIN dl_parametros_mensais pm ON pm.ano = p_ano AND pm.mes = f.mes AND pm.area_key = a.area_key
    LEFT JOIN legal_ops_rateio_mensal r ON r.ano = f.ano_fonte AND r.mes = f.mes_fonte AND r.area = a.area_legal_ops
  ),
  areas AS (
    SELECT a.area_key, ms.mes FROM dl_areas a CROSS JOIN meses ms
    UNION
    SELECT r.area_key, r.mes FROM rec r WHERE r.area_key = 'sem_area'
  )
  SELECT
    x.area_key,
    x.mes,
    round(coalesce(r.bruto, 0), 2),
    round(coalesce(r.base_nf, 0), 2),
    al.aliquota,
    al.herdada,
    round(coalesce(r.base_nf, 0) * al.aliquota / 100, 2),
    round(coalesce(d.pessoas, 0), 2),
    round(coalesce(d.demais, 0), 2),
    round(coalesce(d.pessoas, 0) + coalesce(d.demais, 0), 2),
    coalesce(pc.pct, 0),
    coalesce(pc.origem, 'sem_area'),
    round(coalesce(c.v, 0) * coalesce(pc.pct, 0) / 100, 2),
    round(coalesce(d.reclass, 0), 2)
  FROM areas x
  JOIN aliq al ON al.mes = x.mes
  LEFT JOIN rec r ON r.area_key = x.area_key AND r.mes = x.mes
  LEFT JOIN desp d ON d.area_key = x.area_key AND d.mes = x.mes
  LEFT JOIN pct pc ON pc.area_key = x.area_key AND pc.mes = x.mes
  LEFT JOIN ctrl c ON c.mes = x.mes
  ORDER BY x.area_key, x.mes;
END;
$function$;

-- OPEX do escritório por mês e bloco (áreas, Controladoria, estrutura, outros), depois da
-- reclassificação de 2025, mais o que foi reclassificado e o que ficou sem pessoa.
CREATE OR REPLACE FUNCTION public.planejamento_opex_blocos_mensal(p_ano integer)
RETURNS TABLE(
  mes integer,
  areas numeric,
  controladoria numeric,
  estrutura numeric,
  outros numeric,
  total numeric,
  pessoas_reclassificadas numeric,
  pessoas_sem_match numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH pag AS (
    SELECT p.* FROM public.planejamento_pagos_ano(p_ano) p
    WHERE p.data_pagamento >= make_date(p_ano, 1, 1) AND p.data_pagamento < make_date(p_ano + 1, 1, 1)
  )
  SELECT
    g.mes,
    round(coalesce(sum(p.valor) FILTER (WHERE p.departamento IN (SELECT a.departamento FROM dl_areas a)), 0), 2),
    round(coalesce(sum(p.valor) FILTER (WHERE p.departamento = 'Operações Legais'), 0), 2),
    round(coalesce(sum(p.valor) FILTER (WHERE p.departamento IN ('Facilities', 'Financeiro', 'Marketing', 'R.H.', 'T.I.', 'Comercial')), 0), 2),
    round(coalesce(sum(p.valor) FILTER (WHERE p.departamento IS NULL OR p.departamento NOT IN (
      SELECT a.departamento FROM dl_areas a
      UNION ALL SELECT unnest(ARRAY['Operações Legais', 'Facilities', 'Financeiro', 'Marketing', 'R.H.', 'T.I.', 'Comercial'])
    )), 0), 2),
    round(coalesce(sum(p.valor), 0), 2),
    round(coalesce(sum(p.valor) FILTER (WHERE p.reclassificado), 0), 2),
    round(coalesce(sum(p.valor) FILTER (WHERE p.pessoa_sem_match), 0), 2)
  FROM generate_series(1, 12) g(mes)
  LEFT JOIN pag p ON p.mes = g.mes
  GROUP BY g.mes
  ORDER BY g.mes;
END;
$function$;

-- Pessoas: folha por competência (pagamento até o dia 15 = mês anterior), demais custos de pessoas
-- por caixa, e headcount do cadastro de RH (trabalhou ao menos um dia no mês; sem advogado parceiro).
-- area_key: as 7 áreas, 'operacoes_legais' e 'estrutura' (Facilities, Financeiro, Marketing, RH, TI, Comercial).
CREATE OR REPLACE FUNCTION public.planejamento_pessoas_mensal(p_ano integer)
RETURNS TABLE(area_key text, mes integer, folha numeric, demais_pessoas numeric, headcount integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH meses AS (
    SELECT g AS mes, make_date(p_ano, g, 1) AS ini, (make_date(p_ano, g, 1) + interval '1 month - 1 day')::date AS fim
    FROM generate_series(1, 12) g
  ),
  chaves AS (
    SELECT a.area_key, a.departamento, a.areas_rh FROM dl_areas a
    UNION ALL SELECT 'operacoes_legais', 'Operações Legais', ARRAY['Operações Legais']
    UNION ALL SELECT 'estrutura', NULL, ARRAY[]::text[]
  ),
  pag AS (
    SELECT
      p.*,
      CASE
        WHEN p.folha AND extract(day FROM p.data_pagamento) <= 15
          THEN (date_trunc('month', p.data_pagamento) - interval '1 month')::date
        ELSE date_trunc('month', p.data_pagamento)::date
      END AS competencia,
      coalesce(
        (SELECT k.area_key FROM chaves k WHERE k.departamento = p.departamento LIMIT 1),
        CASE WHEN p.departamento IN ('Facilities', 'Financeiro', 'Marketing', 'R.H.', 'T.I.', 'Comercial') THEN 'estrutura' END
      ) AS chave
    FROM public.planejamento_pagos_ano(p_ano) p
    WHERE p.subgrupo_pessoas IS NOT NULL OR p.folha
  ),
  custo AS (
    SELECT p.chave, extract(month FROM p.competencia)::integer AS mes,
      sum(p.valor) FILTER (WHERE p.folha) AS folha,
      sum(p.valor) FILTER (WHERE NOT p.folha) AS demais
    FROM pag p
    WHERE p.chave IS NOT NULL AND extract(year FROM p.competencia) = p_ano
    GROUP BY 1, 2
  ),
  hc AS (
    SELECT k.area_key, ms.mes, count(t.id)::integer AS n
    FROM chaves k
    CROSS JOIN meses ms
    LEFT JOIN sp_turnover t
      ON t.area = ANY (k.areas_rh)
     AND coalesce(t.cargo, '') NOT ILIKE '%parceiro%'
     AND t.admissao < ms.fim
     AND (t.desligamento IS NULL OR t.desligamento >= ms.ini)
    GROUP BY 1, 2
  )
  SELECT k.area_key, ms.mes,
    round(coalesce(c.folha, 0), 2),
    round(coalesce(c.demais, 0), 2),
    CASE WHEN k.area_key = 'estrutura' THEN NULL ELSE coalesce(h.n, 0) END
  FROM chaves k
  CROSS JOIN meses ms
  LEFT JOIN custo c ON c.chave = k.area_key AND c.mes = ms.mes
  LEFT JOIN hc h ON h.area_key = k.area_key AND h.mes = ms.mes
  ORDER BY k.area_key, ms.mes;
END;
$function$;

-- Horas do timesheet por área e mês (sem o recorte de área do usuário: aqui só totais).
CREATE OR REPLACE FUNCTION public.planejamento_timesheet_mensal(p_ano integer)
RETURNS TABLE(area_key text, mes integer, horas numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  SELECT
    coalesce(
      a.area_key,
      CASE
        WHEN t.area IN ('Insolvência', 'Cível | Insolvência', 'Reestruturação') THEN 'insolvencia'
        WHEN t.area IN ('Special Situations', 'Distressed Deals') THEN 'add'
        WHEN t.area = 'Operações Legais' THEN 'operacoes_legais'
        ELSE 'outras'
      END
    ),
    extract(month FROM t.data)::integer,
    round(sum(public.timesheet_minutos_linha(coalesce(t.total_horas_decimal, t.total_horas)))::numeric / 60, 2)
  FROM timesheets t
  LEFT JOIN dl_areas a ON a.departamento = t.area
  WHERE t.data >= make_date(p_ano, 1, 1) AND t.data < make_date(p_ano + 1, 1, 1)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$function$;

-- Oficializa um cenário: passa a ser a meta do ano e grava as metas por área/mês e operacionais.
CREATE OR REPLACE FUNCTION public.planejamento_oficializar(p_cenario_id uuid, p_linhas jsonb, p_operacionais jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano integer;
  v_email text := (SELECT u.email FROM auth.users u WHERE u.id = auth.uid());
BEGIN
  PERFORM public.planejamento_exigir_login();
  SELECT c.ano_alvo INTO v_ano FROM planejamento_cenarios c WHERE c.id = p_cenario_id;
  IF v_ano IS NULL THEN
    RAISE EXCEPTION 'Cenário não encontrado';
  END IF;

  PERFORM set_config('planejamento.oficializando', '1', true);
  UPDATE planejamento_cenarios SET oficial = false, oficializado_em = NULL, oficializado_por_email = NULL
  WHERE ano_alvo = v_ano AND oficial AND id <> p_cenario_id;
  UPDATE planejamento_cenarios SET oficial = true, oficializado_em = now(), oficializado_por_email = v_email
  WHERE id = p_cenario_id;
  PERFORM set_config('planejamento.oficializando', '', true);

  DELETE FROM planejamento_metas_oficiais WHERE ano = v_ano;
  INSERT INTO planejamento_metas_oficiais (
    ano, mes, area_key, receita_bruta, impostos, opex_area, controladoria, margem, inadimplencia_pct, cenario_id
  )
  SELECT v_ano, l.mes, l.area_key, coalesce(l.receita_bruta, 0), coalesce(l.impostos, 0), coalesce(l.opex_area, 0),
    coalesce(l.controladoria, 0), coalesce(l.margem, 0), l.inadimplencia_pct, p_cenario_id
  FROM jsonb_to_recordset(coalesce(p_linhas, '[]'::jsonb)) AS l(
    mes integer, area_key text, receita_bruta numeric, impostos numeric, opex_area numeric,
    controladoria numeric, margem numeric, inadimplencia_pct numeric
  );

  DELETE FROM planejamento_metas_operacionais_oficiais WHERE ano = v_ano;
  INSERT INTO planejamento_metas_operacionais_oficiais (ano, indicador, area_key, meta, unidade, cenario_id)
  SELECT v_ano, o.indicador, o.area_key, o.meta, o.unidade, p_cenario_id
  FROM jsonb_to_recordset(coalesce(p_operacionais, '[]'::jsonb)) AS o(
    indicador text, area_key text, meta numeric, unidade text
  )
  WHERE o.meta IS NOT NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION
  public.planejamento_areas(),
  public.planejamento_receita_mensal(integer),
  public.planejamento_receita_sem_area(integer),
  public.planejamento_margem_mensal(integer),
  public.planejamento_opex_blocos_mensal(integer),
  public.planejamento_pessoas_mensal(integer),
  public.planejamento_timesheet_mensal(integer),
  public.planejamento_oficializar(uuid, jsonb, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.planejamento_areas(),
  public.planejamento_receita_mensal(integer),
  public.planejamento_receita_sem_area(integer),
  public.planejamento_margem_mensal(integer),
  public.planejamento_opex_blocos_mensal(integer),
  public.planejamento_pessoas_mensal(integer),
  public.planejamento_timesheet_mensal(integer),
  public.planejamento_oficializar(uuid, jsonb, jsonb)
TO authenticated;
