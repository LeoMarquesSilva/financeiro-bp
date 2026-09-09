-- De × Para de grupos OPEX: nomenclatura de anos anteriores → grupo atual.
-- Evita discrepância na comparação YoY quando o plano de contas mudou (ex.: 2025 → 2026).

CREATE TABLE public.opex_grupo_de_para (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_origem    integer NOT NULL CHECK (ano_origem >= 2000 AND ano_origem <= 2100),
  nome_origem   text NOT NULL,
  ano_destino   integer NOT NULL CHECK (ano_destino >= 2000 AND ano_destino <= 2100),
  nome_destino  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opex_grupo_de_para_anos_chk CHECK (ano_origem < ano_destino),
  CONSTRAINT opex_grupo_de_para_nomes_chk CHECK (
    length(trim(nome_origem)) > 0 AND length(trim(nome_destino)) > 0
  ),
  CONSTRAINT opex_grupo_de_para_unique UNIQUE (ano_origem, nome_origem, ano_destino)
);

CREATE INDEX opex_grupo_de_para_anos_idx
  ON public.opex_grupo_de_para (ano_origem, ano_destino);

COMMENT ON TABLE public.opex_grupo_de_para IS
  'Mapeamento De × Para de grupo_conta: nome usado no ano origem para o nome vigente no ano destino. Usado na comparação YoY.';

CREATE OR REPLACE FUNCTION public.opex_grupo_de_para_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.nome_origem := trim(NEW.nome_origem);
  NEW.nome_destino := trim(NEW.nome_destino);
  RETURN NEW;
END;
$$;

CREATE TRIGGER opex_grupo_de_para_updated_at
  BEFORE INSERT OR UPDATE ON public.opex_grupo_de_para
  FOR EACH ROW
  EXECUTE FUNCTION public.opex_grupo_de_para_updated_at();

ALTER TABLE public.opex_grupo_de_para ENABLE ROW LEVEL SECURITY;

CREATE POLICY opex_grupo_de_para_select ON public.opex_grupo_de_para
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY opex_grupo_de_para_write ON public.opex_grupo_de_para
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.opex_grupo_de_para TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.opex_grupo_de_para TO authenticated;
