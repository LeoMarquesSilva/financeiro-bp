/**
 * Script para o vios-app: baixa o Relatório de Clientes do VIOS em CSV
 * e opcionalmente sincroniza com a tabela pessoas no Supabase.
 *
 * Se o CMD fechar sem fazer nada: use a versão CommonJS (mesma pegada do TimeSheets):
 *   node RelatorioPessoas.cjs
 *
 * No vios-app (versão ESM, requer "type": "module" no package.json):
 *   1. Copie sync-vios-to-supabase.js para a mesma pasta (ou ajuste o import).
 *   2. npm install playwright dotenv axios
 *   3. .env com VIOS_USER, VIOS_PASS e (opcional) VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY para sync
 *   4. node RelatorioPessoas.js
 */
import { chromium } from 'playwright';
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
 
const config = {
  baseUrl: 'https://bp.vios.com.br',
  usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
  senha: process.env.VIOS_PASS || 'Vinicius123!',
  headless: false,
  downloadPath: './downloads',
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
 
  console.log('5️⃣ Acessando relatório de clientes...');
  await page.goto(`${config.baseUrl}/?pag=sys/clientes/clientes.php&menu_lateral=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 0,
  });
 
  console.log('6️⃣ Limpando campo de data inicial...');
  await page.click('input[name="pesq[idata]"]');
  await page.fill('input[name="pesq[idata]"]', '');
  await page.click('body');
  await page.waitForTimeout(500);
 
  console.log('7️⃣ Limpando campo de data final...');
  await page.click('input[name="pesq[fdata]"]');
  await page.fill('input[name="pesq[fdata]"]', '');
  await page.click('body');
  await page.waitForTimeout(500);
 
  console.log('8️⃣ Configurando limite para 999999...');
  await page.click('button[data-id="pesq[limit]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("999999")');
 
  console.log('9️⃣ Selecionando formato CSV...');
  await page.click('button[data-id="pesq[tprel]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("CSV")');
 
  console.log('🔟 Iniciando pesquisa...');
  await page.click('#Pesq');
 
  console.log('1️⃣1️⃣ Aguardando link de download...');
  const linkHandle = await page.waitForSelector(
    "a[href*='clientes'][href$='.csv'], a[href*='rel-'][href$='.csv']",
    { timeout: 0 }
  );
  const href = await linkHandle.getAttribute('href');
  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`🔗 URL final do CSV: ${finalUrl}`);
 
  console.log('1️⃣2️⃣ Baixando CSV...');
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
 
  const buffer = Buffer.from(response.data);
  const csvData =
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.toString('utf-8')
      : buffer.toString('latin1');
 
  const downloadDir = path.resolve(config.downloadPath);
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`\n📁 Pasta criada: ${downloadDir}`);
  }
 
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `relatorio_pessoas_${timestamp}.csv`;
  const filepath = path.join(downloadDir, filename);
 
  fs.writeFileSync(filepath, csvData, 'utf8');
  console.log(`\n✅ CSV salvo como: ${filename}`);
  console.log(`📁 Caminho completo: ${filepath}`);
 
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('1️⃣3️⃣ Sincronizando com Supabase (tabela pessoas)...');
    try {
      const { runSyncPessoas } = await import('./sync-vios-to-supabase.js');
      const result = await runSyncPessoas(csvData);
      console.log(`✅ Supabase atualizado. Inseridos: ${result.inserted}, erros: ${result.errors}`);
    } catch (err) {
      console.error('❌ Erro ao sincronizar Supabase:', err.message);
      if (err.stack) console.error(err.stack);
    }
  } else {
    console.log('1️⃣3️⃣ Supabase não configurado (VITE_SUPABASE_URL/ANON_KEY). Pulando sync.');
  }
 
  console.log('1️⃣4️⃣ Realizando logout...');
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('✅ Logout realizado.');
 
  await browser.close();
  console.log('🎉 Script finalizado. CSV de pessoas/clientes baixado com sucesso!');
}
 
main().catch(async (err) => {
  console.error('❌ Erro fatal:', err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
