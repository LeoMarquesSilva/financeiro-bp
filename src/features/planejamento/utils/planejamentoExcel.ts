/**
 * Planilha do Planejamento 2027 com fórmulas vivas: mudar uma premissa na aba "Premissas"
 * recalcula receita, margem, resultado e metas, igual ao simulador (planejamentoCalc.simular).
 * Cada fórmula leva também o resultado calculado pelo SIOE (aparece mesmo antes de recalcular).
 *
 * Sem imports com alias: a conferência das fórmulas roda em node.
 */
import type ExcelJS from 'exceljs'
import { AREAS_2027, AREAS_PLANEJAMENTO, MESES_ABREV, soma } from './areasPlanejamento.ts'
import { controladoriaNaoRateada, type BaseAno, type BaseArea } from './planejamentoBase.ts'
import type { Premissas, ResultadoSimulacao } from './planejamentoCalc.ts'
import { INDICADORES, metaEfetivaArea, type IndicadorId, type ValorIndicador } from './indicadoresOperacionais.ts'

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type PlanilhaInput = {
  geradoEm: Date
  cenarioNome: string
  oficial: boolean
  premissas: Premissas
  base2025: BaseAno
  base2026: BaseAno
  ultimoMesFechado: number
  resultado: ResultadoSimulacao
  indicadores: { v25: Partial<Record<IndicadorId, ValorIndicador>>; v26: Partial<Record<IndicadorId, ValorIndicador>> }
}

export const ABAS = {
  leia: 'Leia-me',
  premissas: 'Premissas',
  base26: 'Base 2026',
  base25: 'Base 2025',
  receita: 'Receita 2027',
  margem: 'Margem 2027',
  resumo: 'Resumo',
  operacionais: 'Metas Operacionais 2027',
} as const

const FMT_MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const FMT_PCT_NUM = '0.00"%"'
const FMT_PCT = '0.0%'
const COR_TITULO = 'FF1E293B'
const COR_EDITAVEL = 'FFFEF3C7'
const COR_TOTAL = 'FFF1F5F9'

/** Índice da área nas abas de base (todas as áreas, inclusive encerradas). */
export const idxBase = (key: string) => AREAS_PLANEJAMENTO.findIndex((a) => a.key === key)

/** Linhas da base por área: receita, imposto, pessoas, demais, Controladoria. */
const BASE_LINHAS = ['Receita', 'Imposto', 'Pessoas', 'Demais despesas', 'Controladoria (rateio)'] as const
export const linhaBase = (iArea: number, j: number) => 5 + iArea * BASE_LINHAS.length + j
export const LINHA_BASE_ESTRUTURA = 5 + AREAS_PLANEJAMENTO.length * BASE_LINHAS.length
export const LINHA_BASE_CTRL_NR = LINHA_BASE_ESTRUTURA + 1
const LINHA_BASE_PROJ = LINHA_BASE_ESTRUTURA + 2

/** Premissas, Receita 2027 e Margem 2027: índice em AREAS_2027 (só áreas ativas). */
export const LINHA_PREMISSA_AREA = (iArea: number) => 14 + iArea
export const linhaReceita = (iArea: number) => 5 + iArea
const ENCERRADAS = AREAS_PLANEJAMENTO.filter((a) => a.encerrada)
const LINHA_RECEITA_TOTAL = 5 + AREAS_2027.length + ENCERRADAS.length

const MARGEM_BLOCO = 7
export const linhaMargem = (iArea: number, j: number) => 5 + iArea * MARGEM_BLOCO + j
export const LINHA_ESC = 5 + AREAS_2027.length * MARGEM_BLOCO

/** Coluna (1 = A). */
export function col(n: number): string {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const q = (aba: string) => `'${aba}'`
/** Coluna do mês m (1–12) na Base e na Margem: C..N. */
const cMes = (m: number) => col(2 + m)
/** Coluna do mês m na aba Receita 2027: D..O. */
const cMesRec = (m: number) => col(3 + m)

function titulo(ws: ExcelJS.Worksheet, texto: string, sub?: string) {
  ws.getCell('A1').value = texto
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: COR_TITULO } }
  if (sub) {
    ws.getCell('A2').value = sub
    ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748B' } }
  }
}

