# Documentação do Sistema Financeiro BP

> Documentação completa para inclusão no ClickUp — ferramentas, arquitetura, funcionalidades e guias de uso.

---

## 1. Visão Geral

**Nome:** Financeiro BP  
**Tipo:** Sistema interno de controle de inadimplência  
**Cliente:** Escritório de Advocacia Bismarchi Pires (BP)  
**Objetivo:** Gerenciar clientes inadimplentes, classificação por risco, régua de cobrança e dashboard estratégico.

---

## 2. Stack Tecnológica (Ferramentas Utilizadas)

### 2.1 Frontend

| Ferramenta | Versão | Uso |
|------------|--------|-----|
| **React** | 18.3.1 | Biblioteca UI |
| **TypeScript** | 5.6.2 | Tipagem estática |
| **Vite** | 5.4.10 | Build e dev server |
| **React Router DOM** | 6.28.0 | Roteamento SPA |
| **TanStack React Query** | 5.59.0 | Cache, fetching e mutações assíncronas |
| **Tailwind CSS** | 3.4.14 | Estilização utility-first |
| **PostCSS** | 8.4.47 | Processamento CSS |
| **Autoprefixer** | 10.4.20 | Prefixos CSS |
| **Lucide React** | 0.563.0 | Ícones |
| **date-fns** | 4.1.0 | Manipulação de datas |
| **Zod** | 3.23.8 | Validação de schemas |
| **Sonner** | 2.0.7 | Toasts/notificações |
| **clsx** | 2.1.1 | Classes condicionais |
| **tailwind-merge** | 3.4.0 | Merge de classes Tailwind |
| **class-variance-authority** | 0.7.1 | Variantes de componentes |

### 2.2 Componentes UI (Radix UI)

| Pacote | Versão | Uso |
|--------|--------|-----|
| @radix-ui/react-avatar | 1.1.11 | Avatar de usuários |
| @radix-ui/react-dialog | 1.1.15 | Modais |
| @radix-ui/react-slot | 1.2.4 | Composição de componentes |

### 2.3 Backend e Infraestrutura

| Ferramenta | Versão | Uso |
|------------|--------|-----|
| **Supabase** | - | BaaS (Backend-as-a-Service) |
| **Supabase JS** | 2.45.0 | Cliente JavaScript para Supabase |
| **PostgreSQL** | (via Supabase) | Banco de dados relacional |

### 2.4 Desenvolvimento

| Ferramenta | Uso |
|------------|-----|
| **ESLint** | Linting |
| **pnpm** | Gerenciador de pacotes |
| **dotenv** | Variáveis de ambiente |
| **xlsx** | Leitura de planilhas Excel (scripts de importação) |

---

## 3. Arquitetura do Sistema

### 3.1 Estrutura de Pastas

