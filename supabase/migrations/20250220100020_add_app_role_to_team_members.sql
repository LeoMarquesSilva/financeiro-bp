-- Enum para roles do sistema
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'financeiro', 'comite');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar coluna role
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role app_role;

-- UPDATE roles dos membros existentes (por ID do CSV)
UPDATE team_members SET role = 'comite' WHERE id IN (
  '040bbfe0-3832-4d0f-b057-bb58a9c2391a',
  '14410bbe-c865-4038-86f0-387a606f6dbc',
  '27efe52c-20b7-434f-8f75-5ebf25b6cfe1',
  '3f31341c-860d-45c3-9fa5-5831d5f0de26',
  '6f835420-3bd4-476b-93d0-0a85fbbc41cb',
  '7eb7fb5f-e959-4bda-bdac-c30467448c03',
  'acf60dcf-19b1-4a1e-9d32-413e681c07d0',
  'b9d4e5be-c163-4a97-aadb-6577228132ca',
  'e611051f-ee9f-4e7b-a0eb-8f90f503cd13'
);

UPDATE team_members SET role = 'admin' WHERE id = 'c6a88386-9dba-46d5-a6cf-70c982ec6c17';

-- INSERT dos 4 novos membros
INSERT INTO team_members (email, full_name, area, avatar_url, role) VALUES
  ('vinicius.marques@bismarchipires.com.br', 'Vinicius Schmockel Marques', 'Operações Legais', 'https://www.bismarchipires.com.br/img/team/legal-ops/vinicius-schmockel.jpg', 'admin'),
  ('samuel@bismarchipires.com.br', 'Samuel Willian Silva', 'Operações Legais', 'https://www.bismarchipires.com.br/img/team/legal-ops/samuel-willian.png', 'admin'),
  ('juliana.pires@bismarchipires.com.br', 'Juliana Herculano Bangart', 'Financeiro', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/03/Juliana-Pires.jpeg', 'financeiro'),
  ('leonardo.marques@bismarchipires.com.br', 'Leonardo Marques Silva', 'Operações Legais', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/03/Captura-de-tela-2026-03-02-174232.png', 'admin')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  area = EXCLUDED.area,
  avatar_url = EXCLUDED.avatar_url,
  role = EXCLUDED.role,
  updated_at = now();
