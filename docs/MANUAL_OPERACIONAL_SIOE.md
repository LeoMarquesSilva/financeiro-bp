# Manual Operacional — SIOE

**Sistema Integrado de Operações Estratégicas**  
Controle de inadimplência e visão do escritório.

---

## 1. Acesso

| Item | Descrição |
|------|-----------|
| **URL** | https://financeiro-bp.vercel.app/ |
| **Login** | E-mail corporativo @bismarchipires.com.br |
| **Senha** | Bp@2026!|
| **Novos usuários** | Apenas administradores cadastram e definem o perfil de cada pessoa |

> **Recomendação:** altere a senha no primeiro login (menu **Meu Perfil**, no ícone do seu avatar no canto inferior da barra lateral).

---

## 2. Seu perfil — O que você pode fazer

| Perfil | Inadimplência | Dashboard | Escritório | Gestores |
|--------|---------------|-----------|------------|----------|
| **Financeiro** | Ver, incluir, editar, providenciar, resolver | Ver KPIs | Ver grupos e financeiro | — |
| **Comitê** | Ver + criar providências e follow-ups | Ver KPIs | — | — |

- **Comitê** não inclui clientes, não edita dados do grupo e não marca como resolvido.

---

## 3. Módulos — Onde fazer cada coisa

### Inadimplência (menu principal)

- **Tela:** lista de clientes inadimplentes em cards (grupo, classe, dias em atraso, valor em aberto, prioridade).
- **Clique no card** → abre o painel lateral com:
  - Empresas do grupo
  - Parcelas (em atraso, a vencer, pagas)
  - Providências e follow-ups
  - Processos por área
- **Filtros:** use os filtros acima da lista (gestor, área, classe, valor, dias, busca) para afunilar.
- **Prioridade:** calculada pelo sistema (Urgente / Atenção / Controlado) com base em dias e valor.

### Dashboard

- **Tela:** visão geral com totais em aberto, distribuição por classe (A/B/C), taxa de recuperação, alertas de follow-up e rankings.
- Uso: acompanhamento semanal e indicadores para o comitê.

### Escritório (Admin e Financeiro)

- **Tela:** todos os grupos/clientes com situação financeira, processos e horas (timesheets).
- **Filtros:** situação (todos, em atraso, a vencer etc.), valor mínimo e ordenação.
- Dados atualizados pelo sync diário (VIOS).

### Gestores (somente Admin)

- Cadastro de usuários e definição do perfil (Admin, Financeiro ou Comitê).

---

## 4. Fluxo do dia a dia

1. **Incluir cliente no comitê** (Financeiro ou Admin)  
   Botão **Novo cliente** → escolher grupo, gestores, áreas, classe (A/B/C). Valor em atraso é preenchido automaticamente quando houver parcelas no sistema.

2. **Registrar providência** (definida na reunião)  
   No painel do cliente → **Providências** → adicionar a ação (ex.: cobrança, negociação, proposta).

3. **Registrar follow-up** (atualização de andamento)  
   No painel do cliente → **Follow-ups** → informar a devolutiva ou o que foi feito. O sistema mostra quem criou e quando.  
   **Dica:** acompanhe os alertas de follow-up vencido ou a vencer no Dashboard.

4. **Registrar pagamento** (quando houver quitação/parcela paga)  
   No painel do cliente → **Pagamentos** → informar valor, forma e data.

5. **Marcar como resolvido** (Financeiro ou Admin)  
   Quando o caso for encerrado → no painel do cliente, usar **Marcar como resolvido**.

---

## 5. Busca e navegação

- **Busca global** (barra no topo): digite pelo menos 2 caracteres. Os resultados aparecem por módulo (Inadimplência / Escritório, conforme seu perfil). Use **Enter** para ir ao cliente ou grupo.
- **Menu lateral:** ícones para Inadimplência, Dashboard, Escritório e, se for Admin, Gestores e Configurações.
- **Perfil e sair:** clique no seu **avatar** (foto) no rodapé da barra lateral para abrir **Meu Perfil** ou usar o botão **Sair**.

---

## 6. Resumo rápido

| Ação | Onde |
|------|------|
| Ver inadimplentes e prioridades | Inadimplência |
| Abrir detalhes do cliente | Clicar no card → painel lateral |
| Criar providência / follow-up | Painel do cliente → abas Providências e Follow-ups |
| Registrar pagamento | Painel do cliente → Pagamentos |
| Marcar como resolvido | Painel do cliente (Financeiro ou Admin) |
| Ver totais e KPIs | Dashboard |
| Ver todos os grupos e horas | Escritório (Admin/Financeiro) |
| Cadastrar usuário / alterar perfil | Gestores (Admin) |
| Alterar senha ou dados pessoais | Avatar → Meu Perfil |

---

*Em caso de dúvida sobre acesso ou permissões, contate o administrador do sistema.*
