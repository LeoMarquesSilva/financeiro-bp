-- Heartbeat leve para avisar o frontend quando cargas externas alterarem dados.
-- Evita assinar tabelas volumosas no Realtime e disparar milhares de eventos.

CREATE TABLE public.sioe_sync_estado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  versao bigint NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'inicial',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sioe_sync_estado (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sioe_sync_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read SIOE sync estado"
  ON public.sioe_sync_estado
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.sioe_sync_estado TO authenticated;
GRANT UPDATE ON public.sioe_sync_estado TO service_role;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.touch_sioe_sync_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.sioe_sync_estado (id, versao, fonte, atualizado_em)
  VALUES (1, 1, TG_TABLE_NAME, now())
  ON CONFLICT (id) DO UPDATE
  SET
    versao = public.sioe_sync_estado.versao + 1,
    fonte = EXCLUDED.fonte,
    atualizado_em = EXCLUDED.atualizado_em;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.touch_sioe_sync_estado() FROM PUBLIC;

CREATE TRIGGER financeiro_parcelas_sync_estado
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_parcelas
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.touch_sioe_sync_estado();

CREATE TRIGGER financeiro_parcelas_itens_sync_estado
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_parcelas_itens
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.touch_sioe_sync_estado();

CREATE TRIGGER pessoas_sync_estado
  AFTER INSERT OR UPDATE OR DELETE ON public.pessoas
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.touch_sioe_sync_estado();

CREATE OR REPLACE FUNCTION public.registrar_sioe_sync(p_fonte text)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.sioe_sync_estado
  SET
    versao = versao + 1,
    fonte = p_fonte,
    atualizado_em = now()
  WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.registrar_sioe_sync(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_sioe_sync(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sioe_sync(text) TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public.sioe_sync_estado;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON TABLE public.sioe_sync_estado IS
  'Heartbeat Realtime das cargas VIOS e SharePoint usadas pelo SIOE.';
