-- Recorte opcional por responsável (nome do colaborador no timesheet).

DROP FUNCTION IF EXISTS public.timesheet_visao(integer, text[], integer[]);

CREATE OR REPLACE FUNCTION public.timesheet_visao(
  p_ano integer,
  p_areas text[] DEFAULT NULL,
  p_meses integer[] DEFAULT NULL,
  p_colaborador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escopo jsonb := public.timesheet_escopo_areas();
  v_todas boolean := COALESCE((v_escopo ->> 'todas')::boolean, false);
  v_allowed text[];
  v_filtro text[];
  v_meses integer[] := CASE
    WHEN p_meses IS NULL OR cardinality(p_meses) = 0 THEN NULL
    ELSE p_meses
  END;
  v_colaborador text := NULLIF(btrim(COALESCE(p_colaborador, '')), '');
  v_vazio jsonb := jsonb_build_object(
    'minutos', 0,
    'lancamentos', 0,
    'colaboradores', 0,
    'grupos', 0,
    'por_mes', '[]'::jsonb,
    'por_colaborador', '[]'::jsonb,
    'por_tipo_apontamento', '[]'::jsonb,
    'por_tipo_tarefa', '[]'::jsonb,
    'por_grupo', '[]'::jsonb,
    'por_area', '[]'::jsonb,
    'responsaveis', '[]'::jsonb
  );
BEGIN
  IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2100 THEN
    RETURN v_vazio;
  END IF;

  IF v_todas THEN
    v_filtro := p_areas;
  ELSE
    SELECT COALESCE(array_agg(x), ARRAY[]::text[])
      INTO v_allowed
    FROM jsonb_array_elements_text(COALESCE(v_escopo -> 'areas', '[]'::jsonb)) AS t(x);

    IF p_areas IS NULL THEN
      v_filtro := v_allowed;
    ELSE
      SELECT COALESCE(array_agg(DISTINCT a), ARRAY[]::text[])
        INTO v_filtro
      FROM unnest(p_areas) AS a
      WHERE a = ANY (v_allowed);
    END IF;

    IF COALESCE(cardinality(v_filtro), 0) = 0 THEN
      RETURN v_vazio;
    END IF;
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        COALESCE(NULLIF(btrim(t.area), ''), '__sem_area__') AS area_key,
        CASE
          WHEN NULLIF(btrim(t.area), '') IS NULL THEN 'Sem área'
          WHEN btrim(t.area) IN ('Insolvência', 'Cível | Insolvência') THEN 'Reestruturação'
          ELSE btrim(t.area)
        END AS area_nome,
        COALESCE(NULLIF(btrim(t.colaborador), ''), 'Sem responsável') AS colaborador,
        COALESCE(NULLIF(btrim(t.tipo_apontamento), ''), 'Sem tipo') AS tipo_apontamento,
        COALESCE(NULLIF(btrim(t.tipo_tarefa), ''), 'Sem tipo') AS tipo_tarefa,
        COALESCE(NULLIF(btrim(t.grupo_cliente), ''), 'Sem grupo') AS grupo,
        EXTRACT(MONTH FROM t.data)::int AS mes,
        public.timesheet_minutos_linha(COALESCE(t.total_horas_decimal, t.total_horas)) AS minutos
      FROM public.timesheets t
      WHERE t.data >= make_date(p_ano, 1, 1)
        AND t.data < make_date(p_ano + 1, 1, 1)
        AND (
          v_filtro IS NULL
          OR COALESCE(NULLIF(btrim(t.area), ''), '__sem_area__') = ANY (v_filtro)
        )
        AND (v_meses IS NULL OR EXTRACT(MONTH FROM t.data)::int = ANY (v_meses))
    ),
    recorte AS (
      SELECT *
      FROM base
      WHERE v_colaborador IS NULL
         OR lower(colaborador) = lower(v_colaborador)
    ),
    totais AS (
      SELECT
        COALESCE(sum(minutos), 0)::bigint AS minutos,
        count(*)::int AS lancamentos,
        count(DISTINCT colaborador) FILTER (WHERE colaborador <> 'Sem responsável')::int AS colaboradores,
        count(DISTINCT grupo) FILTER (WHERE grupo <> 'Sem grupo')::int AS grupos
      FROM recorte
    )
    SELECT jsonb_build_object(
      'minutos', (SELECT minutos FROM totais),
      'lancamentos', (SELECT lancamentos FROM totais),
      'colaboradores', (SELECT colaboradores FROM totais),
      'grupos', (SELECT grupos FROM totais),
      'por_mes', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'mes', m.mes,
            'minutos', COALESCE(b.minutos, 0),
            'lancamentos', COALESCE(b.lancamentos, 0)
          ) ORDER BY m.mes
        ), '[]'::jsonb)
        FROM generate_series(1, 12) AS m(mes)
        LEFT JOIN (
          SELECT mes, sum(minutos)::bigint AS minutos, count(*)::int AS lancamentos
          FROM recorte
          GROUP BY mes
        ) b ON b.mes = m.mes
      ),
      'por_colaborador', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('nome', nome, 'minutos', minutos, 'lancamentos', lancamentos)
          ORDER BY minutos DESC
        ), '[]'::jsonb)
        FROM (
          SELECT colaborador AS nome, sum(minutos)::bigint AS minutos, count(*)::int AS lancamentos
          FROM recorte
          GROUP BY colaborador
          ORDER BY sum(minutos) DESC
          LIMIT 40
        ) s
      ),
      'por_tipo_apontamento', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('nome', nome, 'minutos', minutos, 'lancamentos', lancamentos)
          ORDER BY minutos DESC
        ), '[]'::jsonb)
        FROM (
          SELECT tipo_apontamento AS nome, sum(minutos)::bigint AS minutos, count(*)::int AS lancamentos
          FROM recorte
          GROUP BY tipo_apontamento
          ORDER BY sum(minutos) DESC
          LIMIT 40
        ) s
      ),
      'por_tipo_tarefa', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('nome', nome, 'minutos', minutos, 'lancamentos', lancamentos)
          ORDER BY minutos DESC
        ), '[]'::jsonb)
        FROM (
          SELECT tipo_tarefa AS nome, sum(minutos)::bigint AS minutos, count(*)::int AS lancamentos
          FROM recorte
          GROUP BY tipo_tarefa
          ORDER BY sum(minutos) DESC
          LIMIT 40
        ) s
      ),
      'por_grupo', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('nome', nome, 'minutos', minutos, 'lancamentos', lancamentos)
          ORDER BY minutos DESC
        ), '[]'::jsonb)
        FROM (
          SELECT grupo AS nome, sum(minutos)::bigint AS minutos, count(*)::int AS lancamentos
          FROM recorte
          GROUP BY grupo
          ORDER BY sum(minutos) DESC
          LIMIT 40
        ) s
      ),
      'por_area', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('nome', nome, 'minutos', minutos, 'lancamentos', lancamentos)
          ORDER BY minutos DESC
        ), '[]'::jsonb)
        FROM (
          SELECT
            area_nome AS nome,
            sum(minutos)::bigint AS minutos,
            count(*)::int AS lancamentos
          FROM recorte
          GROUP BY area_nome
          ORDER BY sum(minutos) DESC
        ) s
      ),
      'responsaveis', (
        SELECT COALESCE(jsonb_agg(nome ORDER BY nome), '[]'::jsonb)
        FROM (
          SELECT DISTINCT colaborador AS nome
          FROM base
          WHERE colaborador <> 'Sem responsável'
        ) s
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.timesheet_visao(integer, text[], integer[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.timesheet_visao(integer, text[], integer[], text) TO authenticated;
