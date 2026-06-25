/**
 * Baixa o Relatório de Parcelas do VIOS (RECEBER + PAGAR) e sincroniza financeiro_parcelas.
 *
 * Uso no vios-app:
 *   node FinanceiroRelatorioParcelas.js
 */
import 'dotenv/config';
import { runSyncRelatorioFinanceiro } from './sync-vios-to-supabase.js';
import {
  abrirRelatorioFinanceiro,
  baixarCsvRelatorio,
  configureRelatorioFinanceiroFiltros,
  withViosBrowser,
} from './financeiroRelatorioViosUtils.js';

const REL_PATH = process.env.VIOS_FIN_REL_PARCELAS_PATH || 'sys/financeiro/rel-parcelas.php';
const LINK_SELECTOR =
  process.env.VIOS_FIN_REL_PARCELAS_LINK ||
  "a[href*='rel-parcelas'][href$='.csv'], a[href*='parcelas'][href$='.csv']";

async function main() {
  await withViosBrowser(async ({ page, context, config }) => {
    await abrirRelatorioFinanceiro(page, config, REL_PATH);
    await configureRelatorioFinanceiroFiltros(page, config);
    const csvData = await baixarCsvRelatorio(page, context, config, {
      linkSelector: LINK_SELECTOR,
      label: 'parcelas',
    });

    console.log('Sincronizando financeiro_parcelas no Supabase...');
    const result = await runSyncRelatorioFinanceiro(csvData);
    console.log(
      `Supabase atualizado (parcelas). Upserted: ${result.upserted}, deleted: ${result.deleted}, erros: ${result.errors}`,
    );
  });

  console.log('Script de parcelas finalizado.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
