# Fluxo VIOS → Supabase (diário)

## Estrutura no servidor (financeiro-bp não está no servidor)

No servidor só existe o **vios-app**. A automação **ProcessoCompleto** (dentro do vios-app) baixa o "Processos Completo.xlsx" e **a própria atualização do Supabase roda lá dentro** — não depende do projeto financeiro-bp.

```
servidor/
  vios-app/
    ProcessoCompleto/           ← automação que baixa o Excel
      (seu script de download)
      sync-vios-to-supabase.cjs ← copiado de financeiro-bp/scripts/para-vios-app/
    .env                        ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (e VIOS se precisar)
```

Para ter o sync rodando no vios-app, use os arquivos da pasta **`scripts/para-vios-app/`** deste repositório (veja abaixo).

---

## Como fazer tudo no vios-app (recomendado para o servidor)

1. **Copie** o arquivo `scripts/para-vios-app/sync-vios-to-supabase.cjs` para dentro do vios-app (ex.: `vios-app/ProcessoCompleto/` ou `vios-app/scripts/`).
2. No vios-app: `npm install dotenv xlsx @supabase/supabase-js`.
3. Crie um **.env** no vios-app com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. No **final** do script da ProcessoCompleto (depois de salvar o Excel):
   ```js
   const { runSync } = require('./sync-vios-to-supabase.cjs'); // ajuste o caminho se precisar
   await runSync(caminhoDoArquivoXlsx);
   ```
5. Se tiver automação que baixa o **TimeSheets** (relatório de horas), chame também:
   ```js
   const { runSync, runSyncTimeSheets } = require('./sync-vios-to-supabase.cjs');
   await runSync(caminhoProcessosCompletoXlsx);
   await runSyncTimeSheets(caminhoTimeSheetsXlsx);  // colunas: Data, Grupo Cliente, Cliente, Total de Horas (decimal)
   ```

Instruções detalhadas estão em **`scripts/para-vios-app/README.md`**.

---

## Opção alternativa: rodar no financeiro-bp (local)

Se em algum momento você rodar a automação a partir do **financeiro-bp** (por exemplo no seu PC):

### Tudo em um (download + Supabase)

No projeto **financeiro-bp**:

```bash
pnpm install   # instala playwright e axios se ainda não tiver
pnpm vios:baixar-e-sync
```

Isso abre o navegador, baixa o "Processos Completo.xlsx" no caminho configurado e em seguida sincroniza com o Supabase.  
Configure no `.env`: `VIOS_USER`, `VIOS_PASS`, e opcionalmente `VIOS_REPORT_PATH` e `VIOS_HEADLESS=true` para rodar sem abrir a janela.

*(Para o servidor, use a pasta `para-vios-app` e rode tudo dentro do vios-app, como descrito acima.)*

## Caminho do relatório (automação)

A automação que você usa salva em:

```
C:\Users\bp01\OneDrive - BPPLAW\Documentos - Equipe Controladoria\Núcleo de Cadastro\Bases Atualizacoes\Processos Completo.xlsx
```

O script de sync usa esse caminho como **padrão no Windows**. Em outra máquina ou pasta, use `.env` ou argumento:

- **.env:** `VIOS_REPORT_PATH=C:\caminho\completo\Processos Completo.xlsx`
- **CLI:** `pnpm sync:vios "C:\caminho\Processos Completo.xlsx"`

## Ordem de execução (todo dia)

1. Rodar a **automação Playwright** (baixa o XLSX no OneDrive).
2. Depois rodar o **sync** (lê o arquivo e atualiza o Supabase):

   ```bash
   cd c:\Users\leoma\OneDrive\Documentos\financeiro-bp
   pnpm sync:vios
   ```

   Ou, se o relatório estiver em outro caminho:

   ```bash
   pnpm sync:vios "C:\Users\bp01\OneDrive - BPPLAW\Documentos - Equipe Controladoria\Núcleo de Cadastro\Bases Atualizacoes\Processos Completo.xlsx"
   ```

## Agendamento (Windows)

1. **Agendador de Tarefas** – Criar duas tarefas (ou uma que chama as duas):
   - **Tarefa 1:** executar a automação Playwright (ex.: 6h).
   - **Tarefa 2:** executar o sync alguns minutos depois (ex.: 6h30), para dar tempo do download terminar.

2. **Tarefa única (batch):** criar `rodar-vios-e-sync.bat`:

   ```bat
   @echo off
   cd /d "C:\pasta\da\automacao-vios"
   node baixar-processos-completo.js
   timeout /t 60
   cd /d "C:\Users\leoma\OneDrive\Documentos\financeiro-bp"
   call pnpm sync:vios
   ```

   Agendar esse `.bat` no Agendador de Tarefas.

## Ajuste do script de sync às colunas do Excel

O relatório "BASE GERAL DE PROCESSOS - OPS LEGAIS" pode ter nomes de colunas diferentes. Abra `scripts/sync-vios-to-supabase.cjs` e ajuste o bloco **COLUMN_MAP** (e, se precisar, **SHEET_NAME** e **ANOS_COLUNAS**) conforme as colunas do seu XLSX:

- `razao_social` – cliente / razão social
- `cnpj` – CNPJ
- `qtd_processos` – quantidade de processos
- `horas_total` – total de horas
- Colunas com ano (2024, 2023, …) – preenchidas em `horas_por_ano`

## TimeSheets (tabela `timesheets`)

O relatório **TimeSheets** do VIOS pode ser sincronizado para a tabela **timesheets** no Supabase. Colunas usadas:

- **Data** – data do lançamento (será salva como DATE)
- **Grupo Cliente** – grupo do cliente (opcional)
- **Cliente** – nome/razão social do cliente
- **Total de Horas** – em decimal

No vios-app, após baixar o arquivo do TimeSheets (CSV ou XLSX), chame no **mesmo script** de download:

```js
const { runSyncTimeSheets } = require('./sync-vios-to-supabase.cjs');
await runSyncTimeSheets(caminhoDoArquivoTimeSheets);  // .csv ou .xlsx
```

Há um exemplo completo em **`scripts/para-vios-app/TimeSheets-exemplo.cjs`** (e `.js` para ESM): baixa o CSV do VIOS, envia ao webhook (opcional) e chama `runSyncTimeSheets` ao final.

Por padrão, o sync **substitui** no Supabase todas as linhas cujas datas existem no arquivo (evita duplicar ao re-rodar). Para apenas inserir sem apagar: `runSyncTimeSheets(caminho, { replaceDateRange: false })`.

## Relatório Financeiro (tabela `relatorio_financeiro`)

O **Relatório de Parcelas** (financeiro) do VIOS pode ser baixado e sincronizado para a tabela **relatorio_financeiro**. Use o script **`FinanceiroRelatorioParcelas.js`** na pasta `scripts/para-vios-app/`: ele faz login no VIOS, gera o CSV do relatório de parcelas, baixa em memória e chama **`runSyncRelatorioFinanceiro(csvData)`** (aceita caminho de arquivo ou string com conteúdo CSV). Copie esse script e o `sync-vios-to-supabase.js` para a pasta do vios-app onde roda a automação (ex.: mesma pasta do FinanceiroRelatorioParcelas.js).

## Credenciais (nunca no código)

- **No vios-app (servidor):** arquivo `.env` na raiz do vios-app (ou na pasta do script) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. VIOS (usuário/senha) só se a automação de download rodar lá.
- **No financeiro-bp (local):** `.env` na raiz com as mesmas variáveis se for usar os scripts locais (vios:baixar-e-sync, sync:vios).
