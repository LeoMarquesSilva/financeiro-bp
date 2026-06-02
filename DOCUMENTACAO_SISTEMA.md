# Documentação do SIOE

> Documentação técnica e funcional do Sistema Integrado de Operações Estratégicas (SIOE).

---

## 1. Visão Geral

| Campo | Descrição |
|-------|-----------|
| **Nome** | SIOE (Sistema Integrado de Operações Estratégicas) |
| **Tipo** | Sistema interno de controle de inadimplência e visão do escritório |
| **Cliente** | Escritório de Advocacia Bismarchi Pires (BP) |
| **Objetivo** | Gerenciar clientes inadimplentes (classificação, prioridade, comitê), dashboard estratégico, visão de grupos/processos/horas e gestão de usuários. |

---

## 2. Stack Tecnológica

### 2.1 Frontend

| Ferramenta | Versão | Uso |
|------------|--------|-----|
| React | 18.3.1 | UI |
| TypeScript | 5.6.2 | Tipagem |
| Vite | 5.4.10 | Build e dev server |
| React Router DOM | 6.28.0 | Roteamento SPA |
| TanStack React Query | 5.59.0 | Cache, fetching e mutações |
| Tailwind CSS | 3.4.14 | Estilização |
| Lucide React | 0.563.0 | Ícones |
| date-fns | 4.1.0 | Datas |
| Zod | 3.23.8 | Validação de schemas |
| Sonner | 2.0.7 | Toasts |
| clsx / tailwind-merge / class-variance-authority | - | Classes condicionais e variantes |

### 2.2 UI (Radix UI)

- @radix-ui/react-avatar, dialog, popover, separator, slot, tooltip.

### 2.3 Backend e Infraestrutura

- **Supabase:** BaaS (Auth, PostgreSQL, RLS).
- **Deploy:** Vercel (SPA com rewrite para `index.html` em `vercel.json`).

### 2.4 Desenvolvimento

- ESLint, pnpm, dotenv, xlsx (scripts de importação).

---

## 3. Rotas e Páginas

| Rota | Página | Acesso |
|------|--------|--------|
| `/` | Redirect | → `/financeiro/inadimplencia` |
| `/financeiro/inadimplencia` | InadimplenciaPage | admin, financeiro, comite |
| `/financeiro/inadimplencia/dashboard` | InadimplenciaDashboardPage | admin, financeiro, comite |
| `/financeiro/escritorio` | EscritorioPage | admin, financeiro |
| `/financeiro/gestores` | TeamMembersPage | admin |
| `/financeiro/configuracoes` | ConfiguracoesPage | admin |
| `/financeiro/perfil` | PerfilPage | autenticado |
| `/reset-password` | ResetPassword | público (link do e-mail de recuperação) |
| `*` | Redirect | → `/financeiro/inadimplencia` |

**Layout:** Todas as rotas sob `/financeiro` usam `FinanceiroLayout` (sidebar + TopBar + outlet). Login e Reset Password são fora do layout.

---

## 4. Perfis de Acesso (Roles)

| Perfil | Inadimplência | Dashboard | Escritório | Gestores | Configurações | Busca global |
|--------|---------------|-----------|------------|----------|---------------|--------------|
| **admin** | Ver, incluir, editar, providenciar, resolver, reabrir | Ver todos os KPIs | Ver grupos e financeiro | CRUD usuários e roles | Alterar configurações | Inadimplência + Escritório |
| **financeiro** | Ver, incluir, editar, providenciar, resolver, reabrir | Ver todos os KPIs | Ver grupos e financeiro | — | — | Inadimplência + Escritório |
| **comite** | Ver + criar providências e follow-ups (sem incluir/editar clientes, sem resolver) | Ver todos os KPIs | — | — | — | Somente Inadimplência |

- **Comitê** não pode: incluir inadimplentes, editar dados do grupo, marcar como resolvido, excluir providências/follow-ups.
- Role definida em `team_members.role`; usuário deve existir no Supabase Auth e em `team_members` com `role` preenchido.

---

## 5. Autenticação

- **Provedor:** Supabase Auth (e-mail + senha).
- **Login:** E-mail corporativo (ex.: @bismarchipires.com.br) e senha. Primeiro acesso ou senha enviada pelo administrador.
- **Recuperação de senha:** Link “Esqueci minha senha” envia e-mail via Supabase; usuário acessa `/reset-password` (com hash do token) para definir nova senha (mín. 6 caracteres).
- **Alterar senha (logado):** Em **Meu Perfil** (`/financeiro/perfil`), formulário com senha atual e nova senha; chama RPC `change_user_password`.
- **Banner “Alterar senha”:** Exibido quando o usuário foi criado com senha temporária (flag no Supabase ou convenção); ao alterar, o banner some.

