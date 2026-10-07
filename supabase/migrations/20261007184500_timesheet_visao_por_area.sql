-- Módulo Timesheet: visão agregada por área, com recorte pelo nível do usuário.
-- Admin e sócio do escritório (área Sócio) veem todas as áreas.
-- Demais níveis ficam na área do colaborador (Reestruturação inclui Insolvência e Cível | Insolvência).

ALTER TABLE public.team_member_module_access
  DROP CONSTRAINT IF EXISTS team_member_module_access_module_key_check;

ALTER TABLE public.team_member_module_access
  ADD CONSTRAINT team_member_module_access_module_key_check
  CHECK (module_key IN (
    'inadimplencia',
    'escritorio',
    'cobranca',
    'receita',
    'opex',
    'eficiencia',
    'operacoes-legais',
    'timesheet',
    'gestores',
    'configuracoes'
  ));

CREATE INDEX IF NOT EXISTS idx_timesheets_data_area
  ON public.timesheets (data, area);

-- Áreas do VIOS que correspondem à área do colaborador no SIOE.
CREATE OR REPLACE FUNCTION public.timesheet_areas_da_pessoa(p_area text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_area, '')) = '' THEN NULL
    WHEN p_area IN ('Reestruturação', 'Insolvência') THEN ARRAY['Insolvência', 'Cível | Insolvência']::text[]
    WHEN p_area = 'Cível' THEN ARRAY['Cível']::text[]
    WHEN p_area IN ('Contratos', 'Societário e Contratos') THEN ARRAY['Contratos']::text[]
    WHEN p_area = 'Operações Legais' THEN ARRAY['Operações Legais']::text[]
    WHEN p_area = 'Recuperação de Crédito' THEN ARRAY['Recuperação de Crédito']::text[]
    WHEN p_area = 'Trabalhista' THEN ARRAY['Trabalhista']::text[]
    WHEN p_area = 'Tributário' THEN ARRAY['Tributário']::text[]
    WHEN p_area IN ('Distressed Deals', 'Special Situations') THEN ARRAY['Special Situations']::text[]
    WHEN p_area = 'Sócio' THEN NULL
    ELSE ARRAY[p_area]::text[]
  END;
$$;

-- todas = true libera qualquer área. areas vazio sem todas = sem dado.
CREATE OR REPLACE FUNCTION public.timesheet_escopo_areas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
  v_local text := split_part(v_email, '@', 1);
  v_area text;
  v_nivel text;
  v_mapped text[];
BEGIN
  IF public.current_user_is_admin() THEN
    RETURN jsonb_build_object('todas', true, 'areas', '[]'::jsonb);
  END IF;

  SELECT c.area, c.nivel_hierarquico
    INTO v_area, v_nivel
  FROM public.colaboradores c
  WHERE c.is_active
    AND v_email <> ''
    AND (
      lower(btrim(c.email)) = v_email
      OR split_part(lower(btrim(COALESCE(c.email, ''))), '@', 1) = v_local
    )
  ORDER BY (lower(btrim(c.email)) = v_email) DESC, c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_area IS NULL THEN
    SELECT NULLIF(btrim(tm.area), '')
      INTO v_area
    FROM public.team_members tm
    WHERE lower(btrim(tm.email)) = v_email
      AND COALESCE(tm.is_active, true)
    LIMIT 1;
  END IF;

  IF COALESCE(v_nivel, '') = 'socio' AND btrim(COALESCE(v_area, '')) IN ('Sócio', '') THEN
    RETURN jsonb_build_object('todas', true, 'areas', '[]'::jsonb);
  END IF;

  v_mapped := public.timesheet_areas_da_pessoa(v_area);
  IF v_mapped IS NULL THEN
    RETURN jsonb_build_object('todas', false, 'areas', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object('todas', false, 'areas', to_jsonb(v_mapped));
END;
$$;

CREATE OR REPLACE FUNCTION public.timesheet_visao(p_ano integer, p_areas text[] DEFAULT NULL)
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
    'por_area', '[]'::jsonb
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
    ),
    totais AS (
      SELECT
        COALESCE(sum(minutos), 0)::bigint AS minutos,
        count(*)::int AS lancamentos,
        count(DISTINCT colaborador) FILTER (WHERE colaborador <> 'Sem responsável')::int AS colaboradores,
        count(DISTINCT grupo) FILTER (WHERE grupo <> 'Sem grupo')::int AS grupos
      FROM base
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
          FROM base
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
          FROM base
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
          FROM base
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
          FROM base
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
          FROM base
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
            CASE WHEN area_key = '__sem_area__' THEN 'Sem área' ELSE area_key END AS nome,
            sum(minutos)::bigint AS minutos,
            count(*)::int AS lancamentos
          FROM base
          GROUP BY area_key
          ORDER BY sum(minutos) DESC
        ) s
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.timesheet_areas_da_pessoa(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.timesheet_escopo_areas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.timesheet_visao(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.timesheet_areas_da_pessoa(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.timesheet_escopo_areas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.timesheet_visao(integer, text[]) TO authenticated;

UPDATE public.app_settings
SET value =
  jsonb_set(
    jsonb_set(
      value,
      '{admin}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x), '[]'::jsonb)
        FROM (
          SELECT DISTINCT jsonb_array_elements_text(value -> 'admin') AS x
          UNION
          SELECT '/financeiro/timesheet'
        ) s
      )
    ),
    '{coordenador}',
    (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT jsonb_array_elements_text(COALESCE(value -> 'coordenador', '[]'::jsonb)) AS x
        UNION
        SELECT '/financeiro/timesheet'
      ) s
    )
  )
WHERE key = 'role_route_access_defaults';