function cabecalho(ws: ExcelJS.Worksheet, linha: number, valores: string[]) {
  const row = ws.getRow(linha)
  valores.forEach((v, i) => {
    const c = row.getCell(i + 1)
    c.value = v
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TITULO } }
    c.alignment = { horizontal: i < 2 ? 'left' : 'center', vertical: 'middle', wrapText: true }
  })
}

function formula(ws: ExcelJS.Worksheet, ref: string, f: string, result: number | string | null, fmt?: string) {
  const c = ws.getCell(ref)
  c.value = { formula: f, result: result ?? undefined } as ExcelJS.CellFormulaValue
  if (fmt) c.numFmt = fmt
}

function editavel(c: ExcelJS.Cell, valor: number | string | null, fmt?: string) {
  c.value = valor
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_EDITAVEL } }
  c.border = { top: { style: 'thin', color: { argb: 'FFF59E0B' } }, bottom: { style: 'thin', color: { argb: 'FFF59E0B' } } }
  if (fmt) c.numFmt = fmt
}

function linhaTotal(ws: ExcelJS.Worksheet, linha: number, ate: number) {
  for (let c = 1; c <= ate; c++) {
    const cell = ws.getRow(linha).getCell(c)
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TOTAL } }
  }
}

function abaPremissas(wb: ExcelJS.Workbook, p: Premissas) {
  const ws = wb.addWorksheet(ABAS.premissas, { views: [{ state: 'frozen', ySplit: 13 }] })
  titulo(ws, 'Premissas do cenário', 'Células em amarelo são editáveis: mude e as outras abas recalculam. Percentuais em pontos (10 = 10%).')
  ws.getCell('A3').value = 'Escritório'
  ws.getCell('A3').font = { bold: true }
  const e = p.escritorio
  const linhas: [string, number | string, string, string | undefined][] = [
    ['Alíquota de imposto 2027 sobre a receita (%)', e.aliquotaPct, 'aliquota', FMT_PCT_NUM],
    ['Reajuste da folha (%)', e.reajustePct, 'reajuste', FMT_PCT_NUM],
    ['Mês do reajuste (1 a 12)', e.mesReajuste, 'mes_reajuste', '0'],
    ['Variação da Controladoria (%)', e.variacaoControladoriaPct, 'var_controladoria', FMT_PCT_NUM],
    ['Variação da estrutura (%)', e.variacaoEstruturaPct, 'var_estrutura', FMT_PCT_NUM],
    ['Meta de inadimplência (%)', e.inadimplenciaMetaPct, 'inadimplencia', FMT_PCT_NUM],
    ['Distribuição mensal (sazonal ou linear)', e.distribuicao, 'distribuicao', undefined],
  ]
  linhas.forEach(([rot, v, nome, fmt], i) => {
    const r = 4 + i
    ws.getCell(`A${r}`).value = rot
    editavel(ws.getCell(`B${r}`), v, fmt)
    wb.definedNames.add(`${q(ABAS.premissas)}!$B$${r}`, nome)
  })
  ws.getCell('B10').dataValidation = { type: 'list', allowBlank: false, formulae: ['"sazonal,linear"'] }
  ws.getCell('B6').dataValidation = { type: 'whole', operator: 'between', allowBlank: false, formulae: [1, 12] }

  ws.getCell('A12').value = 'Por área'
  ws.getCell('A12').font = { bold: true }
  cabecalho(ws, 13, [
    'Área',
    'Crescimento da receita (%)',
    'Receita nova (R$/ano)',
    'Variação pessoas (%)',
    'Variação demais despesas (%)',
    'Contratações (qtd)',
    'Custo mensal por contratação (R$)',
    'Mês de início (1 a 12)',
  ])
  AREAS_2027.forEach((a, i) => {
    const r = LINHA_PREMISSA_AREA(i)
    const pa = p.areas[a.key]
    ws.getCell(`A${r}`).value = a.nome
    editavel(ws.getCell(`B${r}`), pa.crescimentoPct, FMT_PCT_NUM)
    editavel(ws.getCell(`C${r}`), pa.receitaNova, FMT_MOEDA)
    editavel(ws.getCell(`D${r}`), pa.variacaoPessoasPct, FMT_PCT_NUM)
    editavel(ws.getCell(`E${r}`), pa.variacaoDemaisPct, FMT_PCT_NUM)
    editavel(ws.getCell(`F${r}`), pa.contratacoes, '0')
    editavel(ws.getCell(`G${r}`), pa.custoContratacao, FMT_MOEDA)
    editavel(ws.getCell(`H${r}`), pa.mesInicioContratacao, '0')
  })
  ENCERRADAS.forEach((a, j) => {
    const r = LINHA_PREMISSA_AREA(AREAS_2027.length + j)
    ws.getCell(`A${r}`).value = a.nome
    ws.getCell(`B${r}`).value = 'Área encerrada: sem projeção em 2027'
    ws.getCell(`B${r}`).font = { italic: true, color: { argb: 'FF94A3B8' } }
  })
  ws.getColumn(1).width = 46
  for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 20
}