---

## 6. Módulos e Funcionalidades

### 6.1 Inadimplência (`/financeiro/inadimplencia`)

**Listagem**

- **Visualizações:** Grid de cards; Kanban por Classe (A, B, C); Kanban por Gestor. Alternância por botões acima da lista.
- **Filtros (com debounce):** Busca (nome ou CNPJ), Gestor, Área, Classe (A/B/C), Prioridade (Urgente, Atenção, Controlado), Ordenação (valor em aberto, dias em atraso, nome, data de cadastro) e direção (asc/desc).
- **KPIs no header:** Total em aberto, totais por classe (A, B, C), % recuperação do mês, (opcional) % recuperação comitê, alertas de follow-up (vencidos, a vencer em 7 dias).
- **Ações da lista:** “Ver resolvidos” / “Mostrando resolvidos” (toggle), “Exportar CSV” (exporta listagem com filtros atuais), “Incluir Inadimplente no Comitê” (admin/financeiro).
- **Paginação:** Controle de página e tamanho (ex.: 20 por página).

**Cards (grid ou Kanban)**

- Exibem: nome do grupo/razão social, classe (badge A/B/C), dias em atraso, valor em aberto, gestor(es) com avatar, área(s), prioridade (Urgente/Atenção/Controlado). Clique no card abre o painel lateral do cliente.

**Painel lateral (detalhe do cliente)**

- **Cabeçalho:** Nome, classe, prioridade, valor em aberto, dias em atraso; botões Editar (admin/financeiro), Marcar como resolvido (admin/financeiro), Reabrir (se já resolvido).
- **Seções (colapsáveis):**
  - **Empresas do grupo:** Lista de empresas (nome, CNPJ) do grupo.
  - **Parcelas:** Em atraso, a vencer, pagas (com data vencimento, valor, data baixa quando houver). Indicador de atraso (ok / atrasado / muito atrasado) quando houver data de baixa.
  - **Providências:** Lista de providências (texto, data, autor). Por providência: lista de **follow-ups** com tipo (Devolutiva, Cobrança, Acordo, Validar Acordo Comitê, Avaliar Devolutiva Comitê, Andamento de Negociação), texto, data e autor. Botões “Nova providência” e “Novo follow-up” (conforme perfil).
  - **Ações (logs):** Últimas ações (ligação, e-mail, reunião, proposta, acordo, outro) com data; link “Ver histórico”.
  - **Pagamentos:** Lista de pagamentos (valor, data, forma). Botão “Registrar pagamento” (admin/financeiro).
  - **Processos por área:** Contagem de processos por área jurídica (ativo, arquivado, encerrado, etc.).
  - **Histórico de alterações:** Modal com logs de alterações do cliente.

**Modais / ações**

- **Modal Cadastro (incluir no comitê):** Seleção de grupo (busca em pessoas/grupos), gestor(es), área(s), classe (A/B/C). Valor em atraso e valor mensal podem ser preenchidos automaticamente por parcelas ou manualmente.
- **Modal Editar Cliente:** Ajuste de gestor(es), área(s), classe, observações, etc.
- **Modal Nova Providência:** Texto e data da providência (definida no comitê).
- **Modal Novo Follow-up:** Vinculado a uma providência; tipo (devolutiva, cobranca, acordo, validar_acordo_comite, avaliar_devolutiva_comite, andamento_negociacao) e texto.
- **Modal Registrar Ação:** Tipo (ligação, email, reuniao, proposta, acordo, outro) e observação; atualiza última providência no cliente.
- **Modal Registrar Pagamento:** Valor, data, forma (PIX, Transferência, Boleto, Dinheiro, Cartão, Outro).
- **Confirmar resolver / Reabrir:** Confirmação antes de marcar como resolvido ou reabrir.

**Exportação**

- Botão “Exportar CSV”: gera CSV da listagem atual (respeitando filtros e ordenação), até 10.000 registros.

**Classificação e prioridade**

- **Classes (A, B, C):** Definidas manualmente no cadastro/edição. Labels: A = “Grau A – Bom pagador”, B = “Grau B – Atrasos recorrentes”, C = “Grau C – Inadimplente crônico”.
- **Prioridade:** Calculada apenas por **dias em atraso**, usando limites configuráveis em Configurações (admin). Padrão: Controlado (0–2 dias), Atenção (3–5 dias), Urgente (≥ 6 dias). Exibida em cards e no detalhe.

