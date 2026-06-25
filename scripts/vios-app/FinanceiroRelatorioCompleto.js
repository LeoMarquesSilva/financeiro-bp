/**
 * Sync completo: parcelas (RECEBER + PAGAR) e, em seguida, itens — mesma sessão VIOS.
 *
 * Uso no vios-app:
 *   node FinanceiroRelatorioCompleto.js
 */
import 'dotenv/config';
import { runSyncRelatorioFinanceiro, runSyncRelatorioFinanceiroItens } from './sync-vios-to-supabase.js';
import {
  abrirRelatorioFinanceiro,
  baixarCsvRelatorio,
  configureRelatorioFinanceiroFiltros,
  withViosBrowser,
} from './financeiroRelatorioViosUtils.js';

const PARCELAS_PATH = process.env.VIOS_FIN_REL_PARCELAS_PATH || 'sys/financeiro/rel-parcelas.php';
const ITENS_PATH = process.env.VIOS_FIN_REL_ITENS_PATH || 'sys/financeiro/rel-itens.php';
const PARCELAS_LINK =
  process.env.VIOS_FIN_REL_PARCELAS_LINK ||
  "a[href*='rel-parcelas'][href$='.csv'], a[href*='parcelas'][href$='.csv']";
const ITENS_LINK =
  process.env.VIOS_FIN_REL_ITENS_LINK ||
  "a[href*='rel-itens'][href$='.csv'], a[href*='itens'][href$='.csv']";

async function main() {
  await withViosBrowser(async ({ page, context, config }) => {
    await abrirRelatorioFinanceiro(page, config, PARCELAS_PATH);
    await configureRelatorioFinanceiroFiltros(page, config);
    const csvParcelas = await baixarCsvRelatorio(page, context, config, {
      linkSelector: PARCELAS_LINK,
      label: 'parcelas',
    });
    const resParcelas = await runSyncRelatorioFinanceiro(csvParcelas);
    console.log('Parcelas:', resParcelas);

    await abrirRelatorioFinanceiro(page, config, ITENS_PATH);
    await configureRelatorioFinanceiroFiltros(page, config);
    const csvItens = await baixarCsvRelatorio(page, context, config, {
      linkSelector: ITENS_LINK,
      label: 'itens',
    });
    const resItens = await runSyncRelatorioFinanceiroItens(csvItens);
    console.log('Itens:', resItens);
  });

  console.log('Sync financeiro completo finalizado.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
