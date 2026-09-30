# Rotina diária no SIOE — Sócio / Gerente de área

Guia objetivo do que olhar no **SIOE** (Sistema Interno do Escritório Bismarchi Pires) no dia a dia, na visão de quem **gerencia uma área jurídica** — não do financeiro operacional nem do admin.

**Tempo sugerido:** 15–20 minutos por dia útil + 30–45 minutos na reunião semanal de comitê / fechamento de semana.

---

## Antes de começar

### Como entrar no SIOE

- URL: ambiente de produção do financeiro-bp (Vercel).
- Login com e-mail `@bpplaw.com.br` ou `@bismarchipires.com.br`.
- O menu lateral mostra **somente os módulos liberados** para você (perfil + checkboxes em Usuários).

### Perfis típicos de sócio / gerente

| Situação | O que aparece no menu |
|----------|------------------------|
| **Comitê** (perfil fixo) | Inadimplência, Dashboard, Inad. Pontual, Inad. Judicializada, **Receita** |
| **Só módulos** (sem perfil Comitê) | Depende do que o admin marcou: **Eficiência**, **Receita**, **OPEX**, **Escritório**, etc. |
| **Coordenador de área** | **Eficiência** (Overview travado na sua área) + módulos extras se liberados |

> Se faltar alguma tela, peça ao admin em **Usuários → Gerenciar acesso** (ícone de chave).

---

## Rotina diária (≈ 15 min)

Ordem sugerida — do operacional ao financeiro.

### 1. Eficiência Operacional → Overview *(≈ 5 min)*

**Menu:** Eficiência Operacional → aba **Overview**

**Filtros:** ano corrente · mês atual (ou **Resultado** para jun–dez) · **sua área** (Cível, Contratos, Insolvência, Recuperação de Crédito, Trabalhista).

**Olhar todo dia:**

| Indicador | Meta típica | O que fazer se estiver ruim |
|-----------|-------------|----------------------------|
| SLA Protocolo | meta do mês | Clicar **Racional** → ver casos fora do D+1 |
| Eficiência Protocolo | 95% | Racional → inconsistências de cadastro |
| SLA Ciência Agendamentos | 95% | Racional (não vale Trabalhista/Ops Legais) |
| SLA Vistagem Risco | 98% | Racional → publicações não vistadas a tempo |
| SLA Vistagem Normal | 98% | Só áreas com demanda normal; **Trabalhista = “–”** |
| Desenvolvimento Equipe | 100% (14 h/pessoa) | Quem está abaixo da meta de treinamento |
| Receita Bruta (% meta) | 100% | Sinal de desvio de faturamento da área |
| Índice de Inadimplência | meta × previsto | % inadimplente sobre o previsto da área |

**Coordenador:** filtro de área já vem **travado** — revisar só a própria área.

**Sócio/gerente:** alternar entre **sua área** e **Todas as áreas** quando for comparar com o escritório.

---

### 2. Receita → Gestão à vista *(≈ 5 min)*

**Menu:** Receita → bloco **Gestão à vista** (topo da página, após os KPIs anuais)

**Filtro:** chip da **sua área meta** (Insolvência, Trabalhista, Cível, Contratos, Rec. Crédito).

**Olhar todo dia:**

| KPI | Significado prático |
|-----|---------------------|
| **Meta acumulada** | Quanto a área deveria ter faturado no período |
| **Previsto acumulado** | O que venceu (base de cobrança) |
| **Recebido acumulado** | Caixa efetivo da área |
| **Atingimento meta** | Recebido ÷ meta — termômetro principal |
| **Inad. acumulada** | Saldo de inadimplência da área no período |

**Tabela mensal:** conferir o **mês corrente** — previsto vs recebido vs inadimplência.

**Clique no mês:** abre composição (grupos / planos) — use quando o número “estranho” precisar de explicação.

**Modo Resultado** (botão no gráfico comparativo): mostra só jun–dez e oculta recebido/inad. do mês em aberto — preferível para fechamento parcial do ano.

---

### 3. Inadimplência → sua carteira *(≈ 5 min)*

**Menu:** Inadimplência (lista de cards)

**Filtros úteis:** gestor · **área** · prioridade **Urgente** / **Atenção**

**Olhar todo dia:**

- Cards **urgentes** ou **atenção** da sua área ou dos gestores que você supervisiona.
- **Follow-ups vencidos** (alerta no topo / KPIs do header).
- Abrir o **detalhe** do cliente: última providência, follow-ups pendentes, parcelas em atraso.

**Se você é Comitê:** pode **criar providência** e **follow-up**; não edita cadastro nem marca como resolvido (financeiro/admin).

**Dashboard** (`Inadimplência → Dashboard`): visão consolidada — use **1× por semana**, não precisa ser todo dia.

---

### 4. (Opcional) Escritório *(≈ 3 min, 2–3× por semana)*

**Menu:** Escritório

**Quando usar:** investigar um grupo específico — processos, horas, situação financeira agregada.

**Filtros:** busca por nome · situação financeira · “No Comitê” / “Fora do Comitê”.

Útil antes de ligar para o cliente ou preparar pauta do comitê.

---

## Rotina semanal (≈ 30–45 min)

Ideal: **véspera ou manhã do comitê de inadimplência** + **sexta-feira** para fechamento operacional.

### Inadimplência — Dashboard estratégico

- **Total em aberto** (Pontual · Recorrente · Judicializada).
- **Taxa de recuperação** do mês.
- **Taxa recuperação comitê** (desde 05/02/2026) — se habilitada.
- **Top devedores** e ranking por gestor/área.
- Follow-ups **vencidos** e **a vencer em 7 dias**.

