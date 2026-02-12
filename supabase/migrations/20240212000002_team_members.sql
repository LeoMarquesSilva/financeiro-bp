-- Tabela de membros da equipe (gestores) com foto, e-mail, nome completo e área.
-- Usada no módulo de inadimplência e onde for necessário exibir perfil do gestor.
-- E-mails @bismarchipires são normalizados para @bpplaw na busca (considere bpplaw para todos).

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  area TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_email ON team_members(email);
CREATE INDEX idx_team_members_area ON team_members(area);

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS (leitura aberta para o app; em produção restringir se necessário)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read team_members for all" ON team_members
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow read team_members for authenticated" ON team_members
  FOR SELECT TO authenticated USING (true);

-- Dados: e-mails @bpplaw (normalizado a partir de @bismarchipires)
-- BASE_URL assumido como origem das imagens; ajuste se usar outro domínio.
INSERT INTO team_members (email, full_name, area, avatar_url) VALUES
  -- Sócio
  ('gustavo@bpplaw.com.br', 'Gustavo Bismarchi', 'Sócio', 'https://www.bismarchipires.com.br/socios/gustavo-site.png'),
  ('ricardo@bpplaw.com.br', 'Ricardo Viscardi Pires', 'Sócio', 'https://www.bismarchipires.com.br/ricardo-pires.jpg'),
  -- Cível
  ('gabriela.consul@bpplaw.com.br', 'Gabriela Consul', 'Cível', 'https://www.bismarchipires.com.br/civel/gabriela-consul.jpg'),
  ('giancarlo@bpplaw.com.br', 'Giancarlo Zotini', 'Cível', 'https://www.bismarchipires.com.br/civel/giancarlo.jpg'),
  -- Trabalhista
  ('daniel@bpplaw.com.br', 'Daniel Pressatto Fernandes', 'Trabalhista', 'https://www.bismarchipires.com.br/trabalhista/daniel-pressato-fernandes.jpg'),
  ('renato@bpplaw.com.br', 'Renato Vallim', 'Trabalhista', 'https://www.bismarchipires.com.br/trabalhista/renato-rossetti.jpg'),
  -- Distressed Deals
  ('michel.malaquias@bpplaw.com.br', 'Michel Malaquias', 'Distressed Deals', 'https://www.bismarchipires.com.br/distressed-deals/michel.jpg'),
  ('emanueli.lourenco@bpplaw.com.br', 'Emanueli Lourenço', 'Distressed Deals', 'https://www.bismarchipires.com.br/distressed-deals/emanueli-lourenco.png'),
  ('ariany.bispo@bpplaw.com.br', 'Ariany Bispo', 'Distressed Deals', 'https://www.bismarchipires.com.br/distressed-deals/ariany-bispo.png'),
  -- Reestruturação
  ('jorge@bpplaw.com.br', 'Jorge Pecht Souza', 'Reestruturação', 'https://www.bismarchipires.com.br/reestruturacao/jorge-pecht-souza.jpg'),
  ('leonardo@bpplaw.com.br', 'Leonardo Loureiro Basso', 'Reestruturação', 'https://www.bismarchipires.com.br/reestruturacao/leo-loureiro.png'),
  ('ligia@bpplaw.com.br', 'Ligia Lopes', 'Reestruturação', 'https://www.bismarchipires.com.br/reestruturacao/ligia-gilberti-lopes.jpg'),
  ('wagner.armani@bpplaw.com.br', 'Wagner Armani', 'Societário e Contratos', 'https://www.bismarchipires.com.br/reestruturacao/wagner.jpg'),
  ('jansonn@bpplaw.com.br', 'Jansonn Mendonça Batista', 'Societário e Contratos', 'https://www.bismarchipires.com.br/reestruturacao/jansonn.jpg'),
  ('henrique.nascimento@bpplaw.com.br', 'Henrique Franco Nascimento', 'Societário e Contratos', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/02/Henrique-Franco-Nascimento.jpeg'),
  -- Operações Legais
  ('felipe@bpplaw.com.br', 'Felipe Camargo', 'Operações Legais', 'https://www.bismarchipires.com.br/legal-ops/felipe-carmargo.jpg'),
  ('lavinia.ferraz@bpplaw.com.br', 'Lavínia Ferraz Crispim', 'Operações Legais', 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg'),
  -- Tributário
  ('francisco.zanin@bpplaw.com.br', 'Francisco Zanin', 'Tributário', 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png');
