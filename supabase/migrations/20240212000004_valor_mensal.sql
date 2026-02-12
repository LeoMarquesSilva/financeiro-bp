-- Valor mensal (da planilha QUADRO RESUMO - coluna VALOR MENSAL)
ALTER TABLE clients_inadimplencia
  ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC(15, 2) DEFAULT NULL;

COMMENT ON COLUMN clients_inadimplencia.valor_mensal IS 'Valor mensal do contrato/serviço (planilha: VALOR MENSAL)';
