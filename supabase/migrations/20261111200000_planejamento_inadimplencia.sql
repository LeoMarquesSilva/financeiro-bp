-- Planejamento 2027: inadimplência SEM efeito colateral.
-- `receita_inadimplencia_dashboard` congela os meses encerrados do ano consultado (grava em
-- receita_inadimplencia_fechamento_mensal); o planejamento não pode chamar essa função para 2025.
-- Só leitura, com as mesmas regras do painel de Inadimplência:
--   * mês a mês: mês congelado = valor oficial do fechamento (dividido entre as áreas pela participação
--     ao vivo, receita_inadimplencia_departamento_mensal_congelado); mês sem fechamento = valor em aberto
--     hoje dos títulos vencidos no mês (receita_inadimplencia_departamento_mes);
--   * acumulado do período: receita_inadimplencia_grupos_periodo (escritório) e
--     receita_inadimplencia_grupo_departamento_periodo (por área), sobre o previsto dos meses.

DROP FUNCTION IF EXISTS public.planejamento_inadimplencia_mensal(integer);

CREATE OR REPLACE FUNCTION public.planejamento_inadimplencia_ultimo_mes(p_ano integer)
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN p_ano < extract(year FROM current_date)::integer THEN 12
    WHEN p_ano = extract(year FROM current_date)::integer THEN extract(month FROM current_date)::integer - 1
    ELSE 0
  END;
$function$;

CREATE OR REPLACE FUNCTION public.planejamento_inadimplencia_mensal(p_ano integer)
RETURNS TABLE(mes integer, area_key text, inadimplencia numeric, previsto_mes numeric, congelado boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo integer := public.planejamento_inadimplencia_ultimo_mes(p_ano);
BEGIN
  PERFORM public.planejamento_exigir_login();
  RETURN QUERY
  WITH meses AS (SELECT g AS mes FROM generate_series(1, greatest(v_ultimo, 0)) g),
  fechados AS (SELECT f.mes FROM receita_inadimplencia_fechamento_mensal f WHERE f.ano = p_ano),
  cong AS (
    SELECT c.mes, c.departamento, c.inadimplencia
    FROM public.receita_inadimplencia_departamento_mensal_congelado(p_ano, true) c
    WHERE c.mes <= v_ultimo
  ),
  vivo AS (
    SELECT ms.mes, d.departamento, d.inadimplencia
    FROM meses ms
    CROSS JOIN LATERAL public.receita_inadimplencia_departamento_mes(p_ano, ms.mes, true) d
    WHERE ms.mes NOT IN (SELECT fe.mes FROM fechados fe)
  ),
  todos AS (
    SELECT c.mes, c.departamento, c.inadimplencia, true AS congelado FROM cong c
    UNION ALL
    SELECT v.mes, v.departamento, v.inadimplencia, false FROM vivo v
  ),
  prev AS (SELECT ms.mes, public.receita_previsto_mes(p_ano, ms.mes) AS previsto FROM meses ms)
  SELECT
    t.mes,
    coalesce(a.area_key, 'outros'),
    round(sum(t.inadimplencia), 2),
    round(max(p.previsto), 2),
    bool_or(t.congelado)
  FROM todos t
  LEFT JOIN dl_areas a ON a.departamento = t.departamento
  LEFT JOIN prev p ON p.mes = t.mes
  GROUP BY t.mes, coalesce(a.area_key, 'outros')
  ORDER BY 1, 2;
END;
$function$;

-- Acumulado de jan até o último mês fechado: 'escritorio' = mesma conta do painel (por grupo de
-- cliente); demais linhas = por grupo e área (a soma das áreas pode diferir um pouco do escritório).
CREATE OR REPLACE FUNCTION public.planejamento_inadimplencia_periodo(p_ano integer)
RETURNS TABLE(area_key text, inadimplencia numeric, previsto numeric, mes_fim integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo integer := public.planejamento_inadimplencia_ultimo_mes(p_ano);
  v_previsto numeric;
BEGIN
  PERFORM public.planejamento_exigir_login();
  IF v_ultimo < 1 THEN
    RETURN;
  END IF;
  SELECT round(sum(public.receita_previsto_mes(p_ano, g)), 2) INTO v_previsto FROM generate_series(1, v_ultimo) g;
  RETURN QUERY
  SELECT 'escritorio'::text, round(coalesce(sum(g.valor), 0), 2), v_previsto, v_ultimo
  FROM public.receita_inadimplencia_grupos_periodo(p_ano, 1, v_ultimo, true) g
  UNION ALL
  SELECT coalesce(a.area_key, 'outros'), round(sum(d.inadimplencia), 2), v_previsto, v_ultimo
  FROM public.receita_inadimplencia_grupo_departamento_periodo(p_ano, 1, v_ultimo, true) d
  LEFT JOIN dl_areas a ON a.departamento = d.departamento
  GROUP BY coalesce(a.area_key, 'outros');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.planejamento_inadimplencia_mensal(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planejamento_inadimplencia_periodo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planejamento_inadimplencia_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planejamento_inadimplencia_periodo(integer) TO authenticated;
