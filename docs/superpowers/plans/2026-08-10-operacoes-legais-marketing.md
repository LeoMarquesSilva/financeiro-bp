# Operações Legais Marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a aba Marketing completa no dashboard de Operações Legais, com histórico migrável e sincronização segura do Instagram.

**Architecture:** React/Vite consulta tabelas locais do Supabase. Uma Edge Function autenticada consulta a Meta e persiste snapshots; um script idempotente importa o histórico do ORQESTRAI. Cálculos analíticos ficam em funções puras testáveis.

**Tech Stack:** React 18, TypeScript, React Query, Recharts, Supabase/Postgres/Edge Functions, Node 24 test runner.

## Global Constraints

- Nunca expor `TOKEN_META_BP`, service role ou credenciais do ORQESTRAI no frontend.
- Leitura requer autenticação e acesso a Operações Legais; escrita manual requer admin ou área Marketing.
- Sync automático a cada 6 horas; operações idempotentes.
- Preservar o visual e as convenções existentes no `financeiro-bp`.

---

### Task 1: Modelo analítico e testes

**Files:**
- Create: `src/features/operacoes-legais/marketing/types.ts`
- Create: `src/features/operacoes-legais/marketing/instagramAnalytics.ts`
- Create: `src/features/operacoes-legais/marketing/instagramPeriod.ts`
- Test: `tests/instagram-marketing.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `summarizeInstagram(posts)`, `filterPostsByPeriod(posts, period)`, `rankAreas(posts)` e tipos compartilhados.

- [x] Escrever testes que cubram taxa de engajamento, agregação, períodos, formatos e áreas.
- [x] Executar `npm.cmd run test:marketing` e confirmar falha por módulos ausentes.
- [x] Implementar as funções puras mínimas.
- [x] Reexecutar os testes e confirmar sucesso.

### Task 2: Banco, autorização e migração histórica

**Files:**
- Create: `supabase/migrations/20260810183134_operacoes_legais_marketing_instagram.sql`
- Create: `scripts/migrate-orqestrai-instagram.mjs`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces: tabelas Instagram, `current_user_can_manage_marketing()` e `update_instagram_post_links(...)`.

- [x] Criar o teste contratual de migração SQL no teste Node.
- [x] Confirmar a falha antes da migration existir.
- [x] Criar tabelas, índices, RLS, função de permissão e RPC de edição.
- [x] Implementar importação paginada/upsert com `--dry-run` e mapeamento de solicitantes.
- [x] Confirmar testes de contrato e dry-run seguro.

### Task 3: Edge Function Meta

**Files:**
- Create: `supabase/functions/instagram-sync/index.ts`
- Create: `supabase/functions/instagram-sync/meta.ts`
- Create: `supabase/functions/instagram-sync/normalize.ts`
- Test: `tests/instagram-meta-normalize.test.ts`

**Interfaces:**
- Consumes: `TOKEN_META_BP`, `META_IG_ACCOUNT_ID` opcional, Supabase service role.
- Produces: ações `sync`, `stories`, `audience` e resposta com totais sincronizados.

- [x] Testar normalização e fallback de métricas antes da implementação.
- [x] Implementar descoberta da conta Business e consultas Graph API paginadas.
- [x] Persistir posts, conta, stories, insights e demografia por upsert.
- [x] Validar JWT para ações manuais e segredo para o agendamento.
- [x] Adicionar configuração SQL/documentada para execução a cada seis horas.

### Task 4: Serviço e hooks do frontend

**Files:**
- Create: `src/features/operacoes-legais/marketing/instagramService.ts`
- Create: `src/features/operacoes-legais/marketing/useInstagramMarketing.ts`
- Create: `src/features/operacoes-legais/marketing/marketingAccess.ts`
- Test: `tests/instagram-marketing-access.test.ts`

**Interfaces:**
- Produces: queries React Query, `syncInstagram()` e `updatePostLinks()`.

- [x] Testar regras admin/Marketing e somente leitura.
- [x] Implementar consultas e mutações com invalidação de cache.
- [x] Garantir estados de erro, loading e ausência de dados.

### Task 5: Interface completa

**Files:**
- Create: `src/features/operacoes-legais/marketing/MarketingTab.tsx`
- Create: `src/features/operacoes-legais/marketing/MarketingOverview.tsx`
- Create: `src/features/operacoes-legais/marketing/MarketingAudience.tsx`
- Create: `src/features/operacoes-legais/marketing/MarketingAreas.tsx`
- Create: `src/features/operacoes-legais/marketing/MarketingPosts.tsx`
- Create: `src/features/operacoes-legais/marketing/MarketingCharts.tsx`
- Modify: `src/features/operacoes-legais/pages/OperacoesLegaisPage.tsx`

**Interfaces:**
- Consumes: hooks, analytics e permissões das tarefas anteriores.
- Produces: aba Marketing com quatro subabas responsivas.

- [x] Inserir a aba Marketing e ocultar os filtros globais quando ativa.
- [x] Implementar visão geral e gráficos.
- [x] Implementar conta/audiência e demografia.
- [x] Implementar ranking e detalhamento por área.
- [x] Implementar listagem, filtros, paginação e edição de vínculos.
- [x] Implementar estados loading/vazio/erro e sincronização manual autorizada.

### Task 6: Verificação final

**Files:**
- Modify: `src/vite-env.d.ts`
- Modify: documentação operacional conforme necessário.

- [x] Executar `npm.cmd run test:marketing`.
- [ ] Executar `npm.cmd run lint` — bloqueado pela ausência pré-existente de `eslint.config.*` no projeto (ESLint 9).
- [x] Executar `npm.cmd run build` fora do sandbox se necessário.
- [x] Verificar que o bundle não contém tokens nem service-role.
- [x] Revisar `git diff` e garantir que somente o escopo autorizado está incluído.