function abaBase(wb: ExcelJS.Workbook, nome: string, base: BaseAno, sub: string) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] })
  titulo(ws, nome, sub)
  cabecalho(ws, 4, ['Área', 'Linha', ...MESES_ABREV, 'Total'])
  const escreve = (r: number, area: string, rotulo: string, valores: readonly number[]) => {
    ws.getCell(`A${r}`).value = area
    ws.getCell(`B${r}`).value = rotulo
    // Sem arredondar: a planilha recalcula igual ao simulador (o formato já mostra centavos).
    valores.forEach((v, i) => {
      const c = ws.getCell(`${cMes(i + 1)}${r}`)
      c.value = v
      c.numFmt = FMT_MOEDA
    })
    formula(ws, `O${r}`, `SUM(C${r}:N${r})`, soma(valores), FMT_MOEDA)
    ws.getCell(`O${r}`).font = { bold: true }
  }
  AREAS_PLANEJAMENTO.forEach((a, i) => {
    const b: BaseArea = base.areas[a.key]
    const series = [b.receita, b.impostos, b.pessoas, b.demais, b.controladoria]
    BASE_LINHAS.forEach((rot, j) => escreve(linhaBase(i, j), a.nome, rot, series[j]))
  })
  escreve(LINHA_BASE_ESTRUTURA, 'Escritório', 'Estrutura (Facilities, Financeiro, MKT, RH, TI, Comercial)', base.estrutura)
  escreve(LINHA_BASE_CTRL_NR, 'Escritório', 'Controladoria não rateada', controladoriaNaoRateada(base))
  ws.getCell(`A${LINHA_BASE_PROJ}`).value = 'Escritório'
  ws.getCell(`B${LINHA_BASE_PROJ}`).value = 'Mês projetado (ME / repete último mês fechado)'
  base.projetado.forEach((p, i) => {
    ws.getCell(`${cMes(i + 1)}${LINHA_BASE_PROJ}`).value = p ? 'sim' : ''
  })
  if (soma(base.semArea) > 0) {
    const r = LINHA_BASE_PROJ + 1
    escreve(r, 'Sem área', 'Receita sem área (não classificada)', base.semArea)
  }
  ws.getColumn(1).width = 24
  ws.getColumn(2).width = 40
  for (let c = 3; c <= 15; c++) ws.getColumn(c).width = 15
}

