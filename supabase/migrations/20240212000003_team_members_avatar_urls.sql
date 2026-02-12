-- Atualiza avatar_url dos team_members para usar a base correta:
-- https://www.bismarchipires.com.br/img/team/ (igual ao teamAvatars.ts no app)

UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/socios/gustavo-site.png' WHERE email = 'gustavo@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/socios/ricardo-pires.jpg' WHERE email = 'ricardo@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/civel/gabriela-consul.jpg' WHERE email = 'gabriela.consul@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/civel/giancarlo.jpg' WHERE email = 'giancarlo@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/trabalhista/daniel-pressato-fernandes.jpg' WHERE email = 'daniel@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/trabalhista/renato-rossetti.jpg' WHERE email = 'renato@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/distressed-deals/michel.jpg' WHERE email = 'michel.malaquias@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/distressed-deals/emanueli-lourenco.png' WHERE email = 'emanueli.lourenco@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/distressed-deals/ariany-bispo.png' WHERE email = 'ariany.bispo@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/reestruturacao/jorge-pecht-souza.jpg' WHERE email = 'jorge@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/reestruturacao/leo-loureiro.png' WHERE email = 'leonardo@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/reestruturacao/ligia-gilberti-lopes.jpg' WHERE email = 'ligia@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/reestruturacao/wagner.jpg' WHERE email = 'wagner.armani@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/reestruturacao/jansonn.jpg' WHERE email = 'jansonn@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/legal-ops/felipe-carmargo.jpg' WHERE email = 'felipe@bpplaw.com.br';
UPDATE team_members SET avatar_url = 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg' WHERE email = 'lavinia.ferraz@bpplaw.com.br';
-- Henrique e Francisco já usam URL completa (blog)
-- UPDATE henrique e francisco mantêm as URLs atuais de blog/wp-content
