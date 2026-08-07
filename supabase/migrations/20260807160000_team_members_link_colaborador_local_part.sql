-- Vincula team_members.colaborador_id quando o local-part do e-mail bate
-- (domínio bpplaw.com.br ↔ bismarchipires.com.br) e ainda não há vínculo.
-- Corrige duplicidade na lista Usuários (ex.: Daniel Pressatto).

UPDATE team_members tm
SET
  colaborador_id = c.id,
  updated_at = now()
FROM colaboradores c
WHERE tm.colaborador_id IS NULL
  AND c.email IS NOT NULL
  AND tm.email IS NOT NULL
  AND lower(split_part(trim(c.email), '@', 1)) = lower(split_part(trim(tm.email), '@', 1))
  AND lower(split_part(trim(c.email), '@', 1)) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM team_members tm2
    WHERE tm2.colaborador_id = c.id
  );