function abaReceita(wb: ExcelJS.Workbook, input: PlanilhaInput) {
  const ws = wb.addWorksheet(ABAS.receita, { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] })
  titulo(
    ws,
    'Meta de receita 2027',
    'Meta do ano = receita 2026 × (1 + crescimento) + receita nova. Mês = meta do ano × peso do mês (sazonalidade 2026 da área ou 1/12).',
  )
  cabecalho(ws, 4, ['Área', 'Receita 2026', 'Meta 2027 (ano)', ...MESES_ABREV, 'Total', 'Crescimento'])
  const b26 = `${q(ABAS.base26)}!`
  AREAS_2027.forEach((a, i) => {
    const r = linhaReceita(i)
    const rb = linhaBase(idxBase(a.key), 0)
    const pr = LINHA_PREMISSA_AREA(i)
    const ra = input.resultado.areas[a.key]
    ws.getCell(`A${r}`).value = a.nome
    formula(ws, `B${r}`, `${b26}O${rb}`, ra.receitaBaseAno, FMT_MOEDA)
    formula(ws, `C${r}`, `B${r}*(1+${q(ABAS.premissas)}!$B$${pr}/100)+${q(ABAS.premissas)}!$C$${pr}`, ra.receitaAno, FMT_MOEDA)
    for (let m = 1; m <= 12; m++) {
      formula(
        ws,
        `${cMesRec(m)}${r}`,
        `$C${r}*IF(distribuicao="linear",1/12,IF($B${r}=0,1/12,${b26}${cMes(m)}${rb}/$B${r}))`,
        ra.receita[m - 1],
        FMT_MOEDA,
      )
    }
    formula(ws, `P${r}`, `SUM(D${r}:O${r})`, ra.receitaAno, FMT_MOEDA)
    formula(ws, `Q${r}`, `IF(B${r}=0,"",P${r}/B${r}-1)`, ra.receitaBaseAno ? ra.receitaAno / ra.receitaBaseAno - 1 : '', FMT_PCT)
  })
  // Área encerrada: a receita 2026 entra na base do escritório; 2027 = 0.
  ENCERRADAS.forEach((a, j) => {
    const r = linhaReceita(AREAS_2027.length + j)
    ws.getCell(`A${r}`).value = `${a.nome} — sem projeção`
    ws.getCell(`A${r}`).font = { italic: true, color: { argb: 'FF94A3B8' } }
    formula(ws, `B${r}`, `${b26}O${linhaBase(idxBase(a.key), 0)}`, input.resultado.areas[a.key].receitaBaseAno, FMT_MOEDA)
    for (let c = 3; c <= 16; c++) {
      ws.getCell(`${col(c)}${r}`).value = 0
      ws.getCell(`${col(c)}${r}`).numFmt = FMT_MOEDA
    }
  })
  const t = LINHA_RECEITA_TOTAL
  ws.getCell(`A${t}`).value = 'Total'
  const esc = input.resultado.escritorio
  for (let c = 2; c <= 16; c++) {
    const L = col(c)
    const res = c === 2 ? esc.receitaBaseAno : c === 3 || c === 16 ? esc.receitaAno : esc.receita[c - 4]
    formula(ws, `${L}${t}`, `SUM(${L}5:${L}${t - 1})`, res, FMT_MOEDA)
  }
  formula(ws, `Q${t}`, `IF(B${t}=0,"",P${t}/B${t}-1)`, esc.receitaBaseAno ? esc.receitaAno / esc.receitaBaseAno - 1 : '', FMT_PCT)
  linhaTotal(ws, t, 17)
  ws.getColumn(1).width = 26
  for (let c = 2; c <= 17; c++) ws.getColumn(c).width = 15
}

