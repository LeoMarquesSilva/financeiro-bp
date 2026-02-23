-- Ajustes no banco para o fluxo do Escritório (dados atualizados diariamente pelo sync).
-- Não altera lógica; só índices e constraint para integridade e performance.

-- 1) clientes_escritorio: remove duplicatas (mantém a linha com updated_at mais recente) e adiciona UNIQUE.
--    Assim o sync pode usar upsert por (grupo_cliente, razao_social) e não inserir duplicatas.
DO $$
BEGIN
  DELETE FROM clientes_escritorio a
  USING clientes_escritorio b
  WHERE a.grupo_cliente IS NOT DISTINCT FROM b.grupo_cliente
    AND a.razao_social = b.razao_social
    AND a.id <> b.id
    AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id::text < b.id::text));
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_clientes_escritorio_grupo_razao'
  ) THEN
    ALTER TABLE clientes_escritorio
      ADD CONSTRAINT uq_clientes_escritorio_grupo_razao
      UNIQUE (grupo_cliente, razao_social);
  END IF;
END $$;

-- 2) timesheets: índice para a view timesheets_resumo_por_grupo_ano (GROUP BY grupo_cliente, ano).
--    A view agrega por grupo e ano; (grupo_cliente, data) ajuda o planner.
CREATE INDEX IF NOT EXISTS idx_timesheets_grupo_data
  ON timesheets (grupo_cliente, data);

COMMENT ON INDEX idx_timesheets_grupo_data IS 'Suporte à view timesheets_resumo_por_grupo_ano (agregação por grupo e ano).';
