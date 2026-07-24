# Orçamento OPEX — importação e template

O orçamento OPEX é a **previsão orçamentária congelada** do ano, separada do previsto operacional do VIOS. Quando importado, passa a ser o **previsto principal** no dashboard; o VIOS continua visível como comparativo.

## Formatos aceitos

### 1. Layout longo (recomendado)

Uma linha por mês / plano / título:

| Ano | Mês | Grupo macro | Plano mínimo | Nº conta | Título/Referência | Descrição | Valor (R$) |
|-----|-----|-------------|--------------|----------|-------------------|-----------|------------|
| 2026 | 1 | DESPESAS COM PESSOAL | Salários | 3.1.01 | Folha jan | | 150000 |
| 2026 | 1 | ALUGUEIS | Aluguel sede | | Aluguel | | 25000 |

### 2. Layout wide (Jan…Dez em colunas)

| Grupo macro | Plano mínimo | Título/Referência | Jan | Fev | Mar | … |
|-------------|--------------|-------------------|-----|-----|-----|---|
| ALUGUEIS | Aluguel sede | Aluguel | 25000 | 25000 | 25000 | |

O parser detecta automaticamente pelo cabeçalho.

### 3. Export SIOE (aba Detalhado)

Planilha gerada pelo botão **Excel** no drill-down OPEX (ex.: `opex-previsto-realizado-2026-ago.xlsx`).
Contém apenas um mês — use `replicar_meses=12` para repetir cada linha de Jan a Dez:

```bash
node scripts/import-orcamento-xlsx.cjs opex-previsto-realizado-2026-ago.xlsx 2026 12
```

## Comandos

```bash
# Validar planilha (sem gravar)
node scripts/verify-orcamento-xlsx.cjs orcamento-2026.xlsx 2026

# Importar para o Supabase (substitui o ano inteiro)
node scripts/import-orcamento-xlsx.cjs orcamento-2026.xlsx 2026
```

Requer `.env` com `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Pela UI

Na página **OPEX** → seção **Orçamento congelado**:

- **Importar Excel** — preview + confirmação
- **Backup Excel** — exporta o orçamento atual
- **Nova linha / editar / excluir** — gestão manual

## Quando receber a planilha real

1. Rodar `verify-orcamento-xlsx.cjs` e conferir totais por mês
2. Se colunas tiverem nomes diferentes, ajustar aliases em:
   - `scripts/lib/parse-orcamento-xlsx.cjs`
   - `src/features/opex/utils/opexOrcamentoImport.ts`
3. Importar e validar no dashboard (orçamento vs previsto VIOS)

## Comportamento no dashboard

| Situação | Previsto principal | Comparativo |
|----------|-------------------|-------------|
| Orçamento importado | Soma do orçamento | Previsto VIOS |
| Sem orçamento | Previsto VIOS (fallback) | — |

Realizado **sempre** vem dos pagamentos VIOS (`data_pagamento`).