function abaMargem(wb: ExcelJS.Workbook, input: PlanilhaInput) {
  const ws = wb.addWorksheet(ABAS.margem, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] })
  titulo(
    ws,
    'Margem de contribuição e resultado 2027',
    'Margem = receita − imposto − pessoas − demais − Controladoria. Resultado = Σ margens − estrutura − Controladoria não rateada.',
  )
  cabecalho(ws, 4, ['Área', 'Linha', ...MESES_ABREV, 'Total', 'Margem % (da líquida)'])
  const b26 = `${q(ABAS.base26)}!`
  const prem = `${q(ABAS.premissas)}!`
  const rotulos = ['Receita', '(−) Imposto', '(−) Pessoas', '(−) Demais despesas', '(−) Controladoria', '(=) Margem de contribuição']
  AREAS_2027.forEach((a, i) => {
    const ra = input.resultado.areas[a.key]
    const pr = LINHA_PREMISSA_AREA(i)
    const ib = idxBase(a.key)
    const series = [ra.receita, ra.impostos, ra.pessoas, ra.demais, ra.controladoria, ra.margem]
    rotulos.forEach((rot, j) => {
      const r = linhaMargem(i, j)
      ws.getCell(`A${r}`).value = a.nome
      ws.getCell(`B${r}`).value = rot
      for (let m = 1; m <= 12; m++) {
        const X = cMes(m)
        const r0 = linhaMargem(i, 0)
        const f = [
          `${q(ABAS.receita)}!${cMesRec(m)}${linhaReceita(i)}`,
          `${X}${r0}*aliquota/100`,
          `${b26}${X}${linhaBase(ib, 2)}*(1+${prem}$D$${pr}/100)*IF(${m}>=mes_reajuste,1+reajuste/100,1)+IF(${m}>=${prem}$H$${pr},${prem}$F$${pr}*${prem}$G$${pr},0)`,
          `${b26}${X}${linhaBase(ib, 3)}*(1+${prem}$E$${pr}/100)`,
          `${b26}${X}${linhaBase(ib, 4)}*(1+var_controladoria/100)`,
          `${X}${r0}-${X}${r0 + 1}-${X}${r0 + 2}-${X}${r0 + 3}-${X}${r0 + 4}`,
        ][j]
        formula(ws, `${X}${r}`, f, series[j][m - 1], FMT_MOEDA)
      }
      formula(ws, `O${r}`, `SUM(C${r}:N${r})`, soma(series[j]), FMT_MOEDA)
      if (j === 5) {
        const r0 = linhaMargem(i, 0)
        formula(ws, `P${r}`, `IF(O${r0}-O${r0 + 1}=0,"",O${r}/(O${r0}-O${r0 + 1}))`, ra.margemPct == null ? '' : ra.margemPct / 100, FMT_PCT)
        linhaTotal(ws, r, 16)
      }
    })
  })
  const esc = input.resultado.escritorio
  const e0 = LINHA_ESC
  const rotEsc: [string, number[]][] = [
    ['Receita', esc.receita],
    ['(−) Imposto', esc.impostos],
    ['(−) Pessoas', esc.pessoas],
    ['(−) Demais despesas', esc.demais],
    ['(−) Controladoria rateada', esc.controladoria],
    ['(=) Margem de contribuição', esc.margem],
    ['(−) Estrutura', esc.estrutura],
    ['(−) Controladoria não rateada', esc.controladoriaNaoRateada],
    ['(=) Resultado do escritório', esc.resultado],
    ['Faturamento necessário (receita ÷ (1 − inadimplência))', esc.faturamentoNecessario],
  ]
  rotEsc.forEach(([rot, serie], j) => {
    const r = e0 + j
    ws.getCell(`A${r}`).value = 'Escritório'
    ws.getCell(`B${r}`).value = rot
    for (let m = 1; m <= 12; m++) {
      const X = cMes(m)
      let f: string
      if (j <= 5) f = AREAS_2027.map((_, i) => `${X}${linhaMargem(i, j)}`).join('+')
      else if (j === 6) f = `${b26}${X}${LINHA_BASE_ESTRUTURA}*(1+var_estrutura/100)`
      else if (j === 7) f = `${b26}${X}${LINHA_BASE_CTRL_NR}*(1+var_controladoria/100)`
      else if (j === 8) f = `${X}${e0 + 5}-${X}${e0 + 6}-${X}${e0 + 7}`
      else f = `IF(inadimplencia>=100,${X}${e0},${X}${e0}/(1-inadimplencia/100))`
      formula(ws, `${X}${r}`, f, serie[m - 1], FMT_MOEDA)
    }
    formula(ws, `O${r}`, `SUM(C${r}:N${r})`, soma(serie), FMT_MOEDA)
    if (j === 5 || j === 8) linhaTotal(ws, r, 16)
  })
  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 44
  for (let c = 3; c <= 16; c++) ws.getColumn(c).width = 15
}

