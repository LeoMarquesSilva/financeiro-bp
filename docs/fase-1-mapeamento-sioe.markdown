# Fase 1 — Mapeamento SIOE (despesa, receita, pessoas)

**Data de referência:** 23/09/2026 (mês corrente = set/2026).
**Fonte:** schema e `COUNT(*)` no Supabase do SIOE, mais o código do repositório.
**Aviso:** as contagens do catálogo automático estavam defasadas. Os números abaixo vêm de consulta direta. Exemplos: `financeiro_parcelas` = **12.707** (o catálogo dizia 2); `opex_orcamento_linha` = **974** (dizia 0); `timesheets` = **247.638** (dizia 0); `opex_grupo_de_para` = **8**; `colaboradores_ferias` = **56**.

Este documento para na Fase 1, para validação. Não há cálculo de indicador aqui.

---

## 1. Tabelas e campos relevantes

### Despesa operacional (saídas)

| Tabela / objeto | Papel | Campos relevantes | Origem |
|---|---|---|---|
| `financeiro_parcelas` | Cabeçalho de título/parcela VIOS (PAGAR e RECEBER no mesmo fato) | `ci_titulo`, `ci_parcela`, `tipo`, `data_vencimento`, `competencia` (texto), `valor`, `valor_pago`, `valor_fluxo`, `situacao`, `data_baixa`, `plano_contas`, `cliente`, `pessoa_id` | Sync VIOS — RPC `sync_relatorio_financeiro_replace` |
| `financeiro_parcelas_itens` | Fato analítico de despesa e receita: 1 linha por `ci_item` | `tipo` (`PAGAR`/`RECEBER`), `grupo_conta`, `plano_contas`, `conta_numero`, `departamento`, `valor_item`, `valor_fluxo_item`, `valor_pago_item`, `data_vencimento`, `data_pagamento`, `competencia_titulo`, `ci_titulo`, `ci_item` | Sync VIOS |
| Funções OPEX | Filtro e valores | `opex_item_elegivel`, `opex_grupo_excluido`, `opex_grupo_fixo`, `opex_valor_pago`, `opex_valor_item`, `financeiro_titulo_eh_pagar` | SQL |
| RPCs de painel | Leitura do OPEX | `opex_dashboard`, `opex_mes_grupos`, `opex_lancamentos_periodo`, `opex_plano_titulos` | SQL |

**Contagens:** PAGAR **8.447** itens / **7.580** títulos; RECEBER **9.141** itens / **5.107** títulos. Parcelas: PAGAR **7.589**, RECEBER **5.118**.

Não existe tabela fato separada de despesa ou de realizado OPEX.

### Receita

| Tabela / objeto | Papel | Campos relevantes | Origem |
|---|---|---|---|
| O mesmo par, com `tipo = 'RECEBER'` | Faturado, previsto, recebido, inadimplência | Datas, `valor_item`, `valor_pago_item`, `valor_fluxo_item`, `departamento` | VIOS |
| RPCs `receita_*` | KPIs e séries | `receita_recebido_*`, `receita_previsto_*`, `receita_inadimplencia_*`, `receita_item_recebido_liquido`, `receita_totais_mensais` | SQL |
| `receita_inadimplencia_fechamento_mensal` | Snapshot congelado mensal | Valor total de inadimplência no fim do mês | Calculado no SIOE |
| `pessoas` | Grupo e razão social | `grupo_cliente`, `nome`, `ci`, `categoria` | VIOS |

Não existe tabela fato só de receita.

### Orçamento OPEX

| Tabela | Papel | Campos | Origem |
|---|---|---|---|
| `opex_orcamento_ano` | Metadado do ano congelado | `ano`, `congelado_em`, `origem`, `observacao` | Import |
| `opex_orcamento_linha` | Linhas orçadas | `ano`, `mes`, `grupo_conta`, `plano_contas`, `conta_numero`, `titulo_ref`, `descricao`, `departamento`, `valor`, `fixo` | Planilha |
| `opex_grupo_de_para` | De×Para de nomes de grupo entre anos | `ano_origem`/`destino`, `nome_origem`/`destino` | Manual |

