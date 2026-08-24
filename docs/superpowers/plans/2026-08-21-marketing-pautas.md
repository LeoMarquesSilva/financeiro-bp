# Marketing Pautas Implementation Plan

> **Execução:** inline nesta tarefa, por preferência do usuário; não usar o plugin Superpowers.

**Goal:** Exibir a meta mensal de 10 pautas e o fluxo operacional das tarefas de marketing do SIOE com responsáveis e fotos do ORQESTRAI.

**Architecture:** O dashboard carrega as linhas de marketing de `sp_tarefas_historico` junto dos dados do Instagram. Funções puras transformam as linhas em pautas e calculam estágio, atraso, meta e comparação. A interface reutiliza o seletor global de período e isola a visão detalhada em uma nova aba.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase, Tailwind CSS, Node Test Runner.

## Global Constraints

- Meta de pautas: 10 por mês para o escritório inteiro.
- Entrega: conclusão da tarefa principal `MATERIAL MARKETING - REELS/POST/ARTIGO`.
- Canceladas não contam na meta.
- Não inferir responsável ausente.
- Manter Alcance 15 mil/mês, Engajamento 3,5% e Postagens 12/mês.

---

### Task 1: Modelo e regras das pautas

**Files:**
- Create: `src/features/operacoes-legais/marketing/marketingPautas.ts`
- Modify: `src/features/operacoes-legais/marketing/types.ts`
- Create: `tests/marketing-pautas.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildMarketingPautas(rows)`, `summarizeMarketingPautas(pautas, range, now)`, `compareMarketingPautaPeriods(pautas, current, previous)`.

- [ ] Escrever fixtures literais para tarefa principal, revisão, protocolo, cancelamento e responsável ausente.
- [ ] Executar `node --test tests/marketing-pautas.test.ts` e confirmar falha por módulo ausente.
- [ ] Implementar tipos, agrupamento pelo CI e cálculo de estágio/atraso.
- [ ] Implementar meta proporcional de 10/mês e comparação de períodos.
- [ ] Executar o teste novo e `npm.cmd run test:marketing`.

### Task 2: Preservar responsável da agenda

**Files:**
- Modify: `scripts/sharepoint/transforms.mjs`
- Modify: `scripts/sharepoint/sync-sharepoint.mjs`
- Modify: `tests/marketing-pautas.test.ts`
- Create: `supabase/migrations/20260821210000_marketing_pautas_responsavel.sql`

**Interfaces:**
- Produces: `resolveTaskAssignee(row)` e coluna nullable `responsavel` nas duas tabelas de tarefas.

- [ ] Escrever testes com os aliases `Responsável`, `Responsável pela tarefa`, `Usuário responsável` e fallback nulo.
- [ ] Executar o teste e confirmar falha pela função ausente.
- [ ] Implementar o resolvedor sem inferir nomes e usá-lo nos dois mapeamentos do sync.
- [ ] Criar migration aditiva para `responsavel` com comentário e índice normalizado.
- [ ] Aplicar a migration no projeto SIOE e validar as colunas por consulta somente leitura.

### Task 3: Carregamento independente

**Files:**
- Modify: `src/features/operacoes-legais/marketing/instagramService.ts`
- Modify: `src/features/operacoes-legais/marketing/useInstagramMarketing.ts`
- Modify: `src/features/operacoes-legais/marketing/types.ts`

**Interfaces:**
- Produces: `instagramService.listMarketingTasks()` e `useMarketingPautas()`.
- Consumes: `MarketingTaskRow` da Task 1.

- [ ] Adicionar consulta paginada somente para a tarefa principal e suas filhas.
- [ ] Selecionar apenas os campos necessários, incluindo `responsavel`.
- [ ] Criar query independente com erro e retry isolados do dashboard do Instagram.
- [ ] Acrescentar `avatar_url` às pessoas do marketing.
- [ ] Executar TypeScript via `npm.cmd run build` e corrigir apenas erros do escopo.

### Task 4: Quarto indicador

**Files:**
- Modify: `src/features/operacoes-legais/marketing/MarketingTab.tsx`
- Modify: `src/features/operacoes-legais/marketing/MarketingOverview.tsx`

**Interfaces:**
- Consumes: resumo atual/anterior da Task 1 e dados da query da Task 3.

- [ ] Construir as pautas uma vez no `MarketingTab`.
- [ ] Passar comparação e meta para `MarketingOverview`.
- [ ] Alterar o grid para quatro cartões responsivos.
- [ ] Mostrar `Pautas`, progresso contra meta e delta do período anterior.
- [ ] Manter os outros três indicadores e suas metas sem alterações.

### Task 5: Aba operacional de pautas

**Files:**
- Create: `src/features/operacoes-legais/marketing/MarketingPautas.tsx`
- Modify: `src/features/operacoes-legais/marketing/MarketingTab.tsx`

**Interfaces:**
- Consumes: `MarketingPauta[]`, período, pessoas do ORQESTRAI e estado da query.

- [ ] Adicionar trigger `Pautas` com ícone de clipboard.
- [ ] Criar cartões do funil e alertas operacionais.
- [ ] Criar ranking por responsável com avatar oficial.
- [ ] Criar filtros por etapa, área e nome.
- [ ] Criar lista responsiva com etapa, prazo, atraso e estado sem responsável.
- [ ] Isolar erro, loading e estado vazio da aba.

### Task 6: Verificação final

**Files:**
- Validate only the files listed above.

- [ ] Executar `npm.cmd run test:marketing`.
- [ ] Executar `npm.cmd run build`.
- [ ] Executar `git diff --check` e revisar somente o diff autorizado.
- [ ] Verificar o localhost em desktop e mobile, incluindo período mensal e aba Pautas.
- [ ] Confirmar que canceladas não entram na meta e que responsáveis ausentes não são inferidos.
