---
name: gestao-financeira-escritorio-advocacia
description: Orienta o agente a pensar como gestor financeiro de escritório de advocacia. Inclui domínio de inadimplência (classes A/B/C, prioridade, régua de cobrança), KPIs, clientes por grupo, timesheets/horas e convenções do projeto Financeiro BP. Use ao desenvolver ou discutir funcionalidades de inadimplência, dashboard, módulo Escritório, relatórios, importação Excel ou migrações do sistema.
---

# Gestão financeira – escritório de advocacia

O agente deve adotar a mentalidade de um **gestor financeiro** em um escritório de advocacia: foco em inadimplência, recuperação de recebíveis, priorização por risco, follow-up e visão por gestor/área.

---

## Contexto do sistema (Financeiro BP)

- **Cliente:** Escritório Bismarchi Pires (BP). Sistema interno de controle de inadimplência e visão de clientes/timesheets.
- **Módulos:** Inadimplência (listagem Kanban, dashboard), Escritório (clientes por grupo, processos, horas).
- **Stack:** React + TypeScript + Vite, Supabase (PostgreSQL), TanStack Query, Tailwind, Radix UI.
- **Estrutura:** `src/features/inadimplencia`, `src/features/escritorio`; serviços em `services/`, hooks em `hooks/`, tipos em `@/lib/database.types` e em cada feature.

---

## Domínio – Inadimplência

### Classificação (classe)

- **A, B, C** definidos na reunião, caso a caso (histórico do cliente). Não há regra automática rígida.
- **Sugestão por dias** (apenas fallback no cadastro): A = 1–30 dias, B = 31–60, C = 61+.
- Uso: `status_classe` em `clients_inadimplencia`; constantes em `@/shared/constants/inadimplencia` (`CLASSES`, `CLASS_LABELS`).

### Prioridade (urgente / atenção / controlado)

- **Fórmula:** `score = dias_em_aberto * PESO_DIAS + (valor_em_aberto / 1000) * PESO_VALOR`.
- Constantes: `PESO_DIAS = 2`, `PESO_VALOR = 1`, `LIMIAR_URGENTE = 100`, `LIMIAR_ATENCAO = 50`.
- **Urgente:** score ≥ 100. **Atenção:** score ≥ 50. **Controlado:** score < 50.
- Implementação: `src/features/inadimplencia/services/prioridade.ts` e coluna gerada no banco.

### Ações de cobrança (régua)

- Tipos: `ligacao`, `email`, `reuniao`, `proposta`, `acordo`, `outro`.
- Registrar em `inadimplencia_logs`; manter `ultima_providencia` e `data_providencia` no cliente.
- **Follow-up:** campo `follow_up` e `data_follow_up`; alertas para vencidos ou a vencer em 7 dias.

### Pagamentos

- Tabela `inadimplencia_pagamentos`; formas: PIX, Transferência, Boleto, Dinheiro, Cartão, Outro (ver `FORMAS_PAGAMENTO` em constants).
- KPIs: valor total em aberto, recuperado no mês, percentual de recuperação, tempo médio de recuperação (dias).

### Tabelas principais

- **clients_inadimplencia:** inadimplentes (razao_social, cnpj, gestor, area, status_classe, dias_em_aberto, valor_em_aberto, valor_mensal, prioridade, follow_up, resolvido_at, etc.).
- **clientes_escritorio:** todos os clientes do escritório (fonte: VIOS Processos Completo); não confundir com inadimplentes. Campos: grupo_cliente, razao_social, cnpj, qtd_processos, horas_total, horas_por_ano (JSONB).
- **contagem_ci_por_grupo:** contagem de processos por grupo (ativo, arquivado, encerrado, etc.).
- **timesheets:** horas por grupo/ano; resumos em views (ex.: timesheets_resumo_por_grupo_ano).

---

## Domínio – Escritório e horas

- **Grupos:** clientes agrupados por `grupo_cliente`; dados agregados = empresas (clientes_escritorio) + contagem CI + horas (timesheets).
- **Horas:** armazenadas em decimal (ex.: 194,55). Formatação: `formatHorasHHMMSS` (HH:MM:SS) e `formatHorasDuracao` ("X horas e Y min") em `@/shared/utils/format.ts`.
- Sync: dados do escritório/timesheets vêm de scripts (ex.: vios-app); atualização diária.

---

## Convenções técnicas

- **Moeda e datas:** sempre pt-BR. Usar `formatCurrency`, `formatDate` de `@/shared/utils/format.ts`. CNPJ: `formatCnpj` e `parseCnpjMasked`.
- **Áreas/gestores:** vêm de `team_members` (Supabase). Áreas típicas: Sócio, Cível, Trabalhista, Distressed Deals, Reestruturação, Operações Legais, Tributário. E-mails @bpplaw.com.br.
- **Importação Excel:** scripts em `scripts/` (ex.: import-cdi-xlsx.cjs); abas QUADRO RESUMO, Planilha1, abas por cliente. Variáveis em `.env` (Supabase, login).
- **Migrações:** `supabase/migrations/` com timestamp no nome; RLS em todas as tabelas; políticas atuais permissivas para dev.

---

## Mentalidade do gestor (orientações)

- Priorizar **valor em aberto** e **dias em atraso**; urgente primeiro, depois atenção, depois controlado.
- Manter **follow-up** em dia; sugerir alertas para follow-ups vencidos ou próximos.
- Pensar em **recuperação**: total recuperado no mês, % de recuperação, tempo médio até quitar.
- Visão por **gestor** e por **área** para responsabilidade e rankings.
- Distinguir **cliente inadimplente** (clients_inadimplencia) de **base total do escritório** (clientes_escritorio); cruzamentos só quando fizer sentido (ex.: inadimplente que também está na base de clientes).
- Em relatórios ou textos para o escritório: linguagem clara, números formatados (BRL, %), evidência de tendências e ações recomendadas.

---

## Referência rápida

- Documentação completa: [DOCUMENTACAO_SISTEMA.md](../../../DOCUMENTACAO_SISTEMA.md) na raiz do projeto.
- Constantes inadimplência: `src/shared/constants/inadimplencia.ts`.
- Formatação: `src/shared/utils/format.ts`.
- Tipos DB: `src/lib/database.types.ts`.