**Dados:** só 2026, **974** linhas, meses 1–12. Congelado em 24/07/2026. Observação gravada: orçamento inicial 2026 replicado de janeiro a dezembro a partir de `opex-previsto-realizado-2026-ago.xlsx`. De-para 2025→2026: **8** linhas.

### Rateio

| Objeto | Papel | Onde |
|---|---|---|
| `useReceitaRateioConsulta` / `receitaRateioConsulta.ts` | Classifica o valor do item nas 5 áreas meta pelo `departamento` VIOS; o resto vai para `outras` | Código |
| SQL de inadimplência por departamento | Saldo pelo departamento do item, sem rateio proporcional do grupo | Banco |
| Fechamento de hours de Operações Legais | Rateio de horas para áreas jurídicas | Processo externo; não grava tabela de rateio no SIOE |

Não existe tabela `rateio`, `centro_custo` nem `jornada`.

### Plano de contas

Dois nomes e um código: `grupo_conta` (plano macro), `plano_contas` (subplano), `conta_numero` (ex. `5.12.06.000`). Normalização no sync por `canonical_grupo_conta` / `canonical_plano_contas`. Exclusão OPEX por `opex_norm_grupo`.

### Centro de custo

Não há tabela. O proxy é a coluna `departamento` no item financeiro e na linha de orçamento.

### Pessoas e colaboradores

| Tabela | Papel | Origem |
|---|---|---|
| `pessoas` | Clientes, leads, contrários, fornecedores. Não é headcount | VIOS |
| `colaboradores` | Headcount canônico | ORQESTRAI `hr_employees` |
| `colaboradores_ferias` | Saldo e gozo de férias | ORQESTRAI |
| `sp_turnover` | Espelho do Turnover BP.xlsx | SharePoint |
| `timesheets` | Apontamento de horas | VIOS |
| `team_members` | Usuários do app | App |

---

## 2. Regimes (caixa, competência ou ambos)

| Módulo | Regime no código | Data usada | `competencia_titulo` |
|---|---|---|---|
| OPEX realizado | Caixa | `data_pagamento` + `abs(valor_pago_item)` | Preenchida, não usada |
| OPEX previsto VIOS | Vencimento | `data_vencimento` + `abs(coalesce(valor_item, valor_fluxo_item, 0))` | Não usada |
| Orçamento OPEX | Mês orçado | `ano`/`mes` da linha importada | Não se aplica |
| Receita faturada / previsto | Vencimento | `data_vencimento` + `valor_item` | Não usada |
| Receita recebida | Caixa | `data_pagamento` + `valor_pago_item` | Não usada |
| Inadimplência | Híbrido | Vencimento até o corte; recebido com baixa posterior e antecipado | Não usada |

`competencia_titulo` está preenchida em **100%** dos itens PAGAR (8.447) e RECEBER (9.141), e nenhuma RPC de OPEX ou receita a usa como eixo. `financeiro_parcelas.competencia` (texto) está em **5.714 / 12.707** parcelas (~45%) e também não é o eixo dos KPIs atuais.

---

## 3. Plano de contas

Estrutura: grupo → subplano → código no padrão `N.N.NN.NNN`.

`opex_grupo_excluido` (função atual no banco) tira do OPEX padrão:

- DISTRIBUIÇÃO DE LUCROS
- SÓCIOS
- OUTRAS RECEITAS OPERACIONAIS
- SAÍDAS - EMPRÉSTIMOS, APLICAÇÕES E DEVOLUÇÕES
- INVESTIMENTOS
- DEDUÇÕES DA RECEITA

`opex_item_elegivel` = PAGAR e fora dessa lista. A visão por departamento (`opex_item_elegivel_departamento`) deixa **INVESTIMENTOS** entrar.

| Universo | Grupos | Pares grupo + subplano | Com código |
|---|---:|---:|---:|
| PAGAR inteiro | 36, mais 4 itens sem grupo | 128 | 128 |
| PAGAR elegível ao OPEX | 30 | 115 | 115 |

A lista abaixo é o **PAGAR inteiro**. “Entra no OPEX? = sim” é o subconjunto de 115 contas.

