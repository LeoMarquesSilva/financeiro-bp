# SIOE (Sistema Integrado de Operações Estratégicas) — Guia de Acesso e Funcionamento

## 1. Acesso ao Sistema

| Informação        | Detalhe                                              |
|-------------------|------------------------------------------------------|
| **URL**           | *(URL do Vercel do projeto)*                         |
| **Senha padrão**  | `Bp@2026!`                                           |
| **Login**         | E-mail corporativo `@bismarchipires.com.br`          |
| **Cadastro**      | Somente administradores podem criar novos usuários   |

> Ao fazer o primeiro login, recomendamos alterar a senha.

---

## 2. Perfis de Acesso (Roles)

O sistema possui **3 perfis** com diferentes níveis de permissão:

### ADMIN — Acesso total

| Módulo             | Permissão                                         |
|--------------------|---------------------------------------------------|
| Inadimplência      | Visualizar, incluir, editar, providenciar, resolver |
| Dashboard          | Visualizar todos os KPIs e gráficos               |
| Escritório         | Visualizar todos os grupos, empresas e financeiro  |
| Gestores           | Criar, editar e gerenciar usuários e roles         |
| Busca global       | Inadimplência + Escritório                         |

**Usuários Admin:**
- Felipe Camargo (`felipe@bismarchipires.com.br`)
- Leonardo Marques Silva (`leonardo.marques@bismarchipires.com.br`)
- Samuel Willian Silva (`samuel@bismarchipires.com.br`)
- Vinicius Schmockel Marques (`vinicius.marques@bismarchipires.com.br`)

---

### FINANCEIRO — Gestão operacional

| Módulo             | Permissão                                         |
|--------------------|---------------------------------------------------|
| Inadimplência      | Visualizar, incluir, editar, providenciar, resolver |
| Dashboard          | Visualizar todos os KPIs e gráficos               |
| Escritório         | Visualizar todos os grupos, empresas e financeiro  |
| Gestores           | **Sem acesso**                                     |
| Busca global       | Inadimplência + Escritório                         |

**Usuária Financeiro:**
- Juliana Herculano Bangart (`juliana.pires@bismarchipires.com.br`)

---

### COMITÊ — Visualização, providências e follow-ups

| Módulo             | Permissão                                         |
|--------------------|---------------------------------------------------|
| Inadimplência      | Visualizar + criar providências e follow-ups       |
| Dashboard          | Visualizar todos os KPIs e gráficos               |
| Escritório         | **Sem acesso**                                     |
| Gestores           | **Sem acesso**                                     |
| Busca global       | Somente Inadimplência                              |

**O que o Comitê NÃO pode fazer:**
- Incluir novos inadimplentes
- Editar dados de clientes
- Marcar como resolvido
- Excluir providências ou follow-ups

**Usuários Comitê:**
- Daniel Pressatto Fernandes, Giancarlo Zotini, Gustavo Bismarchi
- Jorge Pecht Souza, Leonardo Loureiro Basso, Michel Malaquias
- Renato Vallim, Ricardo Viscardi Pires, Wagner Armani

---

## 3. Módulos do Sistema

### 3.1 Inadimplência (todos os perfis)

Tela principal de acompanhamento de clientes inadimplentes. Cada cliente é um **grupo** (ex: "Grupo Metalcasty") que pode conter várias empresas.

**Informações exibidas no card:**
- Nome do grupo / razão social
- Classe (A, B ou C)
- Dias em atraso
- Valor em aberto
- Gestor(es) responsável(is) com avatar
- Área(s) jurídica(s)
- Prioridade (urgente / atenção / controlado)

**Detalhe do cliente (Sheet lateral):**
- Informações gerais + lista de empresas do grupo
- Parcelas (em atraso, a vencer, pagas)
- Providências + follow-ups com avatar do autor
- Processos separados por área jurídica
- Histórico de alterações

### 3.2 Dashboard (todos os perfis)

Visão consolidada com KPIs:
- Total em aberto
- Distribuição por classe (A/B/C)
- Taxa de recuperação
- Alertas de follow-up vencidos

