/**
 * Utilitários compartilhados para baixar relatórios financeiros do VIOS (parcelas e itens).
 * Mesmas tabelas; exportação inclui RECEBER e PAGAR na coluna tipo.
 * Módulos atuais do SIOE leem só RECEBER; OPEX (futuro) usará PAGAR.
 */
import { chromium } from 'playwright';
import axios from 'axios';
import { decodeViosCsvBuffer } from './sync-vios-to-supabase.js';

export const FINANCEIRO_TIPOS_PADRAO = ['RECEBER', 'PAGAR'];

export function viosConfig() {
  return {
    baseUrl: process.env.VIOS_BASE_URL || 'https://bp.vios.com.br',
    usuario: process.env.VIOS_USER || '',
    senha: process.env.VIOS_PASS || '',
    headless: process.env.VIOS_HEADLESS === 'true',
    dataInicio: process.env.VIOS_FIN_DATA_INICIO || '01/01/2025',
    dataFim: process.env.VIOS_FIN_DATA_FIM || '31/12/2027',
    tipos: (process.env.VIOS_FIN_TIPOS || FINANCEIRO_TIPOS_PADRAO.join(','))
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean),
  };
}

export async function loginVios(page, config) {
  if (!config.usuario || !config.senha) {
    throw new Error('Defina VIOS_USER e VIOS_PASS no .env.');
  }

  await page.goto(`${config.baseUrl}/entrar.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.fill('input[name="form[usuario]"]', config.usuario);
  await page.fill('input[name="form[senha]"]', config.senha);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 0 }).catch(() => {}),
    page.click('input[type="submit"][name="Entrar"], button:has-text("Entrar")'),
  ]);
}

export async function logoutVios(page, config) {
  await page.goto(`${config.baseUrl}/logout.php`, { waitUntil: 'domcontentloaded', timeout: 0 });
}

/**
 * Seleciona tipos de título no multiselect do relatório financeiro VIOS.
 */
export async function selectTitulosTipos(page, tipos) {
  await page.click('button[data-id="pesq[titulos_tipos_id]"]');
  await page.waitForTimeout(500);

  for (const tipo of tipos) {
    const item = page.locator('.dropdown-menu.show .dropdown-item').filter({ hasText: tipo }).first();
    await item.click();
    await page.waitForTimeout(200);
  }

  await page.click('body');
  await page.waitForTimeout(300);
}

export async function configureRelatorioFinanceiroFiltros(page, config) {
  console.log(`Configurando tipos de título: ${config.tipos.join(' + ')}...`);
  await selectTitulosTipos(page, config.tipos);

  console.log('Configurando situação como TODAS...');
  await page.click('button[data-id="pesq[titulos_situacao_id]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("TODAS")');
  await page.click('body');
  await page.waitForTimeout(300);

  console.log(`Configurando data inicial (${config.dataInicio})...`);
  await page.click('input[name="pesq[idata]"]');
  await page.fill('input[name="pesq[idata]"]', '');
  await page.type('input[name="pesq[idata]"]', config.dataInicio);
  await page.click('body');
  await page.waitForTimeout(500);

  console.log(`Configurando data final (${config.dataFim})...`);
  await page.click('input[name="pesq[fdata]"]');
  await page.fill('input[name="pesq[fdata]"]', '');
  await page.type('input[name="pesq[fdata]"]', config.dataFim);
  await page.click('body');
  await page.waitForTimeout(500);

  console.log('Configurando limite para 9999999...');
  await page.click('button[data-id="pesq[limit]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("9999999")');
  await page.click('body');
  await page.waitForTimeout(300);

  console.log('Selecionando formato CSV...');
  await page.click('button[data-id="pesq[tprel]"]');
  await page.waitForTimeout(500);
  await page.click('.dropdown-menu.show .dropdown-item:has-text("CSV")');
  await page.click('body');
  await page.waitForTimeout(300);
}

export async function baixarCsvRelatorio(page, context, config, { linkSelector, label }) {
  console.log(`Iniciando pesquisa (${label})...`);
  await page.click('#Pesq');
  console.log('Aguardando link de download...');
  const linkHandle = await page.waitForSelector(linkSelector, { timeout: 0 });
  const href = await linkHandle.getAttribute('href');
  const finalUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\.\//, '')}`;
  console.log(`URL final do CSV (${label}): ${finalUrl}`);

  const response = await axios.get(finalUrl, {
    responseType: 'arraybuffer',
    headers: {
      Cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
    },
    maxBodyLength: Infinity,
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(2);
        process.stdout.write(`\r📦 ${label}: ${percent}% baixado`);
      } else {
        process.stdout.write(`\r📦 ${label}: ${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB`);
      }
    },
  });
  console.log(`\nCSV baixado (${label}).`);
  return decodeViosCsvBuffer(Buffer.from(response.data));
}

export async function withViosBrowser(run) {
  const config = viosConfig();
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  try {
    console.log('Abrindo navegador e fazendo login...');
    await loginVios(page, config);
    console.log('Login concluído.');
    return await run({ browser, context, page, config });
  } finally {
    try {
      await logoutVios(page, config);
      console.log('Logout realizado.');
    } catch {
      // ignore
    }
    await browser.close();
  }
}

export async function abrirRelatorioFinanceiro(page, config, relPath) {
  const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
  const url = `${config.baseUrl}/?pag=${path.replace(/^\//, '')}&menu_lateral=true`;
  console.log('Acessando relatório:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
}
