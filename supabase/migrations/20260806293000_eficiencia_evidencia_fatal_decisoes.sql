-- Auditoria de evidência FATAL (RESPONSUM → SIOE).
-- Recebe a decisão do Finalizar no RESPONSUM (Evidência enviada? Sim/Não)
-- para a subcategoria auditoria_de_excludentes_envio_de_evidencia.
--
-- Fase 1: audit trail + status na UI da amostra.
-- Fase 2 (futura): override no KPI SLA Protocolo (não mutar sp_tarefas_historico.excludente —
-- o sync SharePoint reescreve essa coluna).

CREATE TABLE public.eficiencia_evidencia_fatal_decisoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci                    TEXT NOT NULL,
  ticket_id             UUID NOT NULL,
  evidencia_enviada     BOOLEAN NOT NULL,
  decisao               TEXT NOT NULL
    CHECK (decisao IN ('excludente_mantida', 'incluido_no_fatal')),
  ano                   INTEGER,
  mes                   INTEGER
    CHECK (mes IS NULL OR (mes >= 1 AND mes <= 12)),
  decidido_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  decidido_por_id       UUID,
  decidido_por_nome     TEXT,
  category              TEXT,
  subcategory           TEXT,
  payload               JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT eficiencia_evidencia_fatal_decisoes_ticket_id_key UNIQUE (ticket_id)
);

CREATE INDEX eficiencia_evidencia_fatal_decisoes_ci_idx
  ON public.eficiencia_evidencia_fatal_decisoes (ci);
CREATE INDEX eficiencia_evidencia_fatal_decisoes_decisao_idx
  ON public.eficiencia_evidencia_fatal_decisoes (decisao);
CREATE INDEX eficiencia_evidencia_fatal_decisoes_ano_mes_idx
  ON public.eficiencia_evidencia_fatal_decisoes (ano, mes);

COMMENT ON TABLE public.eficiencia_evidencia_fatal_decisoes IS
  'Decisões de auditoria de evidência FATAL vindas do RESPONSUM (Finalizar → Evidência enviada? Sim/Não). '
  'excludente_mantida = evidência ok; incluido_no_fatal = sem evidência. Idempotente por ticket_id.';
COMMENT ON COLUMN public.eficiencia_evidencia_fatal_decisoes.decisao IS
  'excludente_mantida (evidencia_enviada=true) | incluido_no_fatal (evidencia_enviada=false).';
COMMENT ON COLUMN public.eficiencia_evidencia_fatal_decisoes.ticket_id IS
  'app_c009c0e4f1_tickets.id no RESPONSUM. UNIQUE — reenvio atualiza a linha.';

CREATE TRIGGER eficiencia_evidencia_fatal_decisoes_updated_at
  BEFORE UPDATE ON public.eficiencia_evidencia_fatal_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

DO $$
BEGIN
  ALTER TABLE public.eficiencia_evidencia_fatal_decisoes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all for anon"
    ON public.eficiencia_evidencia_fatal_decisoes FOR ALL TO anon
    USING (true) WITH CHECK (true);
  CREATE POLICY "Allow all for authenticated"
    ON public.eficiencia_evidencia_fatal_decisoes FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
END;
$$;
