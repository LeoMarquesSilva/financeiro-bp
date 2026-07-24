/**
 * Valida planilha de orçamento OPEX sem gravar no Supabase.
 * Uso: node scripts/verify-orcamento-xlsx.cjs [arquivo.xlsx] [ano]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const XLSX = require('xlsx')
const path = require('path')
const { parseOrcamentoRows } = require('./lib/parse-orcamento-xlsx.cjs')

const FILE = process.argv[2]
const ANO = Number(process.argv[3]) || new Date().getFullYear()

if (!FILE) {
  console.error('Uso: node scripts/verify-orcamento-xlsx.cjs <arquivo.xlsx> [ano]')
  process.exit(1)
}

const wb = XLSX.readFile(path.resolve(FILE), { cellDates: true, raw: true })
const sheetName = wb.SheetNames.find((n) => /orçamento|orcamento|budget|opex/i.test(n)) ?? wb.SheetNames[0]
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true })
const parsed = parseOrcamentoRows(rows, ANO)

if (!parsed.linhas.length) {
  console.error('Nenhuma linha válida encontrada.')
  process.exit(1)
}

console.log(`OK — Ano ${ANO}`)
console.log(`Linhas: ${parsed.linhas.length}`)
console.log(`Total geral: R$ ${parsed.totalGeral.toFixed(2)}`)
console.log('Totais por mês:', parsed.totaisPorMes)
console.log('Preview (5 primeiras):')
for (const l of parsed.linhas.slice(0, 5)) {
  console.log(`  mês ${l.mes} · ${l.grupo_conta} / ${l.plano_contas} · R$ ${l.valor.toFixed(2)}`)
}
