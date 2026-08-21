-- Lista mestre de sessões de treinamento (SharePoint) — inclui datas futuras.

CREATE TABLE IF NOT EXISTS public.sp_treinamentos_sessoes (
  sp_id             BIGINT PRIMARY KEY,
  nome              TEXT NOT NULL,
  data              DATE NOT NULL,
  duracao_minutos   NUMERIC(10, 2),
  ministrado_por    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sp_treinamentos_sessoes_data_idx
  ON public.sp_treinamentos_sessoes (data);

COMMENT ON TABLE public.sp_treinamentos_sessoes IS
  'Espelho da lista mestre de sessões de treinamento (SharePoint). Inclui sessões futuras sem presença registrada.';

CREATE TRIGGER sp_treinamentos_sessoes_updated_at
  BEFORE UPDATE ON public.sp_treinamentos_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.sp_treinamentos_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_treinamentos_sessoes_select_authenticated
  ON public.sp_treinamentos_sessoes
  FOR SELECT
  TO authenticated
  USING (true);
