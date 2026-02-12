-- Coluna gerada para prioridade (urgente / atenção / controlado) com a mesma regra do frontend.
-- Score = dias_em_aberto * 2 + (valor_em_aberto/1000); urgente >= 100, atenção >= 50, controlado < 50.
ALTER TABLE clients_inadimplencia
  ADD COLUMN IF NOT EXISTS prioridade TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN (dias_em_aberto * 2 + (valor_em_aberto / 1000.0)) >= 100 THEN 'urgente'
      WHEN (dias_em_aberto * 2 + (valor_em_aberto / 1000.0)) >= 50 THEN 'atencao'
      ELSE 'controlado'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_prioridade
  ON clients_inadimplencia(prioridade) WHERE resolvido_at IS NULL;

COMMENT ON COLUMN clients_inadimplencia.prioridade IS 'Urgência calculada: urgente, atencao, controlado (score por dias e valor)';