| Grupo | Subplano | Código | Itens | OPEX |
|---|---|---|---:|---|
| *(sem grupo)* | VALE ALIMENTAÇÃO | 5.4.03.000 | 4 | sim |
| ALUGUÉIS | ALUGUEL DE IMÓVEL | 5.13.01.000 | 32 | sim |
| ASSOCIAÇÕES E CUSTAS JUDICIAIS | CUSTAS JUDICIAIS | 5.6.02.000 | 285 | sim |
| BENEFÍCIOS | ASSISTÊNCIA MÉDICA E ODONTOLÓGICA | 8.4.03.000 | 105 | sim |
| BENEFÍCIOS | AUXÍLIO EDUCACIONAL | 8.4.05.000 | 120 | sim |
| BENEFÍCIOS | ESTACIONAMENTO | 8.4.06.000 | 96 | sim |
| BENEFÍCIOS | SEGURO DE VIDA | 8.4.04.000 | 19 | sim |
| BENEFÍCIOS | VALE REFEIÇÃO/VALE ALIMENTAÇÃO | 8.4.01.000 | 47 | sim |
| BENEFÍCIOS | VALE TRANSPORTE | 8.4.02.000 | 43 | sim |
| COMISSÕES SOBRE VENDAS | COMISSÕES INTERNAS | 4.1.02.000 | 419 | sim |
| COMISSÕES SOBRE VENDAS | COMISSÕES PARCEIROS | 4.1.01.000 | 269 | sim |
| DEDUÇÕES DA RECEITA | DEVOLUÇÃO HONORÁRIOS / DESPESAS | 3.4.01.000 | 2 | não |
| DESLIGAMENTOS | INDENIZAÇÃO ASSOCIADOS | 8.7.05.000 | 7 | sim |
| DESLIGAMENTOS | SALDO DE FÉRIAS ASSOCIADOS | 8.7.06.000 | 3 | sim |
| DESLIGAMENTOS | SALDO REMUNERAÇÃO ASSOCIADOS | 8.7.04.000 | 14 | sim |
| Despesas Administrativas | Custas | 2.5.01.000 | 4 | sim |
| Despesas Administrativas | Eventos | 2.5.03.000 | 92 | sim |
| Despesas Administrativas | Informática | 2.5.02.000 | 68 | sim |
| Despesas com pessoal | Benefício | 2.3.04.000 | 78 | sim |
| Despesas com pessoal | Comissão | 2.3.07.000 | 276 | sim |
| Despesas com pessoal | Reembolso | 2.3.06.000 | 179 | sim |
| Despesas com pessoal | Tributos | 2.3.05.000 | 14 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | CERTIFICADO DIGITAL | 5.8.13.000 | 9 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | CONSULTORIA | 5.8.20.000 | 88 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | CORREIOS | 5.8.05.000 | 14 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | CORRESPONDENTES | 5.8.16.000 | 5 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | DIARISTA | 5.8.31.000 | 45 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | GRÁFICA | 5.8.07.000 | 29 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | HONORÁRIOS CONTÁBEIS | 5.8.19.000 | 26 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | LIMPEZA | 5.8.24.000 | 34 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | MOTOBOY | 5.8.03.000 | 34 | sim |
| DESPESAS COM SERVIÇOS DE TERCEIROS | SERVIÇOS DE INFORMÁTICA | 5.8.02.000 | 34 | sim |
| Despesas da sede | Aplicação | 2.2.09.003 | 5 | sim |
| Despesas da sede | Bens móveis | 2.2.13.000 | 2 | sim |
| Despesas da sede | Brindes | 2.2.12.000 | 39 | sim |
| Despesas da sede | Cartão de crédito | 2.2.08.000 | 22 | sim |
| Despesas da sede | DARF | 2.2.06.001 | 2 | sim |
| Despesas da sede | DAS | 2.2.06.002 | 4 | sim |
| Despesas da sede | ISSQN | 2.2.06.003 | 8 | sim |
| Despesas da sede | Material de escritório | 2.2.11.000 | 14 | sim |
| Despesas da sede | Serviço | 2.2.03.000 | 126 | sim |
| Despesas da sede | Software | 2.2.05.000 | 44 | sim |
| Despesas da sede | Tarifas | 2.2.09.001 | 244 | sim |
| Despesas da sede | Transferência | 2.2.09.002 | 6 | sim |
| Despesas da sede | Tributos | 2.2.06.000 | 5 | sim |
| DESPESAS DE COPA E COZINHA | COPA E COZINHA | 5.11.02.000 | 64 | sim |
| DESPESAS DE COPA E COZINHA | UTENSÍLIOS E ACESSÓRIOS | 5.11.01.000 | 46 | sim |
| DESPESAS DE INFRAESTRUTURA | ÁGUA E ESGOTO | 5.12.01.000 | 25 | sim |
| DESPESAS DE INFRAESTRUTURA | ALARME E MONITORAMENTO | 5.12.06.000 | 16 | sim |
| DESPESAS DE INFRAESTRUTURA | ENERGIA ELÉTRICA | 5.12.02.000 | 22 | sim |
| DESPESAS DE INFRAESTRUTURA | INTERNET | 5.12.03.000 | 56 | sim |
| DESPESAS DE INFRAESTRUTURA | TELEFONIA FIXA | 5.12.04.000 | 78 | sim |
| DESPESAS DE INFRAESTRUTURA | TELEFONIA MÓVEL | 5.12.07.000 | 47 | sim |
| DESPESAS DE MANUTENÇÃO | CONSERTOS EM GERAL | 5.9.06.000 | 10 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO AR CONDICIONADO | 5.9.05.000 | 15 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO DE MÓVEIS | 5.9.02.000 | 1 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO ELÉTRICA E HIDRÁULICA | 5.9.01.000 | 9 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO EQUIPAMENTOS DE INFORMÁTICA | 5.9.04.000 | 27 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO PREDIAL | 5.9.03.000 | 142 | sim |
| DESPESAS DE MANUTENÇÃO | MANUTENÇÃO PURIFICADORES DE ÁGUA | 5.9.08.000 | 12 | sim |
| DESPESAS DE MANUTENÇÃO | PAISAGISMO | 5.9.07.000 | 17 | sim |
| DESPESAS DE T.I. | MANUTENÇÃO EQUIP DE INFO E TELEFONIA | 5.20.09.000 | 6 | sim |
| DESPESAS DE T.I. | SISTEMAS DE ÁREA | 5.20.06.000 | 16 | sim |
| DESPESAS DE VIAGEM E LOCOMOÇÃO | HOSPEDAGEM | 5.7.04.000 | 8 | sim |
| DESPESAS DE VIAGEM E LOCOMOÇÃO | PASSAGEM AÉREA | 5.7.05.000 | 9 | sim |
| DESPESAS ESTAGIÁRIOS | BÔNUS | 5.21.05.000 | 13 | sim |
| DESPESAS FINANCEIRAS | DESPESAS BANCÁRIAS | 5.18.01.000 | 143 | sim |
| DESPESAS FINANCEIRAS | IOF | 5.18.02.000 | 53 | sim |
| DESPESAS FINANCEIRAS | MULTAS E JUROS | 5.18.03.000 | 3 | sim |
| DESPESAS FINANCEIRAS | OUTRAS DESPESAS FINANCEIRAS | 5.18.05.000 | 134 | sim |
| DESPESAS FINANCEIRAS | TARIFAS DE CARTÕES | 5.18.04.000 | 51 | sim |
| DISTRIBUIÇÃO DE LUCROS | DISTRIBUIÇÃO DE LUCROS | 7.1.01.000 | 547 | não |
| DISTRIBUIÇÃO DE LUCROS | DIVIDENDOS PARCELAS FIXAS | 7.1.02.000 | 34 | não |
| ENCARGOS SOCIAIS | CONSIGNADO | 8.3.04.000 | 9 | sim |
| ENCARGOS SOCIAIS | FGTS | 8.3.01.000 | 63 | sim |
| ENCARGOS SOCIAIS | INSS | 8.3.02.000 | 95 | sim |
| ENCARGOS SOCIAIS | IRRF | 8.3.03.000 | 33 | sim |
| GASTOS GERAIS COM PESSOAL | CONTRIBUIÇÃO SINDICAL | 5.5.03.000 | 1 | sim |
| IMPOSTOS SOBRE SERVIÇOS | IMPOSTOS SOBRE SERVIÇOS - ISS | 3.3.01.000 | 16 | sim |
| IMPOSTOS, TAXAS E SEGUROS | IMPOSTOS E TAXAS | 5.14.03.000 | 170 | sim |
| IMPOSTOS, TAXAS E SEGUROS | SEGUROS | 5.14.05.000 | 10 | sim |
| INVESTIMENTOS | EQUIPAMENTOS DE COMUNICAÇÃO | 10.1.11.000 | 1 | não no OPEX padrão; entra na visão por departamento |
| INVESTIMENTOS | EQUIPAMENTOS DE INFORMÁTICA | 10.1.03.000 | 70 | não no OPEX padrão; entra na visão por departamento |
| INVESTIMENTOS | INVESTIMENTOS - REFORMAS E MELHORIAS | 10.1.06.000 | 1 | não no OPEX padrão; entra na visão por departamento |
| INVESTIMENTOS | MÓVEIS E EQUIPAMENTOS | 10.1.01.000 | 24 | não no OPEX padrão; entra na visão por departamento |
| Jurídicas | Custas | 2.6.01.000 | 128 | sim |
| Jurídicas | Despesas jurídicas - Correios | 2.6.01.005 | 4 | sim |
| Jurídicas | Diligência | 2.6.03.000 | 8 | sim |
| Jurídicas | Repasse | 2.6.04.000 | 38 | sim |
| MATERIAL DE CONSUMO, LIMPEZA E SEGURANÇA | DECORAÇÃO E ORNAMENTO | 5.10.04.000 | 12 | sim |
| MATERIAL DE CONSUMO, LIMPEZA E SEGURANÇA | MATERIAL DE ESCRITÓRIO | 5.10.02.000 | 34 | sim |
| MATERIAL DE CONSUMO, LIMPEZA E SEGURANÇA | MATERIAL DE HIGIENE E LIMPEZA | 5.10.01.000 | 172 | sim |
| MATERIAL DE CONSUMO, LIMPEZA E SEGURANÇA | MATERIAL DE INFORMÁTICA | 5.10.03.000 | 125 | sim |
| OUTRAS DESPESAS | CARTÃO DE CRÉDITO | 5.16.03.000 | 68 | sim |
| OUTRAS DESPESAS | DESPESAS REEMBOLSÁVEIS - GUIAS | 5.16.07.000 | 1 | sim |
| OUTRAS DESPESAS | JORNAIS / LIVROS E REVISTAS | 5.16.02.000 | 1 | sim |
| OUTRAS DESPESAS | OUTRAS DESPESAS DE OPERAÇÃO | 5.16.04.000 | 69 | sim |
| OUTRAS DESPESAS | OUTRAS DESPESAS REEMBOLSÁVEIS | 5.16.06.000 | 214 | sim |
| OUTRAS DESPESAS | PERMUTAS | 5.16.09.000 | 1 | sim |
| OUTRAS RECEITAS OPERACIONAIS | REPASSE DE OUTRAS RECEITAS | 3.2.07.000 | 117 | não |
| OUTROS CUSTOS COM PESSOAS | ONBOARDING | 8.8.02.000 | 8 | sim |
| OUTROS CUSTOS COM PESSOAS | RECONHECIMENTO | 8.8.03.000 | 75 | sim |
| PROPAGANDA E MARKETING | ASSESSORIA EM MARKETING | 5.15.02.000 | 24 | sim |
| PROPAGANDA E MARKETING | FEIRAS E EVENTOS | 5.15.04.000 | 18 | sim |
| PROPAGANDA E MARKETING | PATROCÍNIOS | 5.15.05.000 | 26 | sim |
| PROPAGANDA E MARKETING | SERVIÇOS FOTOGRÁFICOS / FILMAGEM | 5.15.06.000 | 18 | sim |
| RECRUTAMENTO E SELEÇÃO | MEDICINA OCUPACIONAL | 8.6.02.000 | 4 | sim |
| REMUNERAÇÃO FIXA | HONORÁRIOS ASSOCIADOS | 8.1.01.000 | 1.018 | sim |
| REMUNERAÇÃO FIXA | PRÓ-LABORE | 8.1.03.000 | 49 | sim |
| REMUNERAÇÃO FIXA | SALÁRIOS | 8.1.02.000 | 143 | sim |
| REMUNERAÇÃO VARIÁVEL | 13º SALÁRIO | 8.2.05.000 | 11 | sim |
| REMUNERAÇÃO VARIÁVEL | BÔNUS | 8.2.01.000 | 192 | sim |
| REMUNERAÇÃO VARIÁVEL | FÉRIAS | 8.2.04.000 | 9 | sim |
| REMUNERAÇÃO VARIÁVEL | GRATIFICAÇÕES | 8.2.03.000 | 1 | sim |
| SAÍDAS - EMPRÉSTIMOS APL. E DEVOLUÇÕES | ADIANTAMENTOS | 1.1.02.000 | 12 | não |
| SAÍDAS - EMPRÉSTIMOS APL. E DEVOLUÇÕES | DEVOLUÇÃO DE ADIANTAMENTOS DE CLIENTES | 1.1.08.000 | 7 | não |
| SAÍDAS - EMPRÉSTIMOS APL. E DEVOLUÇÕES | SAÍDA - TRANSF. ENTRE CONTAS CORRENTES | 1.1.03.000 | 3 | não |
| Sócios | Gustavo Bismarchi | 2.4.02.000 | 125 | não |
| Sócios | Ricardo Pires | 2.4.01.000 | 63 | não |
| TECNOLOGIA E SISTEMAS | AUTOMAÇÃO, DADOS E IA | 9.1.01.000 | 80 | sim |
| TECNOLOGIA E SISTEMAS | DOMÍNIOS E HOSPEDAGEM | 9.1.02.000 | 14 | sim |
| TECNOLOGIA E SISTEMAS | MARKETING E COMERCIAL | 9.1.03.000 | 33 | sim |
| TECNOLOGIA E SISTEMAS | SEGURANÇA DA INFORMAÇÃO | 9.1.04.000 | 5 | sim |
| TECNOLOGIA E SISTEMAS | SISTEMAS DE GESTÃO E OPERAÇÃO | 9.1.05.000 | 251 | sim |
| TREINAMENTO/DESENVOLVIMENTO/CULTURA | CURSOS/WORKSHOPS/PALESTRAS | 8.5.01.000 | 41 | sim |
| TREINAMENTO/DESENVOLVIMENTO/CULTURA | DATAS COMEMORATIVAS | 8.5.05.000 | 27 | sim |
| TREINAMENTO/DESENVOLVIMENTO/CULTURA | EVENTOS | 8.5.04.000 | 67 | sim |
| TREINAMENTO/DESENVOLVIMENTO/CULTURA | SAÚDE E BEM-ESTAR | 8.5.03.000 | 19 | sim |

