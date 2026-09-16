-- Precomputa chaves (grupo + razões sociais) das exclusões de onboarding.
-- eficiencia_onboarding_exclui era inlined e fazia JOIN em pessoas a cada
-- linha dos KPIs (SLA Protocolo ~2s sozinho; Overview 10 RPCs em paralelo
-- estourava statement_timeout).

CREATE TABLE public.eficiencia_onboarding_exclusao_chaves (
  exclusao_id uuid NOT NULL
    REFERENCES public.eficiencia_onboarding_exclusoes(id) ON DELETE CASCADE,
  chave text NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date NOT NULL,
  origem text NOT NULL CHECK (origem IN ('grupo', 'pessoa')),
  PRIMARY KEY (exclusao_id, origem, chave)
);

CREATE INDEX eficiencia_onboarding_exclusao_chaves_lookup_idx
  ON public.eficiencia_onboarding_exclusao_chaves (vigencia_inicio, vigencia_fim, chave);

COMMENT ON TABLE public.eficiencia_onboarding_exclusao_chaves IS
  'Lookup das exclusões de onboarding: chave do grupo e das razões sociais (pessoas) no período. Recalculada ao gravar a exclusão.';

ALTER TABLE public.eficiencia_onboarding_exclusao_chaves ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_refresh_chaves(p_exclusao_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.eficiencia_onboarding_exclusao_chaves
  WHERE p_exclusao_id IS NULL OR exclusao_id = p_exclusao_id;

  INSERT INTO public.eficiencia_onboarding_exclusao_chaves (
    exclusao_id, chave, vigencia_inicio, vigencia_fim, origem
  )
  SELECT e.id,
         public.eficiencia_onboarding_grupo_chave(e.grupo_cliente),
         e.vigencia_inicio,
         e.vigencia_fim,
         'grupo'
  FROM public.eficiencia_onboarding_exclusoes e
  WHERE (p_exclusao_id IS NULL OR e.id = p_exclusao_id)
    AND public.eficiencia_onboarding_grupo_chave(e.grupo_cliente) <> ''
  UNION
  SELECT e.id,
         public.eficiencia_onboarding_grupo_chave(p.nome),
         e.vigencia_inicio,
         e.vigencia_fim,
         'pessoa'
  FROM public.eficiencia_onboarding_exclusoes e
  JOIN public.pessoas p ON p.grupo_cliente = e.grupo_cliente
  WHERE (p_exclusao_id IS NULL OR e.id = p_exclusao_id)
    AND public.eficiencia_onboarding_grupo_chave(p.nome) <> '';
END;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_exclusoes_chaves_tg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  PERFORM public.eficiencia_onboarding_refresh_chaves(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER eficiencia_onboarding_exclusoes_chaves_tg
  AFTER INSERT OR UPDATE OF grupo_cliente, vigencia_inicio, vigencia_fim
  ON public.eficiencia_onboarding_exclusoes
  FOR EACH ROW
  EXECUTE FUNCTION public.eficiencia_onboarding_exclusoes_chaves_tg();

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_exclui(p_grupo text, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      s.k <> '' AND EXISTS (
        SELECT 1
        FROM public.eficiencia_onboarding_exclusao_chaves c
        WHERE p_data BETWEEN c.vigencia_inicio AND c.vigencia_fim
          AND (
            (
              c.origem = 'grupo'
              AND (
                c.chave = s.k
                OR s.k LIKE c.chave || ' %'
                OR c.chave LIKE s.k || ' %'
              )
            )
            OR (c.origem = 'pessoa' AND c.chave = s.k)
          )
      )
    FROM (SELECT public.eficiencia_onboarding_grupo_chave(p_grupo) AS k) s
    WHERE p_data IS NOT NULL
  ), false);
$$;

COMMENT ON FUNCTION public.eficiencia_onboarding_exclui(text, date) IS
  'True se o grupo/razão está em exclusão de onboarding na data. Usa lookup precomputado (sem JOIN em pessoas).';

SELECT public.eficiencia_onboarding_refresh_chaves(NULL);