function abaResumo(wb: ExcelJS.Workbook, input: PlanilhaInput) {
  const ws = wb.addWorksheet(ABAS.resumo, { views: [{ state: 'frozen', ySplit: 4 }] })
  titulo(ws, `Resumo — cenário “${input.cenarioNome}”${input.oficial ? ' (oficial)' : ''}`, '2026 = realizado + Melhor Estimativa/projeção. 2025 com imposto estimado e folha reclassificada pela pessoa.')
  cabecalho(ws, 4, [
    'Área',
    'Receita 2025',
    'Receita 2026',
    'Meta receita 2027',
    'Cresc. 26/25',
    'Cresc. 27/26',
    'Margem 2025',
    'Margem 2026',
    'Margem 2027',
    'Margem % 2027',
  ])
  const margemBase = (aba: string, i: number) => {
    const b = `${q(aba)}!`
    return `${b}O${linhaBase(i, 0)}-${b}O${linhaBase(i, 1)}-${b}O${linhaBase(i, 2)}-${b}O${linhaBase(i, 3)}-${b}O${linhaBase(i, 4)}`
  }
  const mBase = (base: BaseAno, k: (typeof AREAS_PLANEJAMENTO)[number]['key']) => {
    const a = base.areas[k]
    return soma(a.receita) - soma(a.impostos) - soma(a.pessoas) - soma(a.demais) - soma(a.controladoria)
  }
  AREAS_PLANEJAMENTO.forEach((a, i) => {
    const r = 5 + i
    const ra = input.resultado.areas[a.key]
    const r25 = soma(input.base2025.areas[a.key].receita)
    const i27 = AREAS_2027.findIndex((x) => x.key === a.key)
    ws.getCell(`A${r}`).value = a.nome
    formula(ws, `B${r}`, `${q(ABAS.base25)}!O${linhaBase(i, 0)}`, r25, FMT_MOEDA)
    formula(ws, `C${r}`, `${q(ABAS.base26)}!O${linhaBase(i, 0)}`, ra.receitaBaseAno, FMT_MOEDA)
    formula(ws, `E${r}`, `IF(B${r}=0,"",C${r}/B${r}-1)`, r25 ? ra.receitaBaseAno / r25 - 1 : '', FMT_PCT)
    formula(ws, `G${r}`, margemBase(ABAS.base25, i), mBase(input.base2025, a.key), FMT_MOEDA)
    formula(ws, `H${r}`, margemBase(ABAS.base26, i), mBase(input.base2026, a.key), FMT_MOEDA)
    if (i27 < 0) {
      // Área encerrada: sem meta 2027.
      for (const L of ['D', 'I']) {
        ws.getCell(`${L}${r}`).value = 0
        ws.getCell(`${L}${r}`).numFmt = FMT_MOEDA
      }
      ws.getCell(`F${r}`).value = 'encerrada'
      ws.getCell(`J${r}`).value = 'encerrada'
      ws.getCell(`A${r}`).font = { italic: true, color: { argb: 'FF94A3B8' } }
      return
    }
    formula(ws, `D${r}`, `${q(ABAS.receita)}!P${linhaReceita(i27)}`, ra.receitaAno, FMT_MOEDA)
    formula(ws, `F${r}`, `IF(C${r}=0,"",D${r}/C${r}-1)`, ra.receitaBaseAno ? ra.receitaAno / ra.receitaBaseAno - 1 : '', FMT_PCT)
    formula(ws, `I${r}`, `${q(ABAS.margem)}!O${linhaMargem(i27, 5)}`, ra.margemAno, FMT_MOEDA)
    formula(ws, `J${r}`, `${q(ABAS.margem)}!P${linhaMargem(i27, 5)}`, ra.margemPct == null ? '' : ra.margemPct / 100, FMT_PCT)
  })
  const t = 5 + AREAS_PLANEJAMENTO.length
  ws.getCell(`A${t}`).value = 'Total das áreas'
  for (const L of ['B', 'C', 'D', 'G', 'H', 'I']) formula(ws, `${L}${t}`, `SUM(${L}5:${L}${t - 1})`, null, FMT_MOEDA)
  formula(ws, `E${t}`, `IF(B${t}=0,"",C${t}/B${t}-1)`, null, FMT_PCT)
  formula(ws, `F${t}`, `IF(C${t}=0,"",D${t}/C${t}-1)`, null, FMT_PCT)
  linhaTotal(ws, t, 10)
  const esc = input.resultado.escritorio
  const r1 = t + 2
  ws.getCell(`A${r1}`).value = 'Resultado do escritório 2027'
  formula(ws, `B${r1}`, `${q(ABAS.margem)}!O${LINHA_ESC + 8}`, esc.resultadoAno, FMT_MOEDA)
  ws.getCell(`A${r1 + 1}`).value = 'Faturamento necessário 2027'
  formula(ws, `B${r1 + 1}`, `${q(ABAS.margem)}!O${LINHA_ESC + 9}`, esc.faturamentoNecessarioAno, FMT_MOEDA)
  const semArea = soma(input.base2025.semArea)
  if (semArea > 0) {
    ws.getCell(`A${r1 + 2}`).value = 'Receita 2025 sem área (não classificada, fora das áreas)'
    ws.getCell(`B${r1 + 2}`).value = Math.round(semArea * 100) / 100
    ws.getCell(`B${r1 + 2}`).numFmt = FMT_MOEDA
  }
  ws.getColumn(1).width = 40
  for (let c = 2; c <= 10; c++) ws.getColumn(c).width = 17
}