**1.006** itens PAGAR ficam fora do OPEX padrão: distribuição de lucros 581, sócios 188, outras receitas 117, investimentos 96, saídas de empréstimos 22, deduções 2.

Grupos tratados como fixos: remuneração fixa, aluguéis, encargos sociais, benefícios, despesas da sede, despesas com pessoal, tecnologia e sistemas, impostos/taxas/seguros, infraestrutura, administrativas, manutenção, material de consumo, T.I., copa e cozinha.

---

## 4. Rateio

Na receita, cada item já chega com `departamento`. O SIOE não reparte o total do grupo entre áreas. As 5 áreas meta são insolvência, trabalhista, cível, contratos e recuperação de crédito. O valor classificado é o `valor_item`. O percentual da área é a soma dos itens daquela área sobre a soma dos itens do grupo.

Não existe coluna de valor pré-rateio distinta do valor do item. A classificação só escolhe o balde da área; o montante não muda.

Departamento vazio em RECEBER: **0** itens. Fora das 5 áreas (Distressed Deals, Facilities, Conta Corrente Clientes, Tributário, BP, Financeiro e similares): cerca de **1.453 / 9.141** itens, que caem em `outras`.

OPEX não rateia despesa. Agrega pelo plano já gravado e, quando filtra, usa o `departamento` do item. O orçamento 2026 tem 11 departamentos distintos.

