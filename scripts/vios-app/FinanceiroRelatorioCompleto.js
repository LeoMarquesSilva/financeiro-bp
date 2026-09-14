/**
 * Atalho opcional — NÃO substitui a sequência do vios-app:
 *   RelatorioPessoas.js → FinanceiroRelatorioParcelas.js → RelatorioTitulos.js
 *
 * Este arquivo hoje só replica o passo de parcelas (última edição / upsert).
 */
import 'dotenv/config';
import { runSyncRelatorioFinanceiro } from './sync-vios-to-supabase.js';
import {
  abrirRelatorioFinanceiro,
  baixarCsvRelatorio,
  configureRelatorioFinanceiroFiltros,
  periodoMesAtualBR,
  withViosBrowser,
} from './financeiroRelatorioViosUtils.js';

const PARCELAS_PATH = process.env.VIOS_FIN_REL_PARCELAS_PATH || 'sys/financeiro/rel-parcelas.php';
const PARCELAS_LINK =
  process.env.VIOS_FIN_REL_PARCELAS_LINK ||
  "a[href*='rel-parcelas'][href$='.csv'], a[href*='parcelas'][href$='.csv']";

async function main() {
  await withViosBrowser(async ({ page, context, config }) => {
    await abrirRelatorioFinanceiro(page, config, PARCELAS_PATH);
    const periodo = periodoMesAtualBR();
    await configureRelatorioFinanceiroFiltros(page, config, {
      ...periodo,
      situacao: ['TODAS', 'TODOS'],
      tipoData: ['Última Edição', 'Ultima Edicao'],
    });
    const csvParcelas = await baixarCsvRelatorio(page, context, config, {
      linkSelector: PARCELAS_LINK,
      label: 'parcelas',
    });
    const resParcelas = await runSyncRelatorioFinanceiro(csvParcelas, { mode: 'upsert' });
    console.log('Parcelas:', resParcelas);
  });

  console.log('Sync de parcelas (última edição) finalizado.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