### Receita — Inadimplência (aba na página Receita)

- Card **Resultado R$** e **Resultado %** do período (jan–mês atual ou jun–dez).
- **Top 5** devedores — filtrar **sua área meta**.
- Evolução mensal (valores congelados mês a mês).

> **Importante:** o card **Resultado R$** não é a soma das linhas da evolução — é saldo líquido do período com compensação entre meses/grupos.

### Receita — gráficos

- **Comparativo mensal** (meta · previsto · recebido) — visão **por área** se estiver analisando desempenho.
- **Acumulado** — tendência do ano.

### Eficiência — abas de detalhe

Abrir quando o Overview mostrou vermelho/amarelo:

- SLA Protocolo · Eficiência Protocolo · SLA Vistagem (Risco/Normal) · Desenvolvimento Equipe.

Usar **Racional** para lista de casos e responsáveis.

### Inadimplência Pontual *(se tiver acesso)*

- Títulos **1–60 dias** fora do comitê — revisar o que pode subir para o comitê na semana seguinte.

---

## Rotina mensal (≈ 1 h)

| Módulo | O quê revisar |
|--------|----------------|
| **Receita** | Atingimento meta da área no mês fechado; gap meta × recebido; comparativo colunas por área |
| **OPEX** *(se liberado)* | Realizado vs orçamento · variação YTD · grupos de conta com maior desvio |
| **Escritório** | Horas e processos dos principais grupos da carteira |
| **Eficiência** | Retenção de talentos · Gestão de PDI (indicadores anuais/mensais) |
| **Inad. Judicializada** | Carteira ajuizada relevante para a área |

---

## OPEX — o que olhar *(acesso financeiro / sócio com módulo)*

**Menu:** OPEX

| Bloco | Uso para gestor |
|-------|-------------------|
| **KPIs** | Realizado no período · Orçamento · **Variação YTD %** |
| **Gráfico** Previsto × Realizado | Tendência mensal; clique no mês para detalhe |
| **Tabela por grupo de conta** | Onde estourou o orçamento |
| **Metas estratégicas** | Iniciativas do ano (substituição, projetos) |

**Frequência:** semanal para variação; mensal para metas estratégicas.

---

## Operações Legais *(só quem tem o módulo)*

Área separada (Maria Heloiza / Ops Legais) — **não** entra no filtro das 5 áreas jurídicas.

**Overview diário:** SLA protocolo, publicações, cadastro, treinamentos, retenção, PDI.

**Semanal:** Marketing (Instagram), Iniciativas estratégicas, Tarefas.

---

## Checklist rápido — imprimir ou fixar

### Todo dia útil

- [ ] Eficiência → Overview → **minha área** → SLAs + treinamento
- [ ] Receita → Gestão à vista → **atingimento meta** + inad. acumulada
- [ ] Inadimplência → filtros **urgente/atenção** → follow-ups pendentes
- [ ] (Se vermelho) abrir **Racional** do indicador estourado

### Toda semana

- [ ] Dashboard inadimplência (recuperação + top devedores)
- [ ] Receita → Inadimplência → Resultado R$ / Top 5 da área
- [ ] Revisar carteira pontual (se aplicável)
- [ ] Eficiência → abas de SLA com desvio

### Todo mês

- [ ] Fechar leitura de meta × recebido da área (Receita)
- [ ] OPEX variação YTD (se acesso)
- [ ] Horas/processos dos clientes críticos (Escritório)

---

## O que **não** precisa olhar todo dia

| Tela | Por quê |
|------|---------|
| Usuários / Configurações | Só admin |
| Cobrança WhatsApp | Operação financeira D+1 |
| Importação de orçamento OPEX | Eventual / financeiro |
| Indicadores Resultado / Amostra Chamados (Eficiência) | Admin / projeto específico |
| Configurações de metas Receita | Admin / financeiro |

---

## Dicas de leitura dos números

1. **Previsto ≠ Meta** — previsto é vencimento; meta é objetivo de faturamento.
2. **Recebido** — caixa líquido (sem encargos de boleto/juros na visão Receita).
3. **Trabalhista** — não tem SLA Vistagem Normal; só vistagem risco.
4. **Inadimplência Receita** — grupos consolidados (ex.: CDA); cliente sem grupo aparece sozinho.
5. **Comitê inadimplência (lista clássica)** ≠ **Inadimplência Receita** — o primeiro é operação de cobrança; o segundo é visão VIOS/meta por área.

---

## Onde pedir ajuda

| Assunto | Quem |
|---------|------|
| Liberar módulo / perfil | Admin (Usuários) |
| Dúvida de número Receita/OPEX | Financeiro (Juliana) |
| Regra de indicador Eficiência | Ops / BI (Lavínia) |
| Inclusão no comitê / resolver cliente | Financeiro / Admin |

---

## Documentos relacionados no repositório

- `docs/GUIA_SISTEMA_FINANCEIRO_BP.md` — perfis, comitê, cálculos inadimplência
- `docs/MANUAL_OPERACIONAL_SIOE.md` — fluxo operacional inadimplência
- `docs/APRESENTACAO_SISTEMA_SOCIO.md` — visão executiva do comitê
- `docs/TAXA_RECUPERACAO_COMITE.md` — regra da taxa desde 05/02/2026

---

*Última atualização: agosto/2026 — alinhado aos módulos Receita, OPEX, Eficiência, Ops Legais e perfis configuráveis em Usuários → Perfis padrão.*
