-- Racional do Timesheet: lançamentos linha a linha no mesmo recorte de timesheet_visao
-- (ano, áreas permitidas, meses, responsável). Paginado por p_offset/p_limit para o export em Excel.

CREATE OR REPLACE FUNCTION public.timesheet_racional(
  p_ano integer,
  p_areas text[] DEFAULT NULL,
  p_meses integer[] DEFAULT NULL,
  p_colaborador text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10000
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
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 10000), 1), 20000);
BEGIN
  IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2100 THEN
    RETURN '[]'::jsonb;
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
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        t.id,
        t.data,
        CASE
          WHEN NULLIF(btrim(t.area), '') IS NULL THEN 'Sem área'
          WHEN btrim(t.area) IN ('Insolvência', 'Cível | Insolvência') THEN 'Reestruturação'
          ELSE btrim(t.area)
        END AS area,
        COALESCE(NULLIF(btrim(t.colaborador), ''), 'Sem responsável') AS colaborador,
        NULLIF(btrim(t.tipo_apontamento), '') AS tipo_apontamento,
        NULLIF(btrim(t.tipo_tarefa), '') AS tipo_tarefa,
        NULLIF(btrim(t.grupo_cliente), '') AS grupo_cliente,
        NULLIF(btrim(t.cliente), '') AS cliente,
        t.ci,
        NULLIF(btrim(t.nro_processo), '') AS nro_processo,
        NULLIF(btrim(t.parte_contraria), '') AS parte_contraria,
        left(NULLIF(btrim(t.descricao), ''), 32000) AS descricao,
        NULLIF(btrim(t.hora_inicial), '') AS hora_inicial,
        NULLIF(btrim(t.hora_final), '') AS hora_final,
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
    pagina AS (
      SELECT *
      FROM base
      WHERE v_colaborador IS NULL
         OR lower(colaborador) = lower(v_colaborador)
      ORDER BY data, colaborador, id
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'data', p.data,
        'area', p.area,
        'colaborador', p.colaborador,
        'tipo_apontamento', p.tipo_apontamento,
        'tipo_tarefa', p.tipo_tarefa,
        'grupo_cliente', p.grupo_cliente,
        'cliente', p.cliente,
        'ci', p.ci,
        'nro_processo', p.nro_processo,
        'parte_contraria', p.parte_contraria,
        'descricao', p.descricao,
        'hora_inicial', p.hora_inicial,
        'hora_final', p.hora_final,
        'minutos', p.minutos
      ) ORDER BY p.data, p.colaborador, p.id
    ), '[]'::jsonb)
    FROM pagina p
  );
END;
$$;

REVOKE ALL ON FUNCTION public.timesheet_racional(integer, text[], integer[], text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.timesheet_racional(integer, text[], integer[], text, integer, integer) TO authenticated;
