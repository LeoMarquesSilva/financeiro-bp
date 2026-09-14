/**
 * Utilitários compartilhados para baixar relatórios financeiros do VIOS (parcelas e itens).
 * Mesmas tabelas; exportação inclui RECEBER e PAGAR na coluna tipo.
 * Módulos atuais do SIOE leem só RECEBER; OPEX (futuro) usará PAGAR.
 */
import { chromium } from 'playwright';
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { decodeViosCsvBuffer } from './sync-vios-to-supabase.js';

export const FINANCEIRO_TIPOS_PADRAO = ['RECEBER', 'PAGAR'];

export function viosConfig() {
  return {
    baseUrl: process.env.VIOS_BASE_URL || 'https://bp.vios.com.br',
    usuario: process.env.VIOS_USER || 'vinicius.marques@bismarchipires.com.br',
    senha: process.env.VIOS_PASS || 'Vinicius123!',
    headless: process.env.VIOS_HEADLESS === 'true',
    dataInicio: process.env.VIOS_FIN_DATA_INICIO || '01/01/1900',
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
  const button = page.locator('button[data-id="pesq[titulos_tipos_id]"]').first();
  try {
    await button.waitFor({ state: 'visible', timeout: 60_000 });
  } catch {
    console.warn('Dropdown de tipos não apareceu — seguindo com o padrão da tela.');
    return;
  }
  await button.click({ timeout: 15_000 });
  await page.waitForTimeout(500);

  await page.evaluate((tiposSelecionados) => {
    const items = document.querySelectorAll('.dropdown-menu.inner a.dropdown-item, .dropdown-menu.show .dropdown-item, .dropdown-menu .dropdown-item');
    for (const item of items) {
      const text = (item.querySelector('span.text')?.textContent || item.textContent || '').trim().toUpperCase();
      if (tiposSelecionados.includes(text)) {
        item.click();
      }
    }
  }, tipos.map((t) => t.toUpperCase()));

  await page.click('body', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Primeiro dia do mês atual até hoje (fuso America/Sao_Paulo). */
export function periodoMesAtualBR(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return {
    dataInicio: `01/${month}/${year}`,
    dataFim: `${day}/${month}/${year}`,
  };
}

async function clickDropdownItem(page, buttonSelector, itemText) {
  const labels = Array.isArray(itemText) ? itemText : [itemText];
  await page.click('body');
  await page.waitForTimeout(200);
  await page.click(buttonSelector);
  await page.waitForTimeout(500);
  const clicked = await page.evaluate((wanted) => {
    const normalize = (text) =>
      String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    const targets = wanted.map(normalize);
    const items = document.querySelectorAll(
      '.dropdown-menu.show .dropdown-item, .dropdown-menu.inner.show .dropdown-item',
    );
    for (const item of items) {
      const label = (item.querySelector('span.text')?.textContent || item.textContent || '').trim();
      const normalized = normalize(label);
      if (targets.some((t) => normalized === t || normalized.includes(t))) {
        item.click();
        return true;
      }
    }
    return false;
  }, labels);
  if (!clicked) {
    throw new Error(`Item de dropdown não encontrado: ${labels.join(' | ')}`);
  }
  await page.click('body');
  await page.waitForTimeout(300);
}

async function fillViosDate(page, inputName, value) {
  const selector = `input[name="${inputName}"]`;
  await page.click(selector);
  await page.fill(selector, '');
  await page.type(selector, value);
  await page.click('body');
  await page.waitForTimeout(500);
}

/**
 * @param {object} [options]
 * @param {string} [options.dataInicio]
 * @param {string} [options.dataFim]
 * @param {string|string[]} [options.situacao] — padrão TODAS/TODOS
 * @param {string|string[]} [options.tipoData] — pesq[tp_data], ex. "Última Edição"
 */
export async function configureRelatorioFinanceiroFiltros(page, config, options = {}) {
  const dataInicio = options.dataInicio ?? config.dataInicio;
  const dataFim = options.dataFim ?? config.dataFim;
  const situacao = options.situacao ?? ['TODAS', 'TODOS'];
  const tipoData = options.tipoData;

  console.log(`Configurando tipos de título: ${config.tipos.join(' + ')}...`);
  await selectTitulosTipos(page, config.tipos);

  console.log(`Configurando situação: ${[].concat(situacao).join(' / ')}...`);
  await clickDropdownItem(page, 'button[data-id="pesq[titulos_situacao_id]"]', situacao);

  if (tipoData) {
    console.log(`Configurando tipo de data: ${[].concat(tipoData).join(' / ')}...`);
    await clickDropdownItem(page, 'button[data-id="pesq[tp_data]"]', tipoData);
  }

  console.log(`Configurando data inicial (${dataInicio})...`);
  await fillViosDate(page, 'pesq[idata]', dataInicio);

  console.log(`Configurando data final (${dataFim})...`);
  await fillViosDate(page, 'pesq[fdata]', dataFim);

  console.log('Configurando limite para 9999999...');
  await clickDropdownItem(page, 'button[data-id="pesq[limit]"]', '9999999');

  console.log('Selecionando formato CSV...');
  await clickDropdownItem(page, 'button[data-id="pesq[tprel]"]', 'CSV');
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

function resolveChromiumExecutable() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const candidates = [
    path.join(
      cache,
      'chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
    path.join(
      cache,
      'chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    ),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export async function withViosBrowser(run) {
  const config = viosConfig();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: config.headless,
    ...(executablePath ? { executablePath } : {}),
  });
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
  const rel = relPath.startsWith('/') ? relPath : `/${relPath}`;
  const url = `${config.baseUrl}/?pag=${rel.replace(/^\//, '')}&menu_lateral=true`;
  console.log('Acessando relatório:', url);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page
        .locator(
          'button[data-id="pesq[titulos_tipos_id]"], button[data-id="pesq[titulos_situacao_id]"], #Pesq',
        )
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`Falha ao abrir relatório (tentativa ${attempt}/3):`, err.message);
      await page.waitForTimeout(2000 * attempt);
    }
  }
}
