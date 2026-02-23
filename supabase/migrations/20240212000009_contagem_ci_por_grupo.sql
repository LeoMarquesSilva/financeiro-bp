-- Contagem de CI (processos) por grupo do cliente, por Situação do Processo.
-- Fonte: VIOS – coluna "Situação do Processo"; atualizada pelo sync ou por job.

CREATE TABLE contagem_ci_por_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_cliente TEXT NOT NULL UNIQUE,
  arquivado INTEGER NOT NULL DEFAULT 0,
  arquivado_definitivamente INTEGER NOT NULL DEFAULT 0,
  arquivado_provisoriamente INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 0,
  encerrado INTEGER NOT NULL DEFAULT 0,
  ex_cliente INTEGER NOT NULL DEFAULT 0,
  suspenso INTEGER NOT NULL DEFAULT 0,
  total_geral INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contagem_ci_por_grupo_grupo_cliente ON contagem_ci_por_grupo(grupo_cliente);

COMMENT ON TABLE contagem_ci_por_grupo IS 'Quantidade de CI (processos) por grupo, filtrada por Situação do Processo (VIOS).';
COMMENT ON COLUMN contagem_ci_por_grupo.arquivado IS 'Situação: Arquivado';
COMMENT ON COLUMN contagem_ci_por_grupo.arquivado_definitivamente IS 'Situação: Arquivado Definitivamente';
COMMENT ON COLUMN contagem_ci_por_grupo.arquivado_provisoriamente IS 'Situação: Arquivado Provisoriamente';
COMMENT ON COLUMN contagem_ci_por_grupo.ativo IS 'Situação: Ativo';
COMMENT ON COLUMN contagem_ci_por_grupo.encerrado IS 'Situação: Encerrado';
COMMENT ON COLUMN contagem_ci_por_grupo.ex_cliente IS 'Situação: Ex-Cliente';
COMMENT ON COLUMN contagem_ci_por_grupo.suspenso IS 'Situação: Suspenso';
COMMENT ON COLUMN contagem_ci_por_grupo.total_geral IS 'Total Geral (soma ou total de CIs do grupo)';

CREATE TRIGGER contagem_ci_por_grupo_updated_at
  BEFORE UPDATE ON contagem_ci_por_grupo
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE contagem_ci_por_grupo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON contagem_ci_por_grupo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon (dev)" ON contagem_ci_por_grupo
  FOR ALL TO anon USING (true) WITH CHECK (true);
