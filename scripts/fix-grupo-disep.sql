-- Vincula manualmente inadimplentes "Grupo Disep" / "DISEP" / "Disep" à pessoa
-- cujo grupo_cliente é exatamente 'Grupo Disep' e padroniza razao_social para 'Grupo Disep'.
-- Execute no SQL Editor do Supabase se o map-dados-xlsx não tiver mapeado.

-- 1) Atualizar inadimplentes que batem com Grupo Disep (qualquer variação de nome)
--    e vincular à primeira pessoa do grupo "Grupo Disep"
WITH p_disep AS (
  SELECT id
  FROM pessoas
  WHERE TRIM(grupo_cliente) = 'Grupo Disep'
  LIMIT 1
)
UPDATE clients_inadimplencia c
SET
  razao_social = 'Grupo Disep',
  pessoa_id = (SELECT id FROM p_disep)
WHERE c.resolvido_at IS NULL
  AND (
    TRIM(UPPER(c.razao_social)) = 'DISEP'
    OR TRIM(c.razao_social) = 'Grupo Disep'
    OR TRIM(c.razao_social) ILIKE 'grupo disep'
  )
  AND (SELECT id FROM p_disep) IS NOT NULL;
