# Sync VIOS → Supabase (para rodar dentro do vios-app no servidor)

O **financeiro-bp não fica no servidor**. Toda a lógica de atualização do Supabase roda **dentro do vios-app**, junto com a automação ProcessoCompleto.

## O que copiar para o vios-app

1. **Um dos arquivos** (para ficar igual ao resto do vios-app em JS):
   - **`sync-vios-to-supabase.js`** — ESM (`import`/`export`). Use se o vios-app for todo em JS com `import` (ou se no `package.json` tiver `"type": "module"`). Se não tiver `"type": "module"`, renomeie para `sync-vios-to-supabase.mjs` e importe com extensão `.mjs`.
   - **`sync-vios-to-supabase.cjs`** — CommonJS (`require`). Use se o vios-app usar `require` em tudo.

   Copie o escolhido para dentro do vios-app, ex.:
   - `vios-app/ProcessoCompleto/sync-vios-to-supabase.js`, ou
   - `vios-app/scripts/sync-vios-to-supabase.js`

2. **Dependências no vios-app** (na pasta do vios-app):
   ```bash
   npm install dotenv xlsx @supabase/supabase-js
   ```
   (Ou `pnpm add dotenv xlsx @supabase/supabase-js`.)

3. **Arquivo `.env`** no vios-app (ou na pasta onde está o script), com:
   ```env
   VITE_SUPABASE_URL=https://wvbptgcevwvubtnetojz.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
   ```
   Nunca commite o `.env` no Git.

## Como chamar na automação ProcessoCompleto

No **final** do script da ProcessoCompleto (depois de baixar e salvar o Excel):

**Se usou o .js (ESM):**
```js
import { runSync } from './sync-vios-to-supabase.js'; // ajuste o caminho se precisar
const downloadPath = config.downloadPath; // ou o path que você usa
await runSync(downloadPath);
console.log('✅ Supabase atualizado.');
```

**Se usou o .cjs (CommonJS):**
```js
const { runSync } = require('./sync-vios-to-supabase.cjs');
const downloadPath = config.downloadPath;
await runSync(downloadPath);
console.log('✅ Supabase atualizado.');
```

Se o script de sync estiver em outra pasta (ex.: `vios-app/scripts/`), ajuste o caminho no `import` ou no `require` (ex.: `'../scripts/sync-vios-to-supabase.js'`).

## Onde o .env é lido

O script procura um arquivo `.env` nesta ordem:

1. Na mesma pasta do `sync-vios-to-supabase.cjs`
2. Na pasta pai (ex.: raiz do vios-app)
3. No `process.cwd()` (pasta de onde o Node foi iniciado)

Coloque o `.env` na raiz do vios-app (ou na pasta da ProcessoCompleto) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Onde os dados ficam no Supabase

Os dados vão para a tabela **`clientes_escritorio`** (todos os clientes do escritório). Não são gravados em `clients_inadimplencia`. No Supabase: Table Editor → **clientes_escritorio**.

## Ajustar colunas do Excel

Se o relatório VIOS tiver cabeçalhos diferentes, abra o script de sync no vios-app e altere o objeto **COLUMN_MAP** no início do arquivo (nomes das colunas de cliente, CNPJ, processos, horas).
