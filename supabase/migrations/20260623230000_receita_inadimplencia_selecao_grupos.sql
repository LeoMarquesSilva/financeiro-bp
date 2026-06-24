-- Persiste seleção manual de grupos (mensal e por período) na inadimplência da Receita.

CREATE TABLE IF NOT EXISTS public.receita_inadimplencia_selecao_mensal (
  ano integer NOT NULL,
  mes integer NOT NULL,
  grupos_incluidos text[] NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes),
  CONSTRAINT receita_inadimplencia_selecao_mensal_mes_chk CHECK (mes >= 1 AND mes <= 12)
);

COMMENT ON TABLE public.receita_inadimplencia_selecao_mensal IS
  'Grupos incluídos na inadimplência mensal após ajuste manual na UI.';

CREATE TABLE IF NOT EXISTS public.receita_inadimplencia_selecao_periodo (
  ano integer NOT NULL,
  mes_inicio integer NOT NULL,
  mes_fim integer NOT NULL,
  grupos_incluidos text[] NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes_inicio, mes_fim),
  CONSTRAINT receita_inadimplencia_selecao_periodo_mes_chk CHECK (
    mes_inicio >= 1 AND mes_inicio <= 12 AND mes_fim >= 1 AND mes_fim <= 12 AND mes_fim >= mes_inicio
  )
);

COMMENT ON TABLE public.receita_inadimplencia_selecao_periodo IS
  'Grupos incluídos no KPI acumulado do período após ajuste manual na UI.';

ALTER TABLE public.receita_inadimplencia_selecao_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_inadimplencia_selecao_periodo ENABLE ROW LEVEL SECURITY;

CREATE POLICY receita_inadimplencia_selecao_mensal_select
  ON public.receita_inadimplencia_selecao_mensal FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY receita_inadimplencia_selecao_mensal_all
  ON public.receita_inadimplencia_selecao_mensal FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY receita_inadimplencia_selecao_periodo_select
  ON public.receita_inadimplencia_selecao_periodo FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY receita_inadimplencia_selecao_periodo_all
  ON public.receita_inadimplencia_selecao_periodo FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_salvar_selecao_mes(
  p_ano integer,
  p_mes integer,
  p_grupos_incluidos text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês inválido: %', p_mes;
  END IF;

  INSERT INTO public.receita_inadimplencia_selecao_mensal (ano, mes, grupos_incluidos, atualizado_em)
  VALUES (p_ano, p_mes, COALESCE(p_grupos_incluidos, '{}'), now())
  ON CONFLICT (ano, mes) DO UPDATE SET
    grupos_incluidos = EXCLUDED.grupos_incluidos,
    atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_selecoes_mes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  mes integer,
  grupos_incluidos text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.mes, s.grupos_incluidos
  FROM public.receita_inadimplencia_selecao_mensal s
  WHERE s.ano = p_ano
    AND s.mes >= p_mes_inicio
    AND s.mes <= p_mes_fim
  ORDER BY s.mes;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_salvar_selecao_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_grupos_incluidos text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mes_inicio < 1 OR p_mes_fim > 12 OR p_mes_fim < p_mes_inicio THEN
    RAISE EXCEPTION 'Período inválido: % a %', p_mes_inicio, p_mes_fim;
  END IF;

  INSERT INTO public.receita_inadimplencia_selecao_periodo (ano, mes_inicio, mes_fim, grupos_incluidos, atualizado_em)
  VALUES (p_ano, p_mes_inicio, p_mes_fim, COALESCE(p_grupos_incluidos, '{}'), now())
  ON CONFLICT (ano, mes_inicio, mes_fim) DO UPDATE SET
    grupos_incluidos = EXCLUDED.grupos_incluidos,
    atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_selecao_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.grupos_incluidos
  FROM public.receita_inadimplencia_selecao_periodo s
  WHERE s.ano = p_ano
    AND s.mes_inicio = p_mes_inicio
    AND s.mes_fim = p_mes_fim;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_salvar_selecao_mes(integer, integer, text[]) IS
  'Grava grupos incluídos na inadimplência de um mês (ajuste manual).';

COMMENT ON FUNCTION public.receita_inadimplencia_selecoes_mes_periodo(integer, integer, integer) IS
  'Lista seleções mensais salvas no intervalo.';

COMMENT ON FUNCTION public.receita_inadimplencia_salvar_selecao_periodo(integer, integer, integer, text[]) IS
  'Grava grupos incluídos no KPI acumulado do período.';

COMMENT ON FUNCTION public.receita_inadimplencia_selecao_periodo(integer, integer, integer) IS
  'Retorna grupos incluídos salvos para o período, ou NULL se não houver.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_salvar_selecao_mes(integer, integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_selecoes_mes_periodo(integer, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_salvar_selecao_periodo(integer, integer, integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_selecao_periodo(integer, integer, integer) TO anon, authenticated;
