# Sistema Financeiro BP — Apresentação Executiva

**Para:** Sócios e gestores do escritório  
**Objetivo:** Visão geral do sistema de controle de inadimplência e gestão financeira  
**Data:** Março/2026

---

## O que é o Sistema Financeiro BP?

Sistema interno desenvolvido para o **Escritório Bismarchi Pires** com foco em:

1. **Controle de inadimplência** — acompanhamento de clientes em atraso, com classificação por risco e prioridade
2. **Comitê de inadimplência** — registro de providências e follow-ups nas reuniões semanais
3. **Visão do escritório** — clientes por grupo, processos e horas (timesheets)
4. **Dashboard estratégico** — KPIs e indicadores de recuperação

---

## Como funciona (em 4 pilares)

### 1. Inadimplência — O coração do sistema

- **Clientes inadimplentes** são exibidos em cards com:
  - Nome do grupo, classe (A/B/C), dias em atraso, valor em aberto
  - Gestor(es) responsável(is), área jurídica, prioridade (urgente / atenção / controlado)

- **Detalhe do cliente** (painel lateral):
  - Empresas do grupo, parcelas (em atraso, a vencer, pagas)
  - Providências definidas no comitê + follow-ups dos gestores
  - Processos por área jurídica e histórico de alterações

- **Cálculos automáticos:**
  - Dias em atraso = parcela mais antiga vencida
  - Valor em aberto = soma das parcelas em atraso
  - Prioridade = baseada em dias e valor (urgente > 5 dias, atenção 3–5, controlado < 3)

### 2. Dashboard — KPIs em tempo real

- Total em aberto
- Distribuição por classe (A/B/C)
- Taxa de recuperação no mês
- Alertas de follow-up vencidos ou a vencer
- Rankings por gestor e área

### 3. Escritório — Visão global

- Todos os grupos/clientes com filtros por situação financeira
- Dados por grupo: valor em aberto, processos, horas (timesheets)
- Integração com dados do VIOS (Processo Completo e TimeSheets)

### 4. Gestores — Administração

- Cadastro de usuários e atribuição de perfis (Admin / Financeiro / Comitê)
- Controle de acesso por módulo

---

## Perfis de acesso

| Perfil | O que pode fazer |
|--------|------------------|
| **Admin** | Acesso total: inadimplência, dashboard, escritório, gestores |
| **Financeiro** | Inadimplência, dashboard, escritório (sem gestores) |
| **Comitê** | Visualizar inadimplência, criar providências e follow-ups (sem incluir/editar clientes) |

---

## Fluxo de trabalho do Comitê

```
1. FINANCEIRO/ADMIN inclui grupo no comitê
   → Seleciona grupo, gestores, áreas, classe
   → Valor em atraso é calculado automaticamente

2. FINANCEIRO/COMITÊ cria PROVIDÊNCIAS
   → Ações definidas na reunião (cobrar, negociar, etc.)

3. COMITÊ/FINANCEIRO/ADMIN criam FOLLOW-UPS
   → Atualizações sobre o andamento (devolutiva, cobrança, acordo)

4. Quando resolvido → FINANCEIRO/ADMIN marca como resolvido
```

---

## Integrações e atualizações

- **Parcelas** — vinculadas ao relatório financeiro do VIOS; cálculo automático de dias e valor em aberto
- **Sync diário** — Processo Completo e TimeSheets atualizam pessoas, processos e horas no Supabase
- **Tabela pessoas** — base central unificada (clientes, leads, prospects, inativos)
- **Importação Excel** — CDI antigo pode ser migrado para o sistema

---

## Tecnologia

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL)
- **Deploy:** Vercel
- **Login:** e-mail corporativo @bismarchipires.com.br
- **Senha primeiro acesso: ** Bp@2026!


O **Sistema Financeiro BP** centraliza o controle de inadimplência do escritório em um único lugar:

- **Comitê:** reunião semanal → providências definidas → follow-ups ao longo da semana
- **Priorização:** urgente > atenção > controlado, com base em dias e valor
- **Visibilidade:** dashboard com KPIs e alertas; busca global por cliente
- **Integração:** dados do VIOS (processos, horas, parcelas) sincronizados diariamente

---

*Documento gerado com base na documentação e guias do sistema.*
