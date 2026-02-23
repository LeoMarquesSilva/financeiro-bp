import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import axios from 'axios';
import { runSync } from './sync-vios-to-supabase.js';

const config = {
  baseUrl: 'https://bp.vios.com.br',
  usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
  senha: process.env.VIOS_PASS || 'Vinicius123!',
  headless: false,
  downloadPath: path.resolve(
    "C:/Users/bp01/OneDrive - BPPLAW/Documentos - Equipe Controladoria/Núcleo de Cadastro/Bases Atualizacoes/Processos Completo.xlsx"
  ),
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

  console.log('5️⃣ Acessando relatório de processos completo...');
  await page.goto(`${config.baseUrl}/?pag=sys/relatorios/relatorio-processos-completo.php`, { waitUntil: 'domcontentloaded', timeout: 0 });

  console.log('6️⃣ Selecionando filtros...');
  await page.click('button[data-id="pesq[filtros_multi]"]');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const items = document.querySelectorAll('.dropdown-menu.inner a.dropdown-item');
    items.forEach(item => {
      const text = item.querySelector('span.text')?.textContent?.trim();
      if (text === 'Ativos' || text === 'Não Migrados') {
        item.click();
      }
    });
  });

  console.log('7️⃣ Selecionando "Base de Processos"...');
  await page.click('button[data-id="modelo_relatorio_id"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("BASE GERAL DE PROCESSOS - OPS LEGAIS")');

  console.log('8️⃣ Selecionando limite 9999999...');
  await page.click('button[data-id="pesq[limit]"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("9999999")');

  console.log('9️⃣ Iniciando pesquisa...');
  await page.click('#Pesq');

  console.log('🔟 Aguardando link de download...');
  const linkHandle = await page.waitForSelector("a[href*='processos-completo'][href$='.xlsx']", { timeout: 0 });
  const href = await linkHandle.getAttribute('href');

  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`🔗 URL final do XLSX: ${finalUrl}`);

  console.log('1️⃣1️⃣ Baixando XLSX...');
  fs.mkdirSync(path.dirname(config.downloadPath), { recursive: true });

  const tempPath = path.join(path.dirname(config.downloadPath), 'temp_Processos_Completo.xlsx');
  const writer = fs.createWriteStream(tempPath);

  const response = await axios.get(finalUrl, {
    responseType: 'stream',
    headers: {
      Cookie: (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; '),
    },
    maxBodyLength: Infinity,
  });

  const totalLength = response.headers['content-length'] ? parseInt(response.headers['content-length'], 10) : null;
  let downloaded = 0;
  const startTime = Date.now();

  response.data.on('data', chunk => {
    downloaded += chunk.length;
    if (totalLength) {
      const percent = ((downloaded / totalLength) * 100).toFixed(2);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? downloaded / 1024 / 1024 / elapsed : 0;
      const remaining = totalLength - downloaded;
      const eta = speed > 0 ? (remaining / 1024 / 1024 / speed).toFixed(1) : '?';
      process.stdout.write(`\r📦 ${percent}% baixado | ${speed.toFixed(2)} MB/s | ETA: ${eta}s`);
    } else {
      process.stdout.write(`\r📦 Baixado: ${(downloaded / 1024 / 1024).toFixed(2)} MB`);
    }
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  if (fs.existsSync(config.downloadPath)) fs.unlinkSync(config.downloadPath);
  fs.renameSync(tempPath, config.downloadPath);
  console.log(`\n✅ XLSX salvo em ${config.downloadPath}`);

  console.log('1️⃣2️⃣ Sincronizando com Supabase...');
  try {
    await runSync(config.downloadPath);
    console.log('✅ Supabase atualizado.');
  } catch (err) {
    console.error('❌ Erro ao sincronizar Supabase:', err.message);
  }

  console.log('1️⃣3️⃣ Realizando logout...');
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('✅ Logout realizado.');

  await browser.close();
  console.log('🎉 Script finalizado.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
