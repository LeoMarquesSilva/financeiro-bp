-- Marketing / Instagram Insights no dashboard de Operações Legais.
-- O token da Meta permanece em Supabase Secrets e nunca é exposto ao cliente Vite.

CREATE TABLE public.instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_media_id text NOT NULL UNIQUE,
  caption text,
  media_type text,
  media_product_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  area text,
  areas text[] NOT NULL DEFAULT '{}',
  solicitante_id uuid,
  solicitante text,
  solicitantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  skip_participants boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  total_interactions integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  reposts integer NOT NULL DEFAULT 0,
  profile_activity integer NOT NULL DEFAULT 0,
  link_clicks integer NOT NULL DEFAULT 0,
  reels_avg_watch_time bigint NOT NULL DEFAULT 0,
  reels_total_watch_time bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX instagram_posts_published_at_idx ON public.instagram_posts (published_at DESC);
CREATE INDEX instagram_posts_areas_idx ON public.instagram_posts USING gin (areas);
CREATE INDEX instagram_posts_tags_idx ON public.instagram_posts USING gin (tags);

CREATE TABLE public.instagram_account_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  followers_count integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  profile_picture_url text,
  biography text,
  website text,
  follows_count integer,
  name text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (username, fetched_at)
);

CREATE INDEX instagram_account_stats_fetched_at_idx
  ON public.instagram_account_stats (fetched_at DESC);

CREATE TABLE public.instagram_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_story_id text NOT NULL UNIQUE,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  reach integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  total_interactions integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  nav_taps_forward integer NOT NULL DEFAULT 0,
  nav_taps_back integer NOT NULL DEFAULT 0,
  nav_exits integer NOT NULL DEFAULT 0,
  nav_swipe_forward integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX instagram_stories_published_at_idx ON public.instagram_stories (published_at DESC);

CREATE TABLE public.instagram_account_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  reach integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  reach_followers integer NOT NULL DEFAULT 0,
  reach_non_followers integer NOT NULL DEFAULT 0,
  accounts_engaged integer NOT NULL DEFAULT 0,
  total_interactions integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  unfollows integer NOT NULL DEFAULT 0,
  profile_links_taps integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX instagram_account_insights_date_idx ON public.instagram_account_insights (date DESC);

CREATE TABLE public.instagram_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('followers', 'engaged', 'reached')),
  breakdown text NOT NULL CHECK (breakdown IN ('age', 'gender', 'city', 'country')),
  label text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, breakdown, label)
);

CREATE INDEX instagram_demographics_kind_breakdown_idx
  ON public.instagram_demographics (kind, breakdown);

CREATE TABLE public.instagram_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.instagram_settings (key, value)
VALUES ('monthly_post_goal', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_has_operacoes_legais()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE lower(tm.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND tm.is_active IS DISTINCT FROM false
      AND (
        tm.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.team_member_module_access access
          WHERE access.team_member_id = tm.id
            AND access.module_key = 'operacoes-legais'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_marketing()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE lower(tm.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND tm.is_active IS DISTINCT FROM false
      AND (tm.role = 'admin' OR lower(trim(tm.area)) = 'marketing')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_operacoes_legais() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_manage_marketing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_operacoes_legais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_marketing() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_instagram_post_links(
  p_post_id uuid,
  p_areas text[],
  p_solicitantes jsonb,
  p_skip_participants boolean DEFAULT false
)
RETURNS public.instagram_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_areas text[];
  v_solicitantes jsonb;
  v_first jsonb;
  v_result public.instagram_posts;
BEGIN
  IF NOT public.current_user_can_manage_marketing() THEN
    RAISE EXCEPTION 'Sem permissão para editar vínculos de Marketing';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT trim(value)) FILTER (WHERE trim(value) <> ''), '{}')
  INTO v_areas
  FROM unnest(COALESCE(p_areas, '{}')) value;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO v_solicitantes
  FROM jsonb_array_elements(COALESCE(p_solicitantes, '[]'::jsonb)) item
  WHERE NULLIF(trim(item ->> 'id'), '') IS NOT NULL
    AND NULLIF(trim(item ->> 'name'), '') IS NOT NULL;

  v_first := v_solicitantes -> 0;

  UPDATE public.instagram_posts
  SET areas = v_areas,
      area = v_areas[1],
      solicitantes = v_solicitantes,
      solicitante_id = CASE
        WHEN v_first IS NULL THEN NULL
        WHEN (v_first ->> 'id') ~* '^[0-9a-f-]{36}$' THEN (v_first ->> 'id')::uuid
        ELSE NULL
      END,
      solicitante = v_first ->> 'name',
      skip_participants = COALESCE(p_skip_participants, false)
  WHERE id = p_post_id
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Post não encontrado';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_instagram_post_links(uuid, text[], jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_instagram_post_links(uuid, text[], jsonb, boolean) TO authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'instagram_posts',
    'instagram_account_stats',
    'instagram_stories',
    'instagram_account_insights',
    'instagram_demographics',
    'instagram_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_user_has_operacoes_legais())',
      table_name || '_select_ops_legais',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_service_role_all',
      table_name
    );
  END LOOP;
END;
$$;

GRANT SELECT ON public.instagram_posts TO authenticated;
GRANT SELECT ON public.instagram_account_stats TO authenticated;
GRANT SELECT ON public.instagram_stories TO authenticated;
GRANT SELECT ON public.instagram_account_insights TO authenticated;
GRANT SELECT ON public.instagram_demographics TO authenticated;
GRANT SELECT ON public.instagram_settings TO authenticated;

-- A URL e o segredo ficam no Vault, nunca no SQL versionado:
-- select vault.create_secret('https://<project>.supabase.co/functions/v1/instagram-sync', 'instagram_sync_url');
-- select vault.create_secret('<segredo-forte>', 'instagram_sync_cron_secret');
-- select vault.create_secret('<publishable-ou-anon-key>', 'supabase_publishable_key');
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'instagram-sync-six-hours';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
  PERFORM cron.schedule(
    'instagram-sync-six-hours',
    '0 */6 * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'instagram_sync_url' LIMIT 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_publishable_key' LIMIT 1),
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'instagram_sync_cron_secret' LIMIT 1)
        ),
        body := jsonb_build_object(
          'action', 'sync',
          'since', to_char(now() - interval '35 days', 'YYYY-MM-DD') || 'T00:00:00.000Z'
        ),
        timeout_milliseconds := 120000
      );
    $cron$
  );
END;
$$;

COMMENT ON TABLE public.instagram_posts IS
  'Posts e métricas Instagram do módulo Marketing em Operações Legais.';
COMMENT ON FUNCTION public.current_user_can_manage_marketing() IS
  'Admin ativo ou usuário ativo cuja área em team_members seja Marketing.';