function abaOperacionais(wb: ExcelJS.Workbook, input: PlanilhaInput) {
  const ws = wb.addWorksheet(ABAS.operacionais, { views: [{ state: 'frozen', ySplit: 4 }] })
  const mesF = (MESES_ABREV[input.ultimoMesFechado - 1] ?? '').toLowerCase()
  titulo(ws, 'Metas operacionais 2027', `2025 = ano inteiro; 2026 = jan–${mesF}. Meta 2027 em amarelo (editável). % em pontos; treinamento em minutos por pessoa; horas no período.`)
  cabecalho(ws, 4, ['Indicador', 'Grupo', 'Unidade', '2025', `2026 (jan–${mesF})`, 'Meta atual', 'Meta 2027 (escritório)', 'Falta vs. 2026', 'Variação da meta vs. 2026'])
  const linhaInd: Record<string, number> = {}
  INDICADORES.forEach((d, i) => {
    const r = 5 + i
    linhaInd[d.id] = r
    const v25 = input.indicadores.v25[d.id]?.acumulado ?? null
    const v26 = input.indicadores.v26[d.id]?.acumulado ?? null
    const meta = input.premissas.operacionais[d.id]?.escritorio ?? null
    ws.getCell(`A${r}`).value = d.nome
    ws.getCell(`B${r}`).value = d.grupo
    ws.getCell(`C${r}`).value = d.unidade
    ws.getCell(`D${r}`).value = v25 == null ? null : Math.round(v25 * 100) / 100
    ws.getCell(`E${r}`).value = v26 == null ? null : Math.round(v26 * 100) / 100
    ws.getCell(`F${r}`).value = d.metaAtual
    editavel(ws.getCell(`G${r}`), meta, '0.00')
    formula(ws, `H${r}`, `IF(OR(G${r}="",E${r}=""),"",G${r}-E${r})`, meta != null && v26 != null ? meta - v26 : '', '0.00')
    formula(ws, `I${r}`, `IF(OR(G${r}="",E${r}="",E${r}=0),"",G${r}/E${r}-1)`, meta != null && v26 ? meta / v26 - 1 : '', FMT_PCT)
    for (const L of ['D', 'E', 'F']) ws.getCell(`${L}${r}`).numFmt = '0.00'
  })
  const porArea = INDICADORES.filter((d) => d.porArea)
  const t2 = 5 + INDICADORES.length + 2
  ws.getCell(`A${t2}`).value = 'Metas próprias por área (vazio = usa a meta do escritório)'
  ws.getCell(`A${t2}`).font = { bold: true }
  cabecalho(ws, t2 + 1, ['Indicador', ...AREAS_2027.map((a) => a.nome)])
  const t3 = t2 + 2 + porArea.length + 2
  ws.getCell(`A${t3}`).value = 'Meta 2027 efetiva por área'
  ws.getCell(`A${t3}`).font = { bold: true }
  cabecalho(ws, t3 + 1, ['Indicador', ...AREAS_2027.map((a) => a.nome)])
  porArea.forEach((d, i) => {
    const r2 = t2 + 2 + i
    const r3 = t3 + 2 + i
    ws.getCell(`A${r2}`).value = d.nome
    ws.getCell(`A${r3}`).value = d.nome
    const p = input.premissas.operacionais[d.id]
    AREAS_2027.forEach((a, j) => {
      const L = col(2 + j)
      editavel(ws.getCell(`${L}${r2}`), p?.areas[a.key] ?? null, '0.00')
      const ef = metaEfetivaArea(p, a.key)
      formula(ws, `${L}${r3}`, `IF(${L}${r2}="",$G$${linhaInd[d.id]},${L}${r2})`, ef ?? '', '0.00')
    })
  })
  ws.getColumn(1).width = 44
  ws.getColumn(2).width = 18
  for (let c = 3; c <= 9; c++) ws.getColumn(c).width = 18
}

