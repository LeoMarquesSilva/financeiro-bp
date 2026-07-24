/**
 * Importa orçamento OPEX a partir de planilha Excel.
 * Uso: node scripts/import-orcamento-xlsx.cjs [arquivo.xlsx] [ano]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const XLSX = require('xlsx')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { parseOrcamentoRows } = require('./lib/parse-orcamento-xlsx.cjs')

const FILE = process.argv[2]
const ANO = Number(process.argv[3]) || new Date().getFullYear()
const REPLICAR_MESES = Number(process.argv[4]) || 0

if (!FILE) {
  console.error('Uso: node scripts/import-orcamento-xlsx.cjs <arquivo.xlsx> [ano] [replicar_meses]')
  console.error('  replicar_meses: ex. 12 para repetir cada linha de Jan a Dez (export de um mês só)')
  process.exit(1)
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')

  const wb = XLSX.readFile(path.resolve(FILE), { cellDates: true, raw: true })
  const sheetName =
    wb.SheetNames.find((n) => /detalhado|orçamento|orcamento|budget|opex/i.test(n)) ?? wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true })
  let parsed = parseOrcamentoRows(rows, ANO)

  if (!parsed.linhas.length && /detalhado/i.test(sheetName)) {
    parsed = parseOrcamentoExportDetalhado(rows, ANO, REPLICAR_MESES || 12)
  } else if (REPLICAR_MESES > 0 && parsed.linhas.length) {
    parsed = replicateLinhasMeses(parsed.linhas, REPLICAR_MESES)
  }

  if (!parsed.linhas.length) {
    console.error('Nenhuma linha válida encontrada.')
    process.exit(1)
  }

  console.log(`Ano ${ANO} · ${parsed.linhas.length} linhas · total ${parsed.totalGeral.toFixed(2)}`)
  console.log('Totais por mês:', parsed.totaisPorMes)

  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('opex_orcamento_import_replace', {
    p_ano: ANO,
    p_linhas: parsed.linhas,
    p_origem: 'import',
    p_observacao: `CLI import ${path.basename(FILE)}`,
  })
  if (error) throw error
  console.log('Import concluído:', data)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
