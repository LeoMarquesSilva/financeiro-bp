/**
 * Captura prints do SIOE com o usuário Lavínia (coordenadora Reestruturação).
 * Uso: SIOE_PASSWORD=... node docs/manual-usabilidade-lavinia/capture-prints.mjs
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'prints')
const BASE = process.env.SIOE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.SIOE_EMAIL ?? 'lavinia.ferraz@bismarchipires.com.br'
const PASSWORD = process.env.SIOE_PASSWORD
if (!PASSWORD) {
  console.error('Defina SIOE_PASSWORD com a senha do usuário dos prints.')
  process.exit(1)
}

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: !!opts.fullPage, ...opts })
  console.log('ok', name)
  return file
}

async function waitOverviewReady(page) {
  await page.waitForSelector('text=SLA Protocolo', { timeout: 60000 })
  // Espera sair o loading "…" das células financeiras se possível
  await page.waitForTimeout(2500)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await context.newPage()

  // 1) Login
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#login-email')
  await shot(page, '01-login')

  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASSWORD)
  await shot(page, '02-login-preenchido')
  await page.click('button[type="submit"]')

  // Home = eficiência
  await page.waitForURL(/\/financeiro\/eficiencia/, { timeout: 60000 })
  await waitOverviewReady(page)
  await shot(page, '03-overview-topo')
  await shot(page, '04-overview-completo', { fullPage: true })

  // 2) Filtro de mês
  const jun = page.getByRole('button', { name: /^Jun$/i }).first()
  if (await jun.count()) {
    await jun.click()
    await page.waitForTimeout(800)
    await shot(page, '05-filtro-mes-jun')
  }

  // Resultado (limpa destaque se existir)
  const resultado = page.getByRole('button', { name: /^Resultado$/i }).first()
  if (await resultado.count()) {
    await resultado.click()
    await page.waitForTimeout(500)
  }

  // 3) Racional de um indicador
  const racional = page.getByRole('button', { name: /^Racional$/i }).first()
  if (await racional.count()) {
    await racional.click()
    await page.waitForTimeout(2000)
    await shot(page, '06-racional-aberto')
    // fecha sheet (ESC ou botão fechar)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  // 4) Aba SLA Protocolo
  const abaSla = page.getByRole('tab', { name: /SLA Protocolo/i }).first()
  if (await abaSla.count()) {
    await abaSla.click()
    await page.waitForTimeout(2500)
    await shot(page, '07-aba-sla-protocolo', { fullPage: true })
  }

  // 5) Aba Desenvolvimento Equipe
  const abaDev = page.getByRole('tab', { name: /Desenvolvimento Equipe/i }).first()
  if (await abaDev.count()) {
    await abaDev.click()
    await page.waitForTimeout(2500)
    await shot(page, '08-aba-desenvolvimento', { fullPage: true })
  }

  // 6) Volta Overview + ano se houver seletor
  const abaOverview = page.getByRole('tab', { name: /^Overview$/i }).first()
  if (await abaOverview.count()) {
    await abaOverview.click()
    await page.waitForTimeout(1000)
  }

  // Menu lateral (ícone eficiência / tooltip)
  await shot(page, '09-sidebar-e-header')

  // Manifesto dos prints
  const files = [
    '01-login',
    '02-login-preenchido',
    '03-overview-topo',
    '04-overview-completo',
    '05-filtro-mes-jun',
    '06-racional-aberto',
    '07-aba-sla-protocolo',
    '08-aba-desenvolvimento',
    '09-sidebar-e-header',
  ]
  await writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ email: EMAIL, base: BASE, files, capturedAt: new Date().toISOString() }, null, 2),
  )

  await browser.close()
  console.log('Prints em', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