function abaLeia(wb: ExcelJS.Workbook, input: PlanilhaInput) {
  const ws = wb.addWorksheet(ABAS.leia)
  titulo(ws, 'Planejamento Estratégico 2027 — SIOE')
  const linhas = [
    `Cenário: ${input.cenarioNome}${input.oficial ? ' (oficial)' : ''}`,
    `Gerado em: ${input.geradoEm.toLocaleString('pt-BR')}`,
    '',
    'Como usar: mude as células amarelas da aba "Premissas" (e as metas operacionais) — Receita 2027, Margem 2027 e Resumo recalculam.',
    '',
    'Abas:',
    '• Premissas — alíquota, reajuste, variações, inadimplência, distribuição mensal e premissas por área.',
    '• Base 2026 — realizado do SIOE até o último mês fechado + Melhor Estimativa (receita) e repetição do último mês fechado (custos) em nov–dez.',
    '• Base 2025 — realizado de 2025 para comparação (imposto estimado pela taxa efetiva de 2026; folha de Facilities reclassificada pela pessoa).',
    ...(input.base2025.ajusteReceita
      ? [
          `• Receita 2025 provisória: total mensal do controle financeiro; inclui ${fmtMoeda(soma(input.base2025.ajusteReceita.total))} de ajuste (controle − VIOS) distribuído por área até o VIOS ser corrigido.`,
        ]
      : []),
    '• Receita 2027 — meta de receita por área e mês (fórmulas).',
    '• Margem 2027 — margem de contribuição por área e resultado do escritório (fórmulas).',
    '• Resumo — 2025 × 2026 × 2027 por área.',
    '• Distressed Deals é área encerrada: aparece no histórico (2025/2026), sem projeção nem meta em 2027.',
    '• Metas Operacionais 2027 — indicadores 2025 × 2026 e metas do escritório e por área.',
    '',
    'Regras:',
    '• Receita: honorários recebidos (base caixa, sem juros), por área do VIOS; títulos de 2025 sem área seguem a classificação por cliente feita no SIOE.',
    '• Margem de contribuição = receita − imposto − pessoas − demais despesas da área − rateio da Controladoria (Operações Legais por % de horas da Ops). Margem % sobre a receita líquida, como no DL.',
    '• Estrutura = Facilities, Financeiro, Marketing, RH, TI e Comercial. Sócios e distribuição de lucros ficam fora.',
    '• Pessoas 2027 = pessoas 2026 do mês × (1 + variação da área) × (1 + reajuste a partir do mês) + contratações × custo mensal a partir do mês de início.',
  ]
  linhas.forEach((t, i) => {
    ws.getCell(`A${3 + i}`).value = t
  })
  ws.getColumn(1).width = 140
}

/** Monta todas as abas no workbook recebido. */
export function montarPlanilhaPlanejamento(wb: ExcelJS.Workbook, input: PlanilhaInput): void {
  wb.creator = 'SIOE'
  wb.created = input.geradoEm
  abaLeia(wb, input)
  abaPremissas(wb, input.premissas)
  abaResumo(wb, input)
  abaReceita(wb, input)
  abaMargem(wb, input)
  abaBase(wb, ABAS.base26, input.base2026, 'Valores do SIOE. Linha "Mês projetado" marca nov–dez (Melhor Estimativa / repetição do último mês fechado).')
  abaBase(
    wb,
    ABAS.base25,
    input.base2025,
    `Valores do SIOE. Imposto estimado pela taxa efetiva de 2026 da área (o VIOS não tem número de NF em 2025).${
      input.base2025.ajusteReceita
        ? ` Receita provisória: inclui ${fmtMoeda(soma(input.base2025.ajusteReceita.total))} do controle financeiro que ainda não está no VIOS.`
        : ''
    }`,
  )
  abaOperacionais(wb, input)
  // Recalcula ao abrir no Excel.
  ;(wb as unknown as { calcProperties: { fullCalcOnLoad: boolean } }).calcProperties = { fullCalcOnLoad: true }
}
