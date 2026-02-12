# Financeiro BP - Módulo de Inadimplência

Sistema interno de controle de inadimplência para escritório de advocacia, com classificação automática de risco (Classe A/B/C), régua de cobrança e dashboard estratégico.

## Stack

- **Frontend:** TypeScript, React 18, Vite 5
- **UI:** Tailwind CSS
- **Roteamento:** React Router 6
- **Backend/DB:** Supabase (PostgreSQL + Auth)
- **Gerenciador de pacotes:** npm ou pnpm

## Setup

1. Clone o repositório e instale as dependências:

```bash
pnpm install
# ou
npm install
```

2. Crie um projeto no [Supabase](https://supabase.com) e execute as migrations em `supabase/migrations/` (via Dashboard SQL ou CLI).

3. Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

4. Inicie o dev server:

```bash
pnpm dev
# ou
npm run dev
```

5. Acesse `/financeiro/inadimplencia` para a listagem Kanban e `/financeiro/inadimplencia/dashboard` para o dashboard estratégico.

## Estrutura do projeto

```
src/
  app/                    # App, router, layout
  features/inadimplencia/
    components/           # Card, modais, filtros, KPIs
    pages/                # InadimplenciaPage, InadimplenciaDashboardPage
    services/             # Supabase: inadimplencia, logs, pagamentos, dashboard
    hooks/                # useInadimplencia, useFiltros, useDashboard, mutations
    types/                # Tipos + schemas Zod
  shared/                  # Utils (cn, format), constants, hooks (useDebounce)
  lib/                     # supabaseClient, database.types
```

## Funcionalidades

- Cadastro de clientes inadimplentes (modal com validação Zod e máscara CNPJ)
- Classificação automática por aging: A (1–30 dias), B (31–60), C (61+)
- Cards estilo Kanban com indicador de prioridade (Urgente / Atenção / Controlado)
- Filtros com debounce: gestor, área, classe, valor, dias
- Registrar ação (ligação, e-mail, reunião, proposta, acordo) com atualização da última providência
- Registrar pagamento e histórico de ações
- Marcar como resolvido
- Dashboard: totais em aberto, recuperado no mês, % recuperação, ranking por gestor/área, tempo médio, gráfico por classe

## Importar planilha CDI (Excel)

Se você usava a planilha de controle de inadimplência (ex.: `CDI_20260211.xlsx`), pode importar os dados para o sistema:

1. Deixe o arquivo na raiz do projeto (ou informe o caminho).
2. Configure o `.env` com as variáveis do Supabase.
3. Rode:

```bash
npm run import:cdi
# ou com caminho explícito:
node scripts/import-cdi-xlsx.cjs "C:\caminho\para\CDI_20260211.xlsx"
```

O script lê a aba **QUADRO RESUMO** (cliente, classificação, saldo em aberto, observações, plano de ação, responsável), opcionalmente a **Planilha1** (providência e follow-up) e as abas por cliente para obter a última data de vencimento com valor em aberto. Clientes já existentes (mesmo nome) são atualizados; novos são inseridos.

## Supabase

As tabelas e RLS estão em `supabase/migrations/20240212000001_inadimplencia_schema.sql`. Ajuste as políticas RLS em produção conforme seu modelo de permissões (ex.: por `created_by` ou por role).
