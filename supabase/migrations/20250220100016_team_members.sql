-- Tabela team_members (gestores/sócios do escritório) com seed de dados.
-- Campos: email, full_name, area, avatar_url.

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  area TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_area ON team_members(area);

DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON team_members;
CREATE POLICY "Allow all for authenticated" ON team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON team_members;
CREATE POLICY "Allow all for anon" ON team_members FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed: gestores/sócios do escritório (nome, e-mail, área, foto)
INSERT INTO team_members (email, full_name, area, avatar_url) VALUES
  ('gustavo@bpplaw.com.br', 'Gustavo Bismarchi', 'Sócio', 'https://www.bismarchipires.com.br/img/team/socios/gustavo-site.png'),
  ('ricardo@bpplaw.com.br', 'Ricardo Viscardi Pires', 'Sócio', 'https://www.bismarchipires.com.br/img/team/ricardo-pires.jpg'),
  ('gabriela.consul@bpplaw.com.br', 'Gabriela Consul', 'Cível', 'https://www.bismarchipires.com.br/img/team/civel/gabriela-consul.jpg'),
  ('giancarlo@bpplaw.com.br', 'Giancarlo Zotini', 'Cível', 'https://www.bismarchipires.com.br/img/team/civel/giancarlo.jpg'),
  ('daniel@bpplaw.com.br', 'Daniel Pressatto Fernandes', 'Trabalhista', 'https://www.bismarchipires.com.br/img/team/trabalhista/daniel-pressato-fernandes.jpg'),
  ('renato@bpplaw.com.br', 'Renato Vallim', 'Trabalhista', 'https://www.bismarchipires.com.br/img/team/trabalhista/renato-rossetti.jpg'),
  ('michel.malaquias@bpplaw.com.br', 'Michel Malaquias', 'Distressed Deals', 'https://www.bismarchipires.com.br/img/team/distressed-deals/michel.jpg'),
  ('emanueli.lourenco@bpplaw.com.br', 'Emanueli Lourenço', 'Distressed Deals', 'https://www.bismarchipires.com.br/img/team/distressed-deals/emanueli-lourenco.png'),
  ('ariany.bispo@bpplaw.com.br', 'Ariany Bispo', 'Distressed Deals', 'https://www.bismarchipires.com.br/img/team/distressed-deals/ariany-bispo.png'),
  ('jorge@bpplaw.com.br', 'Jorge Pecht Souza', 'Reestruturação', 'https://www.bismarchipires.com.br/img/team/reestruturacao/jorge-pecht-souza.jpg'),
  ('leonardo@bpplaw.com.br', 'Leonardo Loureiro Basso', 'Reestruturação', 'https://www.bismarchipires.com.br/img/team/reestruturacao/leo-loureiro.png'),
  ('ligia@bpplaw.com.br', 'Ligia Lopes', 'Reestruturação', 'https://www.bismarchipires.com.br/img/team/reestruturacao/ligia-gilberti-lopes.jpg'),
  ('wagner.armani@bpplaw.com.br', 'Wagner Armani', 'Societário e Contratos', 'https://www.bismarchipires.com.br/img/team/reestruturacao/wagner.jpg'),
  ('jansonn@bpplaw.com.br', 'Jansonn Mendonça Batista', 'Societário e Contratos', 'https://www.bismarchipires.com.br/img/team/reestruturacao/jansonn.jpg'),
  ('henrique.nascimento@bpplaw.com.br', 'Henrique Franco Nascimento', 'Societário e Contratos', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/02/Henrique-Franco-Nascimento.jpeg'),
  ('felipe@bpplaw.com.br', 'Felipe Camargo', 'Operações Legais', 'https://www.bismarchipires.com.br/img/team/legal-ops/felipe-carmargo.jpg'),
  ('lavinia.ferraz@bpplaw.com.br', 'Lavínia Ferraz Crispim', 'Operações Legais', 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg'),
  ('francisco.zanin@bpplaw.com.br', 'Francisco Zanin', 'Tributário', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  area = EXCLUDED.area,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = now();