O rateio de horas de Operações Legais está documentado como processo externo (horas × volumes de publicação, agendamento, pasta e protocolo). No SIOE existem as horas brutas em `timesheets` e a lista de colaboradores. Não há tabela com o resultado desse rateio.

---

## 5. Campos de receita

| Coluna em RECEBER | Preenchimento | Uso nos KPIs |
|---|---|---|
| `valor_item` | 100% (9.141) | Sim — faturado, previsto, inadimplência |
| `valor_fluxo_item` | 100% | Sim — encargos e recebido líquido |
| `valor_pago_item` | 100% das linhas; **1.955** zerados e **7.186** > 0 | Sim — recebido |
| `valor_bruto_titulo` | 100% | Não entra nos KPIs |
| `valor_liquido_titulo` | 100% | Não entra nos KPIs |
| `valor_parcial_aberto` | 100% | Não é o KPI do módulo Receita |

Em **9.139** itens, bruto e líquido do título são iguais. Só **2** diferem. Não há dedução de imposto materializada nessa diferença.

| Conceito | O que existe |
|---|---|
| Bruta, deduções, líquida de P&L | Colunas de bruto/líquido do título existem e os KPIs não as usam |
| Faturada | `valor_item` + `data_vencimento`, nos planos da cota |
| Recebida | `valor_pago_item` + `data_pagamento` |
| Por unidade | `departamento` do item |
| Encargos | `max(0, pago − fluxo)` quando o pago supera o fluxo |

