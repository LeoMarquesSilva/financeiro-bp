/**
 * Reimporta financeiro_parcelas_itens do CSV local com encoding Latin-1 (VIOS).
 * Corrige nomes como "São Francisco Têxtil" que foram gravados como "So Francisco…".
 *
 * Uso (na raiz do projeto, com .env):
 *   node scripts/resync-financeiro-itens-encoding.mjs
 *   node scripts/resync-financeiro-itens-encoding.mjs caminho/para/arquivo.csv
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runSyncRelatorioFinanceiroItens, decodeViosCsvFile } from './vios-app/sync-vios-to-supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCsv = path.join(__dirname, '..', 'financeiro_parcelas_itens.csv');
const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCsv;

console.log('Re-sync itens financeiros (encoding Latin-1 → UTF-8)');
console.log('Arquivo:', csvPath);

const csv = decodeViosCsvFile(csvPath);
const sample = csv.split(/\r?\n/).find((l) => l.includes('Francisco') && l.includes('xtil'));
if (sample) {
  const m = sample.match(/"([^"]*Francisco[^"]*)"/);
  console.log('Amostra cliente no CSV decodificado:', m?.[1] ?? '(não encontrado)');
}

const result = await runSyncRelatorioFinanceiroItens(csv);
console.log('Concluído:', result);
