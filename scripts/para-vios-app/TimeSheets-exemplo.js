/**
 * Exemplo: automação que baixa o relatório TimeSheets (CSV) do VIOS e
 * sincroniza com a tabela timesheets no Supabase.
 *
 * Copie para o vios-app junto com sync-vios-to-supabase.js (ou .cjs) e o .env.
 * No final do download, chame runSyncTimeSheets(caminhoDoArquivo).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';
import { runSyncTimeSheets } from './sync-vios-to-supabase.js';

const config = {
  baseUrl: 'https://bp.vios.com.br',
  usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
  senha: process.env.VIOS_PASS || 'Vinicius123!',
  headless: false,
  dataInicio: '01/03/2025',
  dataFim: '28/12/2026',
  downloadPath: path.resolve(
    process.env.VIOS_TIMESHEETS_PATH ||
      'C:\\Users\\bp01\\OneDrive - BPPLAW\\Documentos - Equipe Controladoria\\Núcleo de Cadastro\\Bases Atualizacoes\\TimeSheet.csv'
  ),
  webhookUrl: process.env.VIOS_TIMESHEETS_WEBHOOK || 'https://ia-n8n.a8fvaf.easypanel.host/webhook/Timesheets',
  syncToSupabase: true,
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

  console.log('5️⃣ Acessando página de horas trabalhadas...');
  await page.goto(`${config.baseUrl}/?pag=sys/cadastros/horas-trabalhadas.php`, { waitUntil: 'domcontentloaded', timeout: 0 });

  console.log('6️⃣ Preenchendo datas...');
  await page.fill('input[name="pesq[idata]"]', config.dataInicio);
  await page.fill('input[name="pesq[fdata]"]', config.dataFim);

  console.log('7️⃣ Selecionando limite 9999999...');
  await page.click('button[data-id="pesq[limit]"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("9999999")');

  console.log('8️⃣ Selecionando CSV...');
  await page.click('button[data-id="pesq[tprel]"]');
  await page.click('.dropdown-menu.show .dropdown-item:has-text("CSV")');

  console.log('9️⃣ Iniciando pesquisa...');
  await page.click('#Pesq');

  console.log('🔟 Aguardando link de download...');
  const linkHandle = await page.waitForSelector("a[title*='Baixar arquivo']", { timeout: 0 });
  const href = await linkHandle.getAttribute('href');
  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`🔗 URL final do CSV: ${finalUrl}`);

  console.log('1️⃣1️⃣ Baixando CSV...');
  fs.mkdirSync(path.dirname(config.downloadPath), { recursive: true });
  const writer = fs.createWriteStream(config.downloadPath);
  const chunks = [];
  const response = await axios.get(finalUrl, {
    responseType: 'stream',
    headers: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
    },
    maxBodyLength: Infinity,
  });

  const totalLength = response.headers['content-length'] ? parseInt(response.headers['content-length']) : null;
  let downloaded = 0;
  const startTime = Date.now();

  response.data.on('data', (chunk) => {
    chunks.push(chunk);
    downloaded += chunk.length;
    if (totalLength) {
      const percent = ((downloaded / totalLength) * 100).toFixed(2);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = downloaded / 1024 / 1024 / elapsed;
      const remaining = totalLength - downloaded;
      const eta = (remaining / 1024 / 1024 / speed).toFixed(1);
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
  console.log(`\n✅ CSV salvo em ${config.downloadPath}`);

  if (config.webhookUrl) {
    console.log('1️⃣2️⃣ Enviando arquivo para o webhook...');
    try {
      const fileBuffer = Buffer.concat(chunks);
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: 'TimeSheet.csv',
        contentType: 'text/csv',
      });
      const webhookResponse = await axios.post(config.webhookUrl, formData, {
        headers: formData.getHeaders(),
      });
      console.log(`✅ Arquivo enviado para o webhook com status: ${webhookResponse.status}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar para o webhook: ${error.message}`);
    }
  }

  if (config.syncToSupabase) {
    console.log('1️⃣3️⃣ Sincronizando TimeSheets com o Supabase...');
    try {
      const result = await runSyncTimeSheets(config.downloadPath);
      console.log(`✅ TimeSheets sync: ${result.inserted} linhas inseridas.`);
    } catch (error) {
      console.error('❌ Erro no sync TimeSheets:', error.message);
    }
  }

  console.log('1️⃣4️⃣ Realizando logout...');
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('✅ Logout realizado.');

  await browser.close();
  console.log('🎉 Script finalizado.');
}

main();