```
financeiro-bp/
├── public/                     # Assets estáticos
├── scripts/                    # Scripts Node.js (importação Excel)
│   ├── import-cdi-xlsx.cjs     # Importar planilha CDI → Supabase
│   ├── verify-cdi-xlsx.cjs     # Verificar dados da planilha
│   ├── read-cdi-xlsx.cjs       # Ler planilha CDI
│   └── map-dados-xlsx.cjs      # Mapear dados de planilha
├── src/
│   ├── app/                    # App, rotas, layouts, login
│   │   ├── App.tsx
│   │   ├── Login.tsx
│   │   └── layouts/FinanceiroLayout.tsx
│   ├── components/ui/          # Componentes base (Button, Card, Input, etc.)
│   ├── features/inadimplencia/ # Módulo principal
│   │   ├── components/         # Componentes da feature
│   │   ├── hooks/              # Hooks React (queries, mutations)
│   │   ├── pages/              # Páginas
│   │   ├── services/           # Serviços Supabase
│   │   └── types/              # Tipos e schemas Zod
│   ├── shared/                 # Utils, constantes, hooks compartilhados
│   ├── lib/                    # Supabase client, auth, tipos DB
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/migrations/        # Migrações SQL
├── .env                        # Variáveis de ambiente (não versionado)
├── .env.example
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

### 3.2 Fluxo de Dados

1. **Login:** Auth simples via localStorage (`VITE_CRM_LOGIN_USER`, `VITE_CRM_LOGIN_PASSWORD`)
2. **API:** Supabase (PostgreSQL) via `@supabase/supabase-js`
3. **Estado:** React Query para cache e sincronização
4. **Validação:** Zod nos formulários
5. **UI:** Componentes Radix + Tailwind CSS

---

## 4. Banco de Dados (Supabase/PostgreSQL)

### 4.1 Tabelas

| Tabela | Descrição |
|--------|-----------|
| **clients_inadimplencia** | Clientes inadimplentes (principal) |
| **inadimplencia_logs** | Histórico de ações (ligação, email, etc.) |
| **inadimplencia_pagamentos** | Pagamentos registrados |
| **team_members** | Membros da equipe (gestores) com avatar |

### 4.2 Enums

- **inadimplencia_classe:** A, B, C (classificação de risco)
- **inadimplencia_tipo_acao:** ligacao, email, reuniao, proposta, acordo, outro

### 4.3 Campos Principais (clients_inadimplencia)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| razao_social | TEXT | Razão social do cliente |
| cnpj | TEXT | CNPJ |
| gestor | TEXT | E-mail do gestor responsável |
| area | TEXT | Área (Cível, Trabalhista, etc.) |
| status_classe | A/B/C | Classificação por histórico |
| dias_em_aberto | INTEGER | Dias desde vencimento |
| valor_em_aberto | NUMERIC | Valor em aberto |
| valor_mensal | NUMERIC | Valor mensal do contrato |
| prioridade | TEXT (generated) | urgente / atencao / controlado |
| ultima_providencia | TEXT | Última providência tomada |
| data_providencia | DATE | Data da providência |
| follow_up | TEXT | Follow-up |
| resolvido_at | TIMESTAMPTZ | Quando foi resolvido (null = em aberto) |

### 4.4 Prioridade (coluna gerada)

Fórmula: `score = dias_em_aberto * 2 + (valor_em_aberto / 1000)`

- **Urgente:** score ≥ 100  
- **Atenção:** score ≥ 50  
- **Controlado:** score &lt; 50  

---

## 5. Rotas e Páginas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Redirect | Redireciona para `/financeiro/inadimplencia` |
| `/financeiro/inadimplencia` | InadimplenciaPage | Listagem Kanban com cards e filtros |
| `/financeiro/inadimplencia/dashboard` | InadimplenciaDashboardPage | Dashboard com KPIs e gráficos |
| `*` | 404 | Redireciona para inadimplência |

---

## 6. Funcionalidades Detalhadas

### 6.1 Módulo de Inadimplência (Listagem)

- **Cadastro de clientes:** Modal com validação Zod e máscara CNPJ
- **Classificação:** A (1–30 dias), B (31–60), C (61+), definida na reunião caso a caso
- **Cards estilo Kanban:** indicador de prioridade (Urgente / Atenção / Controlado)
- **Filtros com debounce:** busca, gestor, área, classe, prioridade
- **Ordenação:** por data de criação, dias em aberto, valor, razão social
- **Registrar ação:** ligação, e-mail, reunião, proposta, acordo, outro
- **Registrar pagamento:** valor, data, forma de pagamento
- **Histórico de ações:** modal com logs
- **Marcar como resolvido**
- **Editar cliente**

### 6.2 Dashboard

- **Totais em aberto:** valor total de inadimplentes
- **Por classe:** A, B, C
- **Recuperado no mês:** pagamentos registrados no mês corrente
- **Percentual de recuperação**
- **Ranking por gestor/área**
- **Valor em aberto por gestor/área**
- **Tempo médio de recuperação (dias)**
- **Alertas de follow-up:** vencidos, a vencer em 7 dias
- **Gráfico por classe**

### 6.3 Equipe (team_members)

- Áreas: Sócio, Cível, Trabalhista, Distressed Deals, Reestruturação, Operações Legais, Tributário
- E-mails @bpplaw.com.br
- Avatares hospedados em bismarchipires.com.br

---

## 7. Autenticação

- **Tipo:** Login simples (usuário/senha fixos via env)
- **Variáveis:** `VITE_CRM_LOGIN_USER`, `VITE_CRM_LOGIN_PASSWORD`
- **Armazenamento:** `localStorage` (chave `crm_auth`)
- **Padrão:** gestor / gestor123 (alterável via .env)

---

## 8. Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| VITE_SUPABASE_URL | Sim | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Sim | Chave anônima do Supabase |
| VITE_CRM_LOGIN_USER | Não | Usuário de login (padrão: gestor) |
| VITE_CRM_LOGIN_PASSWORD | Não | Senha de login (padrão: gestor123) |

---

## 9. Scripts NPM / pnpm

| Script | Comando | Descrição |
|--------|---------|-----------|
| dev | `pnpm dev` | Servidor de desenvolvimento (Vite) |
| build | `pnpm build` | Build de produção (tsc + vite build) |
| preview | `pnpm preview` | Preview do build |
| lint | `pnpm lint` | ESLint |
| import:cdi | `pnpm import:cdi` | Importar planilha CDI para Supabase |
| verify:cdi | `pnpm verify:cdi` | Verificar planilha CDI |
| map:dados | `pnpm map:dados` | Mapear dados de planilha Excel |

### 9.1 Importação de Planilha CDI

Permite migrar dados da planilha Excel de inadimplência para o Supabase:

1. Colocar arquivo na raiz (ex.: `CDI_20260211.xlsx`)
2. Configurar `.env` com Supabase
3. Executar: `node scripts/import-cdi-xlsx.cjs` ou com caminho: `node scripts/import-cdi-xlsx.cjs "C:\caminho\arquivo.xlsx"`

**Abas lidas:** QUADRO RESUMO, Planilha1, abas por cliente (vencimentos)

---

## 10. Migrações Supabase

| Arquivo | Descrição |
|---------|-----------|
| 20240212000001_inadimplencia_schema.sql | Schema principal (tabelas, índices, RLS) |
| 20240212000002_team_members.sql | Tabela team_members + seed |
| 20240212000003_team_members_avatar_urls.sql | URLs de avatar |
| 20240212000004_valor_mensal.sql | Coluna valor_mensal |
| 20240212000005_processos_horas.sql | Colunas qtd_processos, horas_total, horas_por_ano |
| 20240212000006_prioridade_generated.sql | Coluna prioridade (gerada) |

---

## 11. Comitê de Inadimplência (visão estratégica)

### 11.1 Fluxo semanal

- **Comitê:** 1x por semana, com todos os sócios do escritório.
- **Na reunião:** a coordenadora do financeiro registra as **providências** definidas para cada inadimplente.
- **Após a reunião:** os gestores dão andamento registrando **follow-ups** ligados a cada providência.

### 11.2 Modelo de dados

- **Providência**
  - Entidade por inadimplente: texto da providência + **data de criação** (quando foi definida no comitê).
  - Criada pela coordenadora do financeiro na reunião.
  - Uma providência pode ter vários follow-ups.

- **Follow-up**
  - Sempre vinculado a **uma** providência.
  - Possui **tipo** (classificação do retorno):
    1. **Devolutiva** – retorno/resposta do cliente (ligação, e-mail respondido, etc.).
    2. **Cobrança** – contato ativo de cobrança (ligação feita, e-mail enviado, notificação).
    3. **Acordo** – andamento de acordo ou negociação (proposta, adiantamento, parcelamento).
  - Adicionados pelos **gestores** ao longo da semana.

### 11.3 Tabelas (Supabase)

- `providencias`: `id`, `cliente_inadimplencia_id`, `texto`, `created_at`, `created_by` (opcional).
- `providencia_follow_ups`: `id`, `providencia_id`, `tipo` (enum: devolutiva, cobranca, acordo), `texto`, `created_at`, `created_by` (opcional).

O sistema mantém os campos legados `ultima_providencia` e `data_providencia` em `clients_inadimplencia` para exibição rápida e compatibilidade; a evolução é exibir a última providência (e seus follow-ups) a partir das novas tabelas.

---

## 12. Segurança (RLS)

- Row Level Security habilitado em todas as tabelas
- Políticas atuais: permissivas para `authenticated` e `anon` (desenvolvimento)
- **Produção:** ajustar políticas por `created_by` ou role conforme modelo de permissões

---

## 13. Design System

- **Cores principais:** `primary` (#14324f), `primary-dark` (#101f2e), `sales` (#d5b170)
- **Fonte:** Herdada do sistema (sem font customizada declarada)
- **Responsividade:** Tailwind breakpoints (md, etc.)
- **Componentes base:** Button, Card, Input, Label, Textarea, Badge, Dialog, Avatar

---

## 14. Resumo para ClickUp

**Projeto:** Financeiro BP – Módulo de Inadimplência  

**Stack:** React 18 + TypeScript + Vite + Supabase (PostgreSQL) + Tailwind CSS + React Query + Radix UI  

**Principais entregas:**
- Listagem Kanban de inadimplentes com filtros e prioridade
- Dashboard com KPIs, rankings e gráficos
- Cadastro, edição, ações e pagamentos
- Importação de planilha Excel (CDI)
- Login simples e layout responsivo

**Ambiente:** `.env` com Supabase + credenciais de login  

**Deploy:** Build via `pnpm build`; hospedagem estática + Supabase como backend.

---

*Documentação gerada em fevereiro/2025.*
