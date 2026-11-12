-- Planejamento 2027: rateio por título da receita sem área.
--
-- Pedido do usuário (12/11/2026): na classificação da receita sem área (departamento do VIOS fora das
-- áreas: Facilities, BP…), dividir um título por % entre as áreas, porque há títulos rateados entre
-- várias áreas. Ordem de prioridade para a área de um item de receita:
--   1. departamento do VIOS que é área (dl_areas) — nada muda;
--   2. rateio do título (esta tabela): o valor do item vai para cada área × %;
--   3. classificação do cliente (planejamento_receita_classificacao): 100% numa área;
--   4. sem área.
-- O rateio vale para todos os itens (parcelas) do título, em qualquer ano. Grava pela RPC
-- planejamento_rateio_titulos_salvar, que exige soma de 100% e substitui o rateio anterior.

CREATE TABLE IF NOT EXISTS public.planejamento_receita_rateio_titulo (
  ci_titulo integer NOT NULL,
  area_key text NOT NULL REFERENCES public.dl_areas (area_key),
  pct numeric(5, 2) NOT NULL CHECK (pct > 0 AND pct <= 100),
  classificado_por uuid,
  classificado_por_email text,
  classificado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ci_titulo, area_key)
);

COMMENT ON TABLE public.planejamento_receita_rateio_titulo IS
  'Planejamento: % de cada área num título de receita sem área (soma 100% por título). Prioridade sobre a classificação do cliente.';

DROP TRIGGER IF EXISTS planejamento_rateio_titulo_autoria ON public.planejamento_receita_rateio_titulo;
CREATE TRIGGER planejamento_rateio_titulo_autoria
  BEFORE INSERT OR UPDATE ON public.planejamento_receita_rateio_titulo
  FOR EACH ROW EXECUTE FUNCTION public.planejamento_classificacao_autoria();

ALTER TABLE public.planejamento_receita_rateio_titulo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planejamento_rateio_titulo_leitura ON public.planejamento_receita_rateio_titulo;
CREATE POLICY planejamento_rateio_titulo_leitura ON public.planejamento_receita_rateio_titulo
  FOR SELECT TO authenticated USING (true);
-- Escrita só pela RPC (valida a soma de 100%).
REVOKE ALL ON public.planejamento_receita_rateio_titulo FROM anon, authenticated;
GRANT SELECT ON public.planejamento_receita_rateio_titulo TO authenticated;