Planos da cota de receita: honorários mensais, spot, sucumbência, êxito, manutenção, por hora e advocatícios.

---

## 6. Pessoas

### `pessoas` — cadastro VIOS, não headcount

29.124 linhas, 454 grupos. Sem `grupo_cliente`: 26.953. Categorias mais frequentes: vazio 17.781, contrário ativo 5.788, cliente ativo 808, fornecedor 305, colaborador 38. Campos: `ci`, `cpf_cnpj`, `nome`, `grupo_cliente`, `categoria`, contatos. Não há nível, cargo de staff nem admissão.

### `colaboradores` — headcount

80 pessoas: **59** ativas e **21** inativas. Ninguém sem cargo, área ou admissão. `termination_date` está vazio inclusive nos inativos. Admissão de 01/03/2017 a 18/09/2026.

| Nível | Ativos | Inativos |
|---|---:|---:|
| sócio | 6 | 0 |
| gerente | 2 | 2 |
| coordenador | 5 | 3 |
| colaborador | 46 | 16 |

Cargos:

| Cargo | Total | Ativos |
|---|---:|---:|
| Estagiário | 14 | 7 |
| Advogado Júnior | 11 | 11 |
| Advogado Pleno | 11 | 11 |
| Coordenador | 7 | 4 |
| Gerente | 4 | 2 |
| Sócio de Área | 4 | 4 |
| Advogado | 3 | 1 |
| Advogado Jr I | 3 | 0 |
| Advogado Sênior I | 3 | 0 |
| Supervisor | 3 | 3 |
| Assistente Administrativo | 2 | 2 |
| Sócio | 2 | 2 |
| Advogada Pleno Controller | 1 | 1 |
| Advogado Pleno I | 1 | 0 |
| Advogado Sênior | 1 | 1 |
| Analista de Desenvolvimento de Soluções | 1 | 1 |
| Analista de Processos Gerenciais | 1 | 1 |
| Analista Financeiro | 1 | 1 |
| Analista Júnior | 1 | 1 |
| Assistente Financeiro Pleno | 1 | 1 |
| Assistente Jurídico | 1 | 1 |
| Auxiliar de Limpeza | 1 | 1 |
| Coordenador Comercial | 1 | 1 |
| Especialista em Gestão Operacional | 1 | 1 |
| Estagiário de Marketing | 1 | 1 |

