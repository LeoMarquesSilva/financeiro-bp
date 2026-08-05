/**
 * Sync financeiro VIOS → Supabase (parcelas + itens).
 *
 * Modo A — baixar do VIOS (Playwright):
 *   npm run sync:financeiro
 *   Requer VIOS_USER e VIOS_PASS no .env / .env.local
 *
 * Modo B — CSV local (export manual do VIOS):
 *   node scripts/sync-financeiro-completo.mjs --parcelas /caminho/parcelas.csv --itens /caminho/itens.csv
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import {
  decodeViosCsvFile,
  runSyncRelatorioFinanceiro,
  runSyncRelatorioFinanceiroItens,
} from './vios-app/sync-vios-to-supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local') });

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const parcelasCsv = argValue('--parcelas');
const itensCsv = argValue('--itens');

if (parcelasCsv || itensCsv) {
  if (!parcelasCsv || !itensCsv) {
    console.error('Modo CSV: informe --parcelas e --itens.');
    process.exit(1);
  }
  console.log('Sync financeiro (CSV local)');
  console.log('Parcelas:', parcelasCsv);
  console.log('Itens:', itensCsv);
  const csvParcelas = decodeViosCsvFile(path.resolve(parcelasCsv));
  const resParcelas = await runSyncRelatorioFinanceiro(csvParcelas);
  console.log('Parcelas:', resParcelas);
  const csvItens = decodeViosCsvFile(path.resolve(itensCsv));
  const resItens = await runSyncRelatorioFinanceiroItens(csvItens);
  console.log('Itens:', resItens);
  process.exit(0);
}

const env = {
  ...process.env,
  VIOS_FIN_DATA_INICIO: process.env.VIOS_FIN_DATA_INICIO || '01/01/1900',
  VIOS_FIN_DATA_FIM: process.env.VIOS_FIN_DATA_FIM || '31/12/2027',
  VIOS_HEADLESS: process.env.VIOS_HEADLESS ?? 'true',
};

if (!env.VIOS_USER || !env.VIOS_PASS) {
  console.error('Defina VIOS_USER e VIOS_PASS no .env ou .env.local.');
  console.error('Ou exporte os CSVs do VIOS e rode:');
  console.error(
    '  node scripts/sync-financeiro-completo.mjs --parcelas parcelas.csv --itens itens.csv',
  );
  process.exit(1);
}

console.log('Sync financeiro (VIOS) | período:', env.VIOS_FIN_DATA_INICIO, '→', env.VIOS_FIN_DATA_FIM);

const child = spawn('node', [path.join(root, 'scripts/vios-app/FinanceiroRelatorioCompleto.js')], {
  cwd: root,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