### 3.3 Escritório (admin e financeiro)

Visão geral do escritório com todos os grupos/clientes:
- Filtros por situação financeira, valor mínimo e ordenação
- Dados financeiros agregados por grupo
- Contagem de processos e horas (timesheets)

### 3.4 Gestores (somente admin)

Painel de gerenciamento de usuários:
- Cadastrar novos membros da equipe
- Atribuir e alterar roles (admin / financeiro / comitê)
- Visualizar lista de membros com seus papéis

---

## 4. Como são Calculados os Indicadores

### 4.1 Dias em Atraso

```
Dias em Atraso = Data de Hoje − Data de Vencimento da parcela mais antiga em atraso
```

**Regras:**
1. O sistema busca **todas as parcelas ABERTAS** de **todas as empresas do grupo**
2. Filtra apenas as que têm `data_vencimento < hoje` (já vencidas)
3. Pega a parcela **mais antiga** (vencida há mais tempo)
4. Calcula: `hoje − data_vencimento` dessa parcela = dias em atraso
5. Se não houver parcelas vinculadas, usa o valor manual informado no cadastro

**Exemplo:**
- Hoje: 03/03/2026
- Parcela mais antiga vencida: 20/10/2025
- Dias em atraso: **134 dias**

### 4.2 Valor em Aberto

```
Valor em Aberto = Soma de todas as parcelas em atraso do grupo
```

**Regras:**
1. Ao incluir um grupo no comitê, o sistema calcula automaticamente
2. Soma o valor de todas as parcelas com situação "ABERTO" e vencimento passado
3. Considera **todas as empresas** dentro do mesmo grupo

### 4.3 Valor Mensal (Próxima Parcela)

```
Valor Mensal = Valor da próxima parcela a vencer do grupo
```

**Regras:**
1. Busca parcelas ABERTAS com `data_vencimento >= hoje`
2. Ordena por data de vencimento crescente
3. Pega o **valor da primeira** (mais próxima de vencer)
4. Se não houver parcela futura, usa o valor manual

### 4.4 Prioridade

A prioridade é calculada automaticamente com base nos dias em atraso:

| Prioridade     | Cor       | Condição              |
|----------------|-----------|------------------------|
| **Urgente**    | Vermelho  | Dias em atraso > 5     |
| **Atenção**    | Amarelo   | Dias em atraso entre 3 e 5 |
| **Controlado** | Verde     | Dias em atraso < 3     |

### 4.5 Classes (A / B / C)

As classes são definidas **manualmente** pelo financeiro ao incluir ou editar o cliente:

| Classe | Descrição                                      |
|--------|-------------------------------------------------|
| **A**  | Alta relevância / maior risco financeiro        |
| **B**  | Relevância média                                |
| **C**  | Menor relevância / valores menores              |

---

## 5. Fluxo de Trabalho

```
1. FINANCEIRO/ADMIN inclui grupo no comitê
   → Seleciona grupo, gestores, áreas, classe
   → Valor em atraso é calculado automaticamente

2. FINANCEIRO/ADMIN cria PROVIDÊNCIAS
   → Ações tomadas para cobrar/negociar

3. COMITÊ/FINANCEIRO/ADMIN criam FOLLOW-UPS
   → Atualizações sobre o andamento
   → Avatar do autor fica visível

4. Quando resolvido → FINANCEIRO/ADMIN marca como resolvido
```

---

## 6. Busca Global (Barra superior)

A barra de pesquisa no topo do sistema busca em tempo real:

| Perfil          | O que aparece na busca                    |
|-----------------|-------------------------------------------|
| **Admin**       | Inadimplência + Escritório                |
| **Financeiro**  | Inadimplência + Escritório                |
| **Comitê**      | Somente Inadimplência                     |

**Como usar:**
- Digite pelo menos 2 caracteres
- Resultados aparecem agrupados por módulo
- Use ↑↓ para navegar, Enter para selecionar, Esc para fechar
- Clicar num resultado leva à página correspondente com o filtro aplicado
