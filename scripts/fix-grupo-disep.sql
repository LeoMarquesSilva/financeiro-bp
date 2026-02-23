-- Vincula manualmente inadimplentes "Grupo Disep" / "DISEP" / "Disep" ao cliente escritório
-- cujo grupo_cliente é exatamente 'Grupo Disep' e padroniza razao_social para 'Grupo Disep'.
-- Execute no SQL Editor do Supabase se o map-dados-xlsx não tiver mapeado.

-- 1) Atualizar inadimplentes que batem com Grupo Disep (qualquer variação de nome)
--    e vincular ao primeiro cliente_escritorio do grupo "Grupo Disep"
WITH ce_disep AS (
  SELECT id
  FROM clientes_escritorio
  WHERE TRIM(grupo_cliente) = 'Grupo Disep'
  LIMIT 1
)
UPDATE clients_inadimplencia c
SET
  razao_social = 'Grupo Disep',
  cliente_escritorio_id = (SELECT id FROM ce_disep)
WHERE c.resolvido_at IS NULL
  AND (
    TRIM(UPPER(c.razao_social)) = 'DISEP'
    OR TRIM(c.razao_social) = 'Grupo Disep'
    OR TRIM(c.razao_social) ILIKE 'grupo disep'
  )
  AND (SELECT id FROM ce_disep) IS NOT NULL;
