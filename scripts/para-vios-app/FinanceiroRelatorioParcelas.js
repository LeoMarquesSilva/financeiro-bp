/**
 * Script para o vios-app: baixa o Relatório de Parcelas (financeiro) do VIOS em CSV
 * e sincroniza com a tabela relatorio_financeiro no Supabase.
 *
 * No vios-app:
 *   1. Copie sync-vios-to-supabase.js para a mesma pasta (ou ajuste o import).
 *   2. npm install playwright dotenv axios
 *   3. .env com VIOS_USER, VIOS_PASS, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   4. node FinanceiroRelatorioParcelas.js
 */
import { chromium } from 'playwright';
import 'dotenv/config';
import axios from 'axios';
import { runSyncRelatorioFinanceiro } from './sync-vios-to-supabase.js';

const config = {
  baseUrl: 'https://bp.vios.com.br',
  usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
  senha: process.env.VIOS_PASS || 'Vinicius123!',
  headless: false,
};

async function main() {
  console.log('1️⃣ Abrindo navegador...');
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  console.log('2️⃣ Indo para página de login...');
  await page.goto(`${config.baseUrl}/entrar.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('3️⃣ Preenchendo usuário e senha...');
  await page.fill('input[name="form[usuario]"]', config.usuario);
  await page.fill('input[name="form[senha]"]', config.senha);
  console.log('4️⃣ Clicando em Entrar...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 0 }).catch(() => {}),
    page.click('input[type="submit"][name="Entrar"], button:has-text("Entrar")'),
  ]);
  console.log('✅ Login concluído.');

  console.log('5️⃣ Acessando relatório de parcelas...');
  await page.goto(`${config.baseUrl}/?pag=sys/financeiro/rel-parcelas.php&menu_lateral=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 0,
  });
  console.log('6️⃣ Configurando filtro de tipos de títulos para RECEBER...');
  await page.click('button[data-id="pesq[titulos_tipos_id]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("RECEBER")');
  console.log('7️⃣ Configurando situação como TODAS...');
  await page.click('button[data-id="pesq[titulos_situacao_id]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("TODAS")');
  console.log('8️⃣ Configurando data inicial (01/01/2025)...');
  await page.click('input[name="pesq[idata]"]');
  await page.fill('input[name="pesq[idata]"]', '');
  await page.type('input[name="pesq[idata]"]', '01/01/2025');
  await page.click('body');
  await page.waitForTimeout(500);
  console.log('9️⃣ Configurando data final (31/12/2027)...');
  await page.click('input[name="pesq[fdata]"]');
  await page.fill('input[name="pesq[fdata]"]', '');
  await page.type('input[name="pesq[fdata]"]', '31/12/2027');
  await page.click('body');
  await page.waitForTimeout(500);
  console.log('🔟 Configurando limite para 9999999...');
  await page.click('button[data-id="pesq[limit]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("9999999")');
  console.log('1️⃣1️⃣ Selecionando formato CSV...');
  await page.click('button[data-id="pesq[tprel]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("CSV")');
  console.log('1️⃣2️⃣ Iniciando pesquisa...');
  await page.click('#Pesq');
  console.log('1️⃣3️⃣ Aguardando link de download...');
  const linkHandle = await page.waitForSelector(
    "a[href*='rel-parcelas'][href$='.csv'], a[href*='parcelas'][href$='.csv']",
    { timeout: 0 }
  );
  const href = await linkHandle.getAttribute('href');
  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`🔗 URL final do CSV: ${finalUrl}`);
  console.log('1️⃣4️⃣ Baixando CSV para memória...');
  const response = await axios.get(finalUrl, {
    responseType: 'arraybuffer',
    headers: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
    },
    maxBodyLength: Infinity,
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(2);
        process.stdout.write(`\r📦 ${percent}% baixado`);
      } else {
        process.stdout.write(`\r📦 Baixado: ${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB`);
      }
    },
  });
  console.log('\n✅ CSV baixado para memória.');

  console.log('1️⃣5️⃣ Sincronizando com Supabase (relatorio_financeiro)...');
  try {
    const csvData = Buffer.from(response.data).toString('utf-8');
    const result = await runSyncRelatorioFinanceiro(csvData);
    console.log(`✅ Supabase atualizado. Linhas processadas: ${result.upserted}, erros: ${result.errors}`);
  } catch (err) {
    console.error('❌ Erro ao sincronizar Supabase:', err.message);
    throw err;
  }

  console.log('1️⃣6️⃣ Realizando logout...');
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('✅ Logout realizado.');
  await browser.close();
  console.log('🎉 Script finalizado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
