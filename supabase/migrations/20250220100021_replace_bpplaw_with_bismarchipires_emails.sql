UPDATE team_members
SET email = REPLACE(email, '@bpplaw.com.br', '@bismarchipires.com.br'),
    updated_at = now()
WHERE email LIKE '%@bpplaw.com.br';

UPDATE clients_inadimplencia
SET gestor = REPLACE(gestor, '@bpplaw.com.br', '@bismarchipires.com.br'),
    updated_at = now()
WHERE gestor LIKE '%@bpplaw.com.br';