Áreas: Reestruturação 22, Operações Legais 20, Trabalhista 9, Distressed Deals 8, Cível 8, Contratos 5, Recuperação de Crédito 4, Sócio 2, Financeiro 1, Tributário 1.

Não há coluna de jornada. Não há custo por pessoa. A única constante encontrada é `app_settings.escritorio_custo_hora_produtiva` = **100,58**. Não há enum advogado / estagiário / backoffice; isso só se infere do texto do cargo.

### `sp_turnover`

163 linhas, 105 com desligamento. Admissão 01/03/2017–23/09/2026. Desligamento 13/04/2022–04/09/2026. Sem cargo: 9. Sem área: 0. Traz tipo de desligamento, núcleo e observação. É a fonte de data de saída; `colaboradores` não tem.

### `timesheets`

**247.638** linhas, de 02/03/2025 a 16/09/2026, 19 meses sem buraco. `total_horas_decimal` em todas. `valor_hora` só em **1.132**.

`colaboradores_ferias`: 56 linhas de saldo/gozo. Sem jornada e sem custo.

---

## 7. Cobertura temporal

### PAGAR

| Eixo | Primeiro | Último | Meses com dado | Lacunas no intervalo |
|---|---|---|---:|---|
| Pagamento | nov/2024 | set/2026 | 23 | nenhuma |
| Vencimento | out/2024 | ago/2029 | 59 | nenhuma |
| Competência saneada (≥ 2020) | set/2024 | ago/2029 | 60 | nenhuma |

