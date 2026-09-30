-- Camada editável da baseline de OPEX. Não altera tabelas de origem nem as RPCs do painel.

CREATE TABLE IF NOT EXISTS public.opex_v2_parametro (
  chave text PRIMARY KEY,
  valor text,
  status text NOT NULL DEFAULT 'sugerida',
  nota text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opex_v2_perimetro (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prioridade integer NOT NULL,
  tipo_regra text NOT NULL,
  chave text NOT NULL,
  descricao_contem text,
  departamento_tipo text,
  efeito text NOT NULL,
  linha text NOT NULL,
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_classificacao (
  conta_prefixo text PRIMARY KEY,
  grupo_gerencial text NOT NULL,
  subgrupo text NOT NULL,
  natureza text NOT NULL,
  controlabilidade text NOT NULL,
  potencial_eficiencia text NOT NULL DEFAULT 'não avaliado',
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_regra_fornecedor (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fornecedor_contem text NOT NULL,
  grupo_gerencial text NOT NULL,
  subgrupo text NOT NULL,
  natureza text NOT NULL,
  controlabilidade text NOT NULL,
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_departamento (
  nome text PRIMARY KEY,
  tipo text NOT NULL,
  area_meta boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_categoria_cargo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cargo text NOT NULL,
  area text NOT NULL,
  categoria text NOT NULL,
  peso_fte numeric NOT NULL,
  status text NOT NULL DEFAULT 'sugerida',
  nota text,
  UNIQUE (cargo, area)
);

CREATE TABLE IF NOT EXISTS public.opex_v2_contratos_consultoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fornecedor text NOT NULL,
  tema text,
  inicio date,
  fim date,
  valor_mensal numeric,
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_eventos_futuros (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mes date,
  conta_ou_grupo text,
  valor numeric,
  descricao text,
  status text CHECK (status IN ('aprovado', 'provavel'))
);

CREATE TABLE IF NOT EXISTS public.opex_v2_contratos_recorrentes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fornecedor text NOT NULL,
  conta text,
  valor_mensal numeric,
  indice_reajuste text,
  data_reajuste date,
  vencimento date,
  meses_observados integer,
  status text NOT NULL DEFAULT 'sugerida',
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_regra_camada (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_regra text NOT NULL,
  chave text NOT NULL,
  camada text NOT NULL,
  status text NOT NULL,
  nota text
);

CREATE TABLE IF NOT EXISTS public.opex_v2_versao (
  versao text PRIMARY KEY,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  nota text
);

ALTER TABLE public.opex_v2_parametro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_perimetro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_regra_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_departamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_categoria_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_contratos_consultoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_eventos_futuros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_contratos_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_regra_camada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_v2_versao ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'opex_v2_parametro','opex_v2_perimetro','opex_v2_classificacao','opex_v2_regra_fornecedor',
    'opex_v2_departamento','opex_v2_categoria_cargo','opex_v2_contratos_consultoria',
    'opex_v2_eventos_futuros','opex_v2_contratos_recorrentes','opex_v2_regra_camada','opex_v2_versao'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_leitura', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_escrita', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t || '_leitura', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_escrita', t
    );
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

insert into public.opex_v2_parametro (chave, valor, status, nota) values ('periodo_inicio', '2025-01', 'confirmada', 'Jan/2025') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('periodo_fim', '2026-08', 'confirmada', 'Ago/2026. Set/2026 fica de fora por estar aberto.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('regime_principal', 'competencia', 'confirmada', 'competencia_titulo, com os ajustes descritos') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('regime_secundario', 'caixa', 'confirmada', 'data_pagamento + valor_pago_item') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('mes_destino_bonus_2025', '2025-12', 'sugerida', 'Bônus 8.2.01 pago em jan–fev/2026 vai para competência 2025. O mês dentro de 2025 não foi definido; esta baseline usa dez/2025.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('provisao_bonus_2026', null, 'confirmada', 'Vazio até ser preenchido. Não entra como zero no forecast.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('metodo_provisao_13_ferias', 'um_doze_da_remuneracao_fixa_do_mes', 'sugerida', 'Provisão do mês = (8.1.01 + 8.1.02 do mês) / 12, separada para 13º e para férias. A visão sem provisão guarda o valor lançado em 8.2.05 e 8.2.04.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('peso_fte_estagiario', '0.75', 'confirmada', 'Demais categorias = 1') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('meses_run_rate', '3', 'confirmada', 'Jun, jul e ago/2026, só a camada estrutural efetiva') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('semivariavel_no_equilibrio', 'fixo', 'sugerida', 'A fórmula de equilíbrio não define o semivariável. Nesta baseline ele entra como fixo.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('faixa_aliquota_pp', '2', 'sugerida', 'Mês fora do padrão quando a alíquota efetiva se afasta mais de 2 pontos da mediana da série.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('nome_referencia', 'Referência 2026', 'confirmada', 'Não é orçamento aprovado. Referência montada em jul/2026 a partir do realizado até ago.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_parametro (chave, valor, status, nota) values ('tratamento_das', 'pagamento_menos_1', 'confirmada', 'DAS pago no mês M alocado à receita de M-1. ISS, DARF e ISSQN permanecem na competência do título.') on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (10, 'departamento', 'Conta Corrente Clientes', null, null, 'fora', 'Reembolsáveis de clientes', 'confirmada', 'Qualquer conta PAGAR nesse departamento');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (20, 'prefixo', '2.6.04', null, null, 'fora', 'Repasses a clientes', 'confirmada', null);
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (21, 'prefixo', '3.2.07', null, null, 'fora', 'Repasses a clientes', 'confirmada', null);
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (30, 'prefixo', '8.1.03', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Pró-labore');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (31, 'prefixo', '2.4.', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Contas nominais de sócios');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (32, 'prefixo', '7.1.', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Distribuição de lucros e dividendos');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (33, 'conta_e_tipo_departamento', '8.3.03', null, 'socio', 'fora', 'Sócios de capital', 'confirmada', 'IRRF lançado em departamento de sócio');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (34, 'conta_e_tipo_departamento', '5.14.03', null, 'socio', 'fora', 'Sócios de capital', 'confirmada', 'Anuidades e regularizações na OAB');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (40, 'conta_e_descricao', '5.14.03', 'DAS', null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Palavra DAS na descrição');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (41, 'prefixo', '2.2.06', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Tributos, DARF, DAS e ISSQN');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (42, 'prefixo', '3.3.01', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'ISS');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (43, 'prefixo', '3.4.', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Deduções da receita');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (50, 'conta_e_descricao', '5.14.03', 'PARCELAMENTO', null, 'fora', 'Passivo tributário', 'confirmada', 'Simples e PGFN');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (60, 'prefixo', '10.1.', null, null, 'fora', 'CAPEX', 'confirmada', 'Fora em todas as visões, inclusive por departamento');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (61, 'prefixo', '2.2.13', null, null, 'fora', 'CAPEX', 'confirmada', 'Bens móveis');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (70, 'prefixo', '5.18.03', null, null, 'fora', 'Não operacional', 'confirmada', 'Multas e juros');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (71, 'prefixo', '2.2.09.002', null, null, 'fora', 'Não operacional', 'confirmada', 'Transferência');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (72, 'prefixo', '2.2.09.003', null, null, 'fora', 'Não operacional', 'confirmada', 'Aplicação');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (73, 'prefixo', '1.1.', null, null, 'fora', 'Não operacional', 'confirmada', 'Empréstimos, aplicações e devoluções');
insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (80, 'prefixo', '5.16.09', null, null, 'fora', 'Permuta', 'confirmada', 'Sem desembolso operacional');
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.1.01', 'Pessoas', 'Associados', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.1.02', 'Pessoas', 'CLT', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.2.', 'Pessoas', 'Remuneração variável', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.21.05', 'Pessoas', 'Remuneração variável', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.3.', 'Pessoas', 'Encargos', 'fixa', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.3.05', 'Pessoas', 'Encargos', 'fixa', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.4.', 'Pessoas', 'Benefícios', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.4.03', 'Pessoas', 'Benefícios', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.3.04', 'Pessoas', 'Benefícios', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.7.', 'Pessoas', 'Desligamentos', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.5.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.8.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('8.6.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.5.03', 'Pessoas', 'Desenvolvimento e cultura', 'fixa', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.3.06', 'Pessoas', 'Outros de pessoal', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('4.1.01', 'Comissões e parcerias', 'Comissões', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('4.1.02', 'Comissões e parcerias', 'Comissões', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.3.07', 'Comissões e parcerias', 'Comissões', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.19', 'Serviços profissionais', 'Honorários contábeis', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.13', 'Serviços profissionais', 'Certificado digital', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.16', 'Serviços profissionais', 'Correspondentes', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.20', 'Serviços profissionais', 'Consultoria', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('9.1.', 'Tecnologia', 'Sistemas', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.20.', 'Tecnologia', 'Sistemas de área', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.05', 'Tecnologia', 'Software', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.5.02', 'Tecnologia', 'Informática', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.02', 'Tecnologia', 'Serviços de informática', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.04', 'Tecnologia', 'Manutenção de informática', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.10.03', 'Tecnologia', 'Material de informática', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.03', 'Tecnologia', 'Internet', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.04', 'Tecnologia', 'Telefonia fixa', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.07', 'Tecnologia', 'Telefonia móvel', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.13.', 'Ocupação e facilities', 'Aluguel', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.01', 'Ocupação e facilities', 'Água e esgoto', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.02', 'Ocupação e facilities', 'Energia', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.12.06', 'Ocupação e facilities', 'Alarme', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.01', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.02', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.03', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.05', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.06', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.07', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.9.08', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.11.', 'Ocupação e facilities', 'Copa', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.24', 'Ocupação e facilities', 'Limpeza', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.31', 'Ocupação e facilities', 'Limpeza', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.10.01', 'Ocupação e facilities', 'Higiene', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.10.04', 'Ocupação e facilities', 'Decoração', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.14.05', 'Ocupação e facilities', 'Seguros', 'fixa', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.15.', 'Marketing', 'Marketing', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.12', 'Marketing', 'Brindes', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.5.03', 'Marketing', 'Eventos', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.6.02', 'Despesas processuais', 'Custas', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.6.01.005', 'Despesas processuais', 'Correios jurídicos', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.6.01', 'Despesas processuais', 'Custas', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.6.03', 'Despesas processuais', 'Diligência', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.5.01', 'Despesas processuais', 'Despesas jurídicas', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.16.06', 'Despesas processuais', 'Reembolsáveis do escritório', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.16.07', 'Despesas processuais', 'Guias', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.10.02', 'Administrativo e financeiro', 'Material de escritório', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.11', 'Administrativo e financeiro', 'Material de escritório', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.03', 'Administrativo e financeiro', 'Motoboy', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.05', 'Administrativo e financeiro', 'Correios', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.8.07', 'Administrativo e financeiro', 'Gráfica', 'variável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.18.01', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.18.02', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.18.04', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.18.05', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.09.001', 'Administrativo e financeiro', 'Tarifas', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.14.03', 'Administrativo e financeiro', 'Impostos e taxas remanescentes', 'variável', 'legal', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.16.02', 'Administrativo e financeiro', 'Publicações', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.16.04', 'Administrativo e financeiro', 'Outras despesas de operação', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.03', 'Administrativo e financeiro', 'Serviços da sede', 'semivariável', 'contratual', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.16.03', 'Administrativo e financeiro', 'Cartão de crédito', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('2.2.08', 'Administrativo e financeiro', 'Cartão de crédito', 'semivariável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values ('5.7.', 'Viagens', 'Viagens', 'variável', 'interna', 'sugerida') on conflict (conta_prefixo) do nothing;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Insolvência', 'area_juridica', true, 'confirmada', 'Área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Trabalhista', 'area_juridica', true, 'confirmada', 'Área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Cível', 'area_juridica', true, 'confirmada', 'Área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Contratos', 'area_juridica', true, 'confirmada', 'Área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Recuperação de Crédito', 'area_juridica', true, 'confirmada', 'Área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Tributário', 'area_juridica', false, 'sugerida', 'Área jurídica que não está na lista de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Facilities', 'indireto', false, 'confirmada', 'Centro de custo corporativo, não a área de Facilities') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Operações Legais', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Financeiro', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('T.I.', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('R.H.', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Marketing', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Comercial', 'indireto', false, 'confirmada', 'Apoio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('BP', 'indireto', false, 'sugerida', 'Sem definição explícita de tipo') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Distressed Deals', 'encerrado', false, 'confirmada', 'Área encerrada') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Conta Corrente Clientes', 'conta_de_cliente', false, 'confirmada', 'Fora do OPEX e da receita de reembolso') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Gustavo Bismarchi Motta', 'socio', false, 'confirmada', 'Departamento de sócio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Ricardo Viscardi Pires', 'socio', false, 'confirmada', 'Departamento de sócio') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values ('Cível | Insolvência', 'area_juridica', false, 'sugerida', 'Departamento misto; não é uma área de meta') on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;
insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values ('FRANCISCO DE ASSIS BARBOSA CAMPOS ZANIN', 'Comissões e parcerias', 'Parceria por contrato', 'variável', 'contratual', 'confirmada', 'Mesmo quando lançado em 5.8.20');
insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values ('ANTUNES GALVAO', 'Consultorias estratégicas', 'Financeira', 'fixa', 'contratual', 'confirmada', 'Contrato até 12/2026');
insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values ('JSN SERVICOS ADMINISTRATIVOS', 'Consultorias estratégicas', 'Financeira', 'fixa', 'contratual', 'confirmada', 'Encerrada em 05/2026');
insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values ('MAIS HUMANIDADE', 'Consultorias estratégicas', 'Pessoas', 'fixa', 'contratual', 'confirmada', 'Prazo indeterminado');
insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values ('CARLOS ZAMBONI', 'Consultorias estratégicas', 'Estratégica', 'fixa', 'contratual', 'confirmada', 'Prazo indeterminado');
insert into public.opex_v2_regra_camada (tipo_regra, chave, camada, status, nota) values ('conta', '5.15.05', 'discricionario', 'confirmada', 'Patrocínios, decisão caso a caso');
insert into public.opex_v2_regra_camada (tipo_regra, chave, camada, status, nota) values ('prefixo', '8.7.', 'nao_recorrente', 'confirmada', 'Desligamentos');
insert into public.opex_v2_regra_camada (tipo_regra, chave, camada, status, nota) values ('ajuste', 'bonus_jan_fev_2026', 'nao_recorrente', 'confirmada', 'Bônus pago fora da competência');
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Contratos', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Operações Legais', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Distressd Deals', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Sênior', 'Distressd Deals', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Cível', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Trabalhista', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Assistente Jurídico', 'Reestruturação', 'apoio', 1, 'sugerida', 'Área jurídica, cargo que não é advogado') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Coordenador', 'Cível', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Reestruturação', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Coordenador', 'Reestruturação', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Coordenador', 'Contratos', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Distressd Deals', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Reestruturação', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Especialista em Gestão Operacional', 'Reestruturação', 'apoio', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Supervisor', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Distressd Deals', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário', 'Trabalhista', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Financeiro', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Reestruturação', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Coordenador Comercial', 'Reestruturação', 'apoio', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Cível', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Recuperação de Crédito', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Gerente', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Reestruturação', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Gerente', 'Reestruturação', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Supervisor', 'Trabalhista', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Sênior', 'Cível', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Cível', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Supervisor', 'Cível', 'advogado', 1, 'sugerida', 'Coordenação classificada pela área') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Assistente Administrativo', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Trabalhista', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Coordenador', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Contratos', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Trabalhista', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Analista de Desenvolvimento de Soluções', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado', 'Tributário', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio de Área', 'Contratos', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Auxiliar de Limpeza', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Assistente Financeiro Pleno', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Analista de Processos Gerenciais', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogada', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Estagiário de Marketing', 'Operações Legais', 'estagiario', 0.75, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Assistente Jurídico', 'Contratos', 'apoio', 1, 'sugerida', 'Área jurídica, cargo que não é advogado') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Distressd Deals', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Sócio', 'Sócio', 'socio', 1, 'sugerida', null) on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Recuperação de Crédito', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Pleno', 'Recuperação de Crédito', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogado Júnior', 'Cível', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Analista Financeiro', 'Financeiro', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Analista Júnior', 'Operações Legais', 'apoio', 1, 'sugerida', 'Pela área de apoio') on conflict (cargo, area) do nothing;
insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values ('Advogada Pleno Controller', 'Trabalhista', 'advogado', 1, 'sugerida', 'Pelo cargo') on conflict (cargo, area) do nothing;
insert into public.opex_v2_versao (versao, nota) values ('2026-09-23.1', 'Baseline jan/2025–ago/2026') on conflict (versao) do nothing;
