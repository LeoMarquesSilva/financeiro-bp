/**
 * Baixa o Relatório de Itens do VIOS (RECEBER + PAGAR) e sincroniza financeiro_parcelas_itens.
 * Rode FinanceiroRelatorioParcelas.js antes (FK ci_titulo).
 *
 * Uso no vios-app:
 *   node FinanceiroRelatorioItens.js
 */
import 'dotenv/config';
import { runSyncRelatorioFinanceiroItens } from './sync-vios-to-supabase.js';
import {
  abrirRelatorioFinanceiro,
  baixarCsvRelatorio,
  configureRelatorioFinanceiroFiltros,
  withViosBrowser,
} from './financeiroRelatorioViosUtils.js';

const REL_PATH = process.env.VIOS_FIN_REL_ITENS_PATH || 'sys/financeiro/rel-itens.php';
const LINK_SELECTOR =
  process.env.VIOS_FIN_REL_ITENS_LINK ||
  "a[href*='rel-itens'][href$='.csv'], a[href*='itens'][href$='.csv']";

async function main() {
  await withViosBrowser(async ({ page, context, config }) => {
    await abrirRelatorioFinanceiro(page, config, REL_PATH);
    await configureRelatorioFinanceiroFiltros(page, config);
    const csvData = await baixarCsvRelatorio(page, context, config, {
      linkSelector: LINK_SELECTOR,
      label: 'itens',
    });

    console.log('Sincronizando financeiro_parcelas_itens no Supabase...');
    const result = await runSyncRelatorioFinanceiroItens(csvData);
    console.log(
      `Supabase atualizado (itens). Upserted: ${result.upserted}, deleted: ${result.deleted}, skipped: ${result.skipped}, erros: ${result.errors}`,
    );
  });

  console.log('Script de itens finalizado.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