---

### 6.2 Dashboard (`/financeiro/inadimplencia/dashboard`)

- **Resumo:** Total em aberto, total recuperado no mês, % recuperação, tempo médio de recuperação (dias).
- **Taxa de recuperação do comitê (opcional):** Se habilitada em Configurações: total recuperado desde 05/02/2026, valor total em aberto (início comitê), % recuperação comitê; rankings “recuperado desde 05/02” por gestor e por área.
- **Por classe:** Totais em aberto por A, B, C e gráfico (GraficoClasses).
- **Rankings:** Recuperação no mês por gestor e por área; valor em aberto por gestor e por área (listas com avatar quando houver).
- **Alertas:** Follow-ups vencidos e a vencer em 7 dias (resumo no dashboard).

---

### 6.3 Escritório (`/financeiro/escritorio`)

- **Objetivo:** Visão de todos os grupos/clientes com dados de processos (contagem CI), horas (timesheets) e situação financeira (relatório financeiro).
- **Cards de totais:** Valores “A vencer”, “Em atraso”, “Em aberto (total)”, “Pago” e quantidade de grupos em cada.
- **Filtros:** Busca por nome/grupo (debounce), situação financeira (todos, em atraso, a vencer, em aberto, com pago), valor mínimo em aberto, ordenação (nome, atraso, a vencer, aberto, pago).
- **Listagem:** Cards por grupo com resumo (nome do grupo, quantidade de empresas, valor em aberto, valor pago, processos, horas). Paginação (ex.: 12 grupos por página). Clique no grupo ou em empresa abre o **painel lateral do escritório**.
- **Painel lateral (ClienteEscritorioDetailSheet):** Dados do grupo e empresas; processos por área; horas (timesheets); resumo financeiro (aberto, pago, em atraso). Dados atualizados pelo sync (VIOS).

---

### 6.4 Gestores (`/financeiro/gestores`)

- **Listagem:** Membros da equipe com avatar, nome, e-mail, área e role (Admin, Financeiro, Comitê). Separação entre “Com role” e “Sem role”.
- **Criar usuário:** Modal com e-mail, nome completo, área, avatar_url (opcional) e role. Criação no Supabase Auth (senha temporária ou convite) e inserção em `team_members`.
- **Alterar role:** Por usuário, seleção de role (admin, financeiro, comite) ou remoção de role.
- **Excluir:** Exclusão do `team_members` (e eventualmente do Auth, conforme política do escritório).

---

### 6.5 Configurações (`/financeiro/configuracoes`)

- **Exibir Taxa de recuperação do comitê:** Switch para mostrar ou ocultar no Dashboard e no header da Inadimplência a seção/KPI “Taxa de recuperação (desde 05/02/2026)”. Afeta todos os usuários (admin, financeiro, comitê).
- **Prioridade (urgência):** Configuração dos limites de **dias em atraso** para cada nível:
  - Controlado (máx. dias): 0 a X = Controlado.
  - Atenção (mín. e máx. dias): entre mín e máx = Atenção.
  - Urgente (mín. dias): ≥ X = Urgente.
  Validação: Controlado máx. < Atenção mín. ≤ Atenção máx. < Urgente mín. Ao salvar, a prioridade dos clientes é recalculada (coluna gerada ou cálculo em tempo real conforme implementação).

---

### 6.6 Perfil (`/financeiro/perfil`)

- Exibição de nome, e-mail, avatar e role (label: Administrador, Financeiro, Comitê).
- **Alterar senha:** Campos senha atual, nova senha e confirmação; mínimo 6 caracteres. Chama RPC `change_user_password`. Toasts de sucesso/erro (ex.: “Senha atual incorreta”).

---

## 7. Busca Global (TopBar)

- **Disparo:** Digitar na barra de busca (mín. 2 caracteres); resultados em tempo real.
- **Escopo por perfil:** Admin e Financeiro: Inadimplência (clients_inadimplencia_list, não resolvidos) + Escritório (escritorio_empresas_por_grupo). Comitê: apenas Inadimplência.
- **Navegação:** Setas ↑↓, Enter para abrir o item; Esc fecha. Inadimplência → `/financeiro/inadimplencia?busca=...` ou foco no cliente; Escritório → `/financeiro/escritorio?busca=...`.

---

## 8. Cálculos e Regras de Negócio

### 8.1 Dias em atraso

