-- Situações não mapeadas (ex.: variações de texto no VIOS) entram em "outros".
ALTER TABLE contagem_ci_por_grupo
  ADD COLUMN IF NOT EXISTS outros INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN contagem_ci_por_grupo.outros IS 'Quantidade de CIs com situação não reconhecida pelo sync.';