626 itens PAGAR ainda sem pagamento. A competência bruta tem 2 datas inválidas (`1202-04-16` e `2002-11-11`).

### RECEBER

| Eixo | Primeiro | Último | Meses com dado | Lacunas |
|---|---|---|---:|---|
| Pagamento | mai/2023 | set/2026 | 28 | jun, jul, set–dez/2023; jan, mar, mai–set/2024 (13 meses) |
| Vencimento | mai/2023 | jul/2028 | 63 | nenhuma |
| Competência ≥ 2020 | mai/2023 | jul/2028 | 63 | nenhuma |

### Orçamento

Só 2026, 974 linhas, janeiro a dezembro, sem mês vazio. Não há orçamento 2025 no banco.

### Pessoas e horas

Admissões de colaboradores vão de 2017 a set/2026, mas não formam uma série mensal de headcount. Data de desligamento em `colaboradores` está vazia. `sp_turnover` tem saídas de abr/2022 a set/2026, com 13 meses sem nenhum desligamento (mai–dez/2022, abr/2023, out/2023, fev/2024, ago/2025, ago/2026). Timesheet: mar/2025–set/2026, sem lacuna.

---

## 8. Inconsistências

| Checagem | Resultado |
|---|---|
| PAGAR sem grupo | **4** (VALE ALIMENTAÇÃO / 5.4.03.000), ainda entram no OPEX |
| PAGAR sem subplano ou sem código | **0** |
| PAGAR ou RECEBER sem departamento | **0** |
| `ci_item` duplicado | **0** |
| PAGAR excluído do OPEX padrão | **1.006** |
| Orçamento sem realizado, por grupo + subplano | **0** |
| Realizado elegível sem orçamento, por grupo + subplano | **74** pares. Maiores: Despesas da sede (13), serviços de terceiros (6), outras despesas (5) |
| Linhas de orçamento sem código de conta | **99 / 974** |
| Competência inválida em PAGAR | 2 itens: `ci_item` 614 e 29 |
| Colaboradores sem cargo, área ou admissão | **0** |
| Inativos sem data de desligamento | **21** |
| Turnover sem cargo | **9** |
| Bruto ≠ líquido em RECEBER | **2** itens |

Os 9 casos em que o orçamento não encontra o realizado quando se exige o código são linhas orçadas com `conta_numero` vazio; o mesmo plano existe no realizado com código.

---

## O que este mapeamento ainda não permite calcular

- Despesa em competência contábil: a data existe, não alimenta KPI e tem duas datas inválidas.
- P&L com receita bruta menos impostos menos OPEX: bruto e líquido do título não são o eixo, e não há dedução fiscal modelada.
- Centro de custo formal: só o texto de `departamento`, misturando área jurídica, Facilities e nome de sócio.
- Custo de pessoal por pessoa: não há folha individual, só a constante de custo-hora.
- Headcount histórico mensal só com `colaboradores`: falta data de saída; a série de desligamento está em `sp_turnover`.
- Rateio de horas de Operações Legais como série no SIOE: o timesheet bruto existe; o resultado do rateio não está gravado.
- Orçamento e realizado 1:1 por conta: 74 planos realizados sem orçamento, 99 linhas orçadas sem código, e orçamento só de 2026.
- Categoria nativa advogado / estagiário / backoffice, sem regra em cima do texto do cargo.