- Considera parcelas **abertas** (não baixadas) de **todas as empresas do grupo** com `data_vencimento < hoje`.
- Dias em atraso = `hoje − data_vencimento` da parcela **mais antiga** vencida.
- Se não houver parcelas vinculadas, usa valor manual do cadastro.

### 8.2 Valor em aberto

- Soma do valor das parcelas em atraso (abertas, vencimento &lt; hoje) de todas as empresas do grupo. Atualizado pelo sync do relatório financeiro e/ou valor informado no cadastro.

### 8.3 Valor mensal (próxima parcela)

- Valor da próxima parcela a vencer (parcelas abertas com `data_vencimento ≥ hoje`, ordenadas por data; primeira = valor mensal). Caso não haja, usa valor manual.

### 8.4 Prioridade

- **Apenas dias em atraso** (valor não entra no cálculo). Limites configuráveis em Configurações (controlado_max, atencao_min, atencao_max, urgente_min). Ex.: 0–2 Controlado, 3–5 Atenção, ≥6 Urgente.

### 8.5 Taxa de recuperação do comitê

- Data de início: 05/02/2026. Pagamentos registrados a partir dessa data (em `inadimplencia_pagamentos`) entram no total recuperado; valor total em aberto “início comitê” é reconstruído (em aberto atual + total pago desde 05/02). Fórmula de % conforme implementação (ex.: recuperado / (aberto_início + recuperado)).

---

## 9. Banco de Dados (Supabase) – Principais entidades

| Tabela / View | Descrição |
|--------------|-----------|
| clients_inadimplencia | Inadimplentes (grupo, gestor, área, classe, dias/valor em aberto, prioridade, ultima_providencia, follow_up, resolvido_at, etc.) |
| clients_inadimplencia_list | View/listagem para listagem e busca (com prioridade, gestor, area, etc.) |
| inadimplencia_logs | Ações (ligação, email, reuniao, proposta, acordo, outro) |
| inadimplencia_pagamentos | Pagamentos (client_id, valor_pago, data_pagamento, forma) |
| providencias | Providências por cliente inadimplente (texto, data_providencia, created_by) |
| providencia_follow_ups | Follow-ups por providência (tipo: devolutiva, cobranca, acordo, validar_acordo_comite, avaliar_devolutiva_comite, andamento_negociacao) |
| team_members | Usuários (email, full_name, area, avatar_url, role) |
| pessoas | Base de pessoas/empresas e grupos (fonte: VIOS e cadastros) |
| relatorio_financeiro / relatorio_financeiro_resumo_por_cliente | Parcelas e resumo financeiro por cliente (sync VIOS) |
| financeiro_parcelas | Parcelas do relatório financeiro (sync) |
| financeiro_parcelas_itens | Itens/linhas por título (detalhamento VIOS; FK `ci_titulo` → `financeiro_parcelas`) |
| timesheets | Horas por grupo/ano (sync) |
| contagem_ci_por_grupo | Contagem de processos por grupo |
| app_settings | Configurações (ex.: exibir_taxa_recuperacao_comite, prioridade_dias) |

**RLS:** Habilitado nas tabelas; políticas devem ser ajustadas em produção por role ou `created_by` conforme necessidade.

---

## 10. Integrações e Sync (VIOS)

- **Processo Completo (XLSX):** Atualiza pessoas, grupos, processos (contagem CI) e horas. Scripts: `sync-vios-to-supabase.cjs`; no servidor pode rodar dentro do vios-app (pasta `scripts/para-vios-app/`).
- **TimeSheets:** Sync para tabela `timesheets` (data, grupo cliente, cliente, total de horas).
- **Relatório financeiro (parcelas):** Sync para `financeiro_parcelas`; RPC `sync_relatorio_financeiro_replace` (fonte da verdade: remove registros que não vêm no relatório e faz upsert). Migração: `20260309170100_sync_relatorio_financeiro_replace.sql`.
- **Relatório financeiro (itens):** Sync para `financeiro_parcelas_itens`; RPC `sync_relatorio_financeiro_itens_replace` (replace por `ci_item`; exige `ci_titulo` já em `financeiro_parcelas`). Migração: `20260602120000_financeiro_parcelas_itens.sql`. Função Node: `runSyncRelatorioFinanceiroItens`.
- **Módulo Receita (admin):** Rota `/financeiro/receita`; metas em `app_settings.receita_metas`; totais via RPC `receita_totais_mensais(ano)` (recebido = `data_pagamento` + `valor_pago_item`; previsto = `data_vencimento` + `valor_item`; exclui 6 planos de honorários fora do escopo).
- **Automação local (opcional):** `pnpm vios:baixar-e-sync` (Playwright baixa o Excel; em seguida roda o sync). Variáveis: `VIOS_USER`, `VIOS_PASS`, `VIOS_REPORT_PATH`, `VIOS_HEADLESS`.