-- Itens de receita com a área (e o título/item, para contar e conferir). Item rateado vira uma
-- linha por área com valor × %; a soma das linhas é o valor do item.
CREATE OR REPLACE FUNCTION public.planejamento_receita_itens_det(p_ano integer)
RETURNS TABLE(
  mes integer,
  area_key text,
  cliente text,
  departamento text,
  valor numeric,
  com_nf boolean,
  origem text,
  ci_titulo integer,
  ci_item integer,
  pct numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    extract(month FROM i.data_pagamento)::integer,
    coalesce(a.area_key, r.area_key, c.area_key, 'sem_area'),
    i.cliente,
    i.departamento,
    public.receita_item_recebido_liquido(i) * coalesce(r.pct, 100) / 100,
    trim(coalesce(i.nfse_titulo, '')) ~ '^[0-9]+$',
    CASE
      WHEN a.area_key IS NOT NULL THEN 'departamento'
      WHEN r.area_key IS NOT NULL THEN 'rateio_titulo'
      WHEN c.area_key IS NOT NULL THEN 'classificado'
      ELSE 'sem_area'
    END,
    i.ci_titulo,
    i.ci_item,
    coalesce(r.pct, 100)
  FROM financeiro_parcelas_itens i
  LEFT JOIN dl_areas a ON a.departamento = i.departamento
  LEFT JOIN planejamento_receita_rateio_titulo r ON a.area_key IS NULL AND r.ci_titulo = i.ci_titulo
  LEFT JOIN planejamento_receita_classificacao c ON a.area_key IS NULL AND r.ci_titulo IS NULL AND c.cliente = i.cliente
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento >= make_date(p_ano, 1, 1)
    AND i.data_pagamento < make_date(p_ano + 1, 1, 1);
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_receita_itens_det(integer) FROM PUBLIC, anon, authenticated;

-- Mesmo retorno de antes: Receita, Margem e a lista de sem área passam a respeitar o rateio.
CREATE OR REPLACE FUNCTION public.planejamento_receita_itens(p_ano integer)
RETURNS TABLE(mes integer, area_key text, cliente text, departamento text, valor numeric, com_nf boolean, origem text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT d.mes, d.area_key, d.cliente, d.departamento, d.valor, d.com_nf, d.origem
  FROM public.planejamento_receita_itens_det(p_ano) d;
$function$;

-- Lista de clientes com receita sem área: passa a mostrar o que ainda falta e o que foi rateado por título.
DROP FUNCTION IF EXISTS public.planejamento_receita_sem_area(integer);
CREATE FUNCTION public.planejamento_receita_sem_area(p_ano integer)
RETURNS TABLE(
  cliente text,
  departamentos_vios text,
  total numeric,
  titulos integer,
  sugestao_area_key text,
  area_key text,
  classificado_por_email text,
  classificado_em timestamp with time zone,
  pendente numeric,
  rateado numeric,
  titulos_rateados integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH base AS (
    SELECT d.cliente, d.departamento, d.valor, d.origem, d.ci_titulo, d.ci_item
    FROM public.planejamento_receita_itens_det(p_ano) d
    WHERE d.origem <> 'departamento'
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
    count(DISTINCT b.ci_item)::integer,
    s.area_key,
    c.area_key,
    c.classificado_por_email,
    c.classificado_em,
    round(coalesce(sum(b.valor) FILTER (WHERE b.origem = 'sem_area'), 0), 2),
    round(coalesce(sum(b.valor) FILTER (WHERE b.origem = 'rateio_titulo'), 0), 2),
    (count(DISTINCT b.ci_titulo) FILTER (WHERE b.origem = 'rateio_titulo'))::integer
  FROM base b
  LEFT JOIN sug s ON s.cliente = b.cliente
  LEFT JOIN planejamento_receita_classificacao c ON c.cliente = b.cliente
  GROUP BY b.cliente, s.area_key, c.area_key, c.classificado_por_email, c.classificado_em
  ORDER BY 3 DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_receita_sem_area(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planejamento_receita_sem_area(integer) TO authenticated;

-- Grava o mesmo rateio em um ou mais títulos (substitui o anterior). p_linhas = [{area_key, pct}],
-- soma 100. Lista vazia apaga o rateio: o título volta a seguir a classificação do cliente.
CREATE OR REPLACE FUNCTION public.planejamento_rateio_titulos_salvar(p_titulos integer[], p_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_soma numeric;
  v_n integer;
  v_distintas integer;
BEGIN
  PERFORM public.planejamento_exigir_login();
  IF p_titulos IS NULL OR cardinality(p_titulos) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um título';
  END IF;
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Rateio inválido';
  END IF;
  SELECT coalesce(sum(x.pct), 0), count(*), count(DISTINCT x.area_key)
    INTO v_soma, v_n, v_distintas
  FROM jsonb_to_recordset(p_linhas) AS x(area_key text, pct numeric);
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_linhas) AS x(area_key text, pct numeric)
    WHERE x.pct IS NULL OR x.pct <= 0 OR x.pct > 100 OR round(x.pct, 2) <> x.pct
       OR NOT EXISTS (SELECT 1 FROM dl_areas a WHERE a.area_key = x.area_key)
  ) THEN
    RAISE EXCEPTION 'Área ou percentual inválido (use até 2 casas decimais)';
  END IF;
  IF v_distintas <> v_n THEN
    RAISE EXCEPTION 'A mesma área aparece mais de uma vez no rateio';
  END IF;
  IF v_n > 0 AND v_soma <> 100 THEN
    RAISE EXCEPTION 'O rateio precisa somar 100%% (soma atual: %)', v_soma::text || '%';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_titulos) AS t(ci)
    WHERE NOT EXISTS (
      SELECT 1 FROM financeiro_parcelas_itens i
      WHERE i.ci_titulo = t.ci
        AND NOT EXISTS (SELECT 1 FROM dl_areas a WHERE a.departamento = i.departamento)
    )
  ) THEN
    RAISE EXCEPTION 'Título não encontrado ou já está num departamento de área';
  END IF;

  DELETE FROM planejamento_receita_rateio_titulo r WHERE r.ci_titulo = ANY (p_titulos);
  INSERT INTO planejamento_receita_rateio_titulo (ci_titulo, area_key, pct)
  SELECT DISTINCT t.ci, x.area_key, x.pct
  FROM unnest(p_titulos) AS t(ci)
  CROSS JOIN jsonb_to_recordset(p_linhas) AS x(area_key text, pct numeric);
  RETURN cardinality(p_titulos);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_rateio_titulos_salvar(integer[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planejamento_rateio_titulos_salvar(integer[], jsonb) TO authenticated;
