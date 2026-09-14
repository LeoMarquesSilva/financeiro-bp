/**
 * Upsert pontual de parcelas a partir de um CSV/XLSX local.
 * Atualiza CIs existentes e inclui novos. Não apaga o que ficou de fora do arquivo.
 *
 *   node scripts/vios-app/FinanceiroRelatorioParcelasUpsert.js caminho/relatorio.csv
 */
import 'dotenv/config';
import { runSyncRelatorioFinanceiro } from './sync-vios-to-supabase.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/vios-app/FinanceiroRelatorioParcelasUpsert.js <arquivo.csv|xlsx>');
  process.exit(1);
}

const result = await runSyncRelatorioFinanceiro(filePath, { mode: 'upsert' });
console.log(
  `Supabase atualizado (parcelas upsert). Upserted: ${result.upserted}, deleted: ${result.deleted}, erros: ${result.errors}`,
);