Detalhes: `scripts/README_VIOS_SYNC.md`.

---

## 11. Scripts NPM / pnpm

| Script | Comando | Descrição |
|--------|---------|-----------|
| dev | `pnpm dev` | Servidor de desenvolvimento (Vite) |
| build | `pnpm build` | Build de produção (tsc + vite build) |
| preview | `pnpm preview` | Preview do build |
| lint | `pnpm lint` | ESLint |
| import:cdi | `pnpm import:cdi` | Importar planilha CDI (Excel) para Supabase |
| verify:cdi | `pnpm verify:cdi` | Verificar planilha CDI |
| map:dados | `pnpm map:dados` | Mapear dados de planilha Excel |
| sync:vios | `pnpm sync:vios` | Sincronizar Processo Completo (XLSX) com Supabase |
| vios:baixar-e-sync | `pnpm vios:baixar-e-sync` | Baixar via Playwright + sync (local) |
| seed:auth | `pnpm seed:auth` | Seed de usuários Auth (conforme script) |

---

## 12. Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| VITE_SUPABASE_URL | Sim | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Sim | Chave anônima do Supabase |

Para scripts locais (VIOS): `VIOS_USER`, `VIOS_PASS`, `VIOS_REPORT_PATH`, `VIOS_HEADLESS` (opcional).

---

## 13. Estrutura de Pastas (src)

```
src/
├── app/                    # Rotas, layout, login, reset password
│   ├── App.tsx
│   ├── Login.tsx
│   ├── ResetPassword.tsx
│   ├── layouts/FinanceiroLayout.tsx
│   └── components/         # AppSidebar, TopBar
├── components/ui/          # Button, Card, Input, Dialog, Sheet, Avatar, Badge, etc.
├── features/
│   ├── inadimplencia/      # Páginas, hooks, services, components (cards, modais, sheet)
│   ├── escritorio/         # EscritorioPage, GrupoEscritorioCard, ClienteEscritorioDetailSheet, hooks, services
│   ├── gestores/           # TeamMembersPage
│   ├── configuracoes/      # ConfiguracoesPage, hooks (useExibirTaxaRecuperacaoComite, usePrioridadeConfig)
│   └── perfil/             # PerfilPage, ForcePasswordChange
├── shared/                 # constants (inadimplencia), utils (format), hooks (useDebounce), components (TeamMemberSelect, etc.)
└── lib/                    # supabaseClient, AuthContext, database.types, teamMembersService, teamAvatars, appSettingsService
```

---

## 14. Design e UX

- **Cores:** primary, primary-dark, sales (destaque), estados (urgente, atenção, controlado, classes A/B/C).
- **Layout:** Sidebar fixa (ícones), TopBar com busca e logo; conteúdo principal à direita.
- **Navegação:** Avatar no rodapé da sidebar → Meu Perfil; botão Sair. Menu lateral: Inadimplência, Dashboard, Escritório, Gestores (admin), Configurações (admin).
- **Responsividade:** Tailwind breakpoints; listagens e cards adaptáveis.

---

## 15. Resumo Executivo

**Projeto:** SIOE – Módulo de Inadimplência e Visão do Escritório  

**Stack:** React 18, TypeScript, Vite, Supabase (Auth + PostgreSQL), Tailwind CSS, React Query, Radix UI. Deploy: Vercel.

**Principais entregas:**

- Inadimplência: listagem (grid/Kanban por classe/gestor), filtros, KPIs, painel do cliente (parcelas, providências, follow-ups, ações, pagamentos), export CSV, prioridade configurável por dias.
- Dashboard: totais, % recuperação, taxa comitê (opcional), rankings, gráfico por classe, alertas de follow-up.
- Escritório: grupos, filtros por situação financeira, processos e horas (sync VIOS).
- Gestores: CRUD de usuários e atribuição de roles (admin, financeiro, comitê).
- Configurações: exibição da taxa comitê e limites de prioridade (dias).
- Perfil: alteração de senha (RPC). Login e recuperação de senha via Supabase Auth.

**Acesso:** E-mail corporativo e senha; roles em `team_members`. RLS em produção deve refletir políticas por role/usuário.

---

*Documentação atualizada em março/2026.*
