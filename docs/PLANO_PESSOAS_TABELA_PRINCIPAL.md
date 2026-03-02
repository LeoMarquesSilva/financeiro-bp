# Plano: pessoas como tabela principal e remoção de clientes_escritorio

## Objetivo
- **pessoas** passa a ser a tabela central do banco (clientes, leads, inativos, prospects).
- A coluna **nome** em pessoas = cliente (empresa dentro do grupo cliente).
- Remover a tabela **clientes_escritorio** e passar a usar **pessoas** em todo o sistema.
- O sync do **Processo Completo** (XLSX) passa a gravar em **pessoas** (com qtd_processos, horas_total, horas_por_ano).

---

## 1. Banco de dados

### 1.1 Tabela pessoas
- Adicionar colunas: `qtd_processos INTEGER`, `horas_total NUMERIC(12,2)`, `horas_por_ano JSONB` (nullable).
- Manter: `ci`, `cpf_cnpj`, `nome` (cliente/empresa), `grupo_cliente`, `categoria`.

### 1.2 Migração de dados e FKs
- Copiar dados de `clientes_escritorio` para `pessoas` (preservando `id` para não quebrar FKs).
- Em `clients_inadimplencia`: renomear `cliente_escritorio_id` → `pessoa_id`, FK → `pessoas(id)`.
- Em `relatorio_financeiro`: renomear `cliente_escritorio_id` → `pessoa_id`, FK → `pessoas(id)`.
- Views `relatorio_financeiro_resumo_por_cliente` e `relatorio_financeiro_resumo_em_atraso`: usar `pessoa_id`.
- Função de vinculação: `relatorio_financeiro_vinculacao_cliente_escritorio` → `relatorio_financeiro_vinculacao_pessoa` (match por `pessoas.nome`).
- Dropar a tabela `clientes_escritorio`.

---

## 2. Sync (sync-vios-to-supabase.js)

- **runSync(filePath)** (Processo Completo): passar a escrever em **pessoas** em vez de `clientes_escritorio`.
  - Mapear: grupo_cliente, nome (= cliente/razao_social do Excel), cpf_cnpj (= cnpj), qtd_processos, horas_total, horas_por_ano.
  - Upsert por (grupo_cliente + nome) ou por cnpj (manter mesma lógica de hoje).
- Após sync do relatório financeiro: chamar `relatorio_financeiro_vinculacao_pessoa` (nova RPC).

---

## 3. Frontend e tipos

- **database.types.ts**: remover tipo/tabela `clientes_escritorio`; adicionar/ajustar `PessoaRow` com as novas colunas; `cliente_escritorio_id` → `pessoa_id` em clients_inadimplencia e relatorio_financeiro.
- **escritorioService**: buscar de `pessoas` (select id, grupo_cliente, nome, cnpj, qtd_processos, horas_total, horas_por_ano); tipo `PessoaRow`; normalizar para estrutura que hoje usa `razao_social` (usar `nome`).
- **Inadimplência**: `cliente_escritorio_id` → `pessoa_id`; buscar pessoa em `pessoas`; ModalCadastro e cards usam lista de pessoas.
- **Views/resumos**: relatório financeiro por cliente usa `pessoa_id` e join com `pessoas`.

---

## 4. Scripts e documentação

- **import-cdi-xlsx.cjs** / **map-dados-xlsx.cjs**: vincular por `pessoas` (por nome/razao_social ou cnpj).
- **README** e **skill** gestao-financeira-escritorio: referenciar `pessoas` como tabela principal; remover menções a `clientes_escritorio`.

---

## Ordem de aplicação
1. Migration SQL (pessoas + migração dados + FKs + views + RPC + drop clientes_escritorio).
2. database.types.ts (pessoas completo; pessoa_id; remover clientes_escritorio).
3. sync-vios-to-supabase.js (runSync → pessoas; RPC vinculação pessoa).
4. Escritório: escritorioService + hooks/pages (pessoas).
5. Inadimplência: pessoa_id, modais, cards (pessoas).
6. Scripts e docs.
