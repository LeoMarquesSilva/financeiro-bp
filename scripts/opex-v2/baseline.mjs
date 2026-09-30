/**
 * Baseline executiva de OPEX, jan/2025–ago/2026.
 * Lê os lançamentos, aplica as regras de scripts/opex-v2/regras.mjs e grava o Excel.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  CAMADAS,
  CLASSIFICACAO,
  CONSULTORIAS,
  DEPARTAMENTOS,
  FORNECEDORES,
  GRUPOS_PAINEL_FORA,
  MESES,
  PARAMETROS,
  PERIMETRO,
  VERSAO,
  aplicarPerimetro,
  areaParaDepartamento,
  categoriaCargo,
  classificarConta,
  norm,
  omitirTextoPessoa,
  overrideFornecedor,
  reclassificarDescricao,
} from './regras.mjs'

config({ path: path.resolve(process.cwd(), '.env') })
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const OUT = path.resolve('docs/opex-v2-baseline-2026.xlsx')
const COLS = 'ci_item,tipo,descricao,terceiros_item,terceiro_titulo,cliente,departamento,grupo_conta,plano_contas,conta_numero,competencia_titulo,data_vencimento,data_pagamento,valor_item,valor_fluxo_item,valor_pago_item'

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const abs = (v) => r2(Math.abs(Number(v) || 0))
const mesDe = (iso) => (iso ? String(iso).slice(0, 7) : '')
const noRecorte = (mes) => MESES.includes(mes)
const MESES_2026 = MESES.filter((m) => m.startsWith('2026'))
const indisp = (motivo) => `indisponível: ${motivo}`
const AVISO_COMPETENCIA = 'competência de 8.1.01 inconsistente no VIOS'
const AVISO_2025 = 'OPEX 2025 não comparável: 2.2.09.001 contém transferências, aplicações e reserva de bônus; 2.6.01 e 5.14.03 contêm impostos sobre faturamento e folha; 2.3.06 e 2.3.05 estão sem descrição.'
const HONORARIOS = ['3.1.01', '3.1.03', '3.1.04', '3.1.05', '3.1.06', '3.1.07', '3.1.08']
const FORA_RECEITA = [
  ['3.1.02', '3.1.02 entradas não identificadas'],
  ['3.2.06', '3.2.06 outras receitas'],
  ['3.2.01', '3.2.01 reembolsos'],
  ['2.1.08', '2.1.08 adiantamentos de clientes'],
  ['11.1.01', '11.1.01 compras estornadas'],
  ['3.5.', '3.5 financeiras e estornos'],
]

function linhaForaReceita(conta, departamento) {
  if (norm(departamento) === 'CONTA CORRENTE CLIENTES') return 'Conta Corrente Clientes'
  const hit = FORA_RECEITA.find(([p]) => String(conta).startsWith(p))
  return hit ? hit[1] : ''
}

function tipoHonorario(conta) {
  const c = String(conta)
  if (['3.1.03', '3.1.05', '3.1.06'].some((p) => c.startsWith(p))) return 'recorrente'
  if (['3.1.04', '3.1.07', '3.1.08'].some((p) => c.startsWith(p))) return 'variavel'
  if (c.startsWith('3.1.01')) return 'nao_classificavel'
  return ''
}

function ehHonorario(conta, departamento) {
  return !linhaForaReceita(conta, departamento) && HONORARIOS.some((p) => String(conta).startsWith(p))
}

function shiftMes(ym, delta) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function fimDoMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

function fornecedorDe(row) {
  return String(row.terceiros_item || '').trim() || String(row.terceiro_titulo || '').trim() || String(row.cliente || '').trim() || '—'
}

async function paginar(build) {
  const all = []
  let from = 0
  while (true) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
    from += 1000
  }
  return all
}

function estilo(ws, nCols) {
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.height = 32
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: nCols } }
}

function escrever(wb, nome, headers, linhas, moeda = []) {
  const ws = wb.addWorksheet(nome)
  ws.columns = headers.map((h) => ({ header: h, width: Math.min(46, Math.max(14, h.length + 2)) }))
  estilo(ws, headers.length)
  for (const linha of linhas) {
    const added = ws.addRow(linha)
    for (const col of moeda) {
      const cell = added.getCell(col)
      if (typeof cell.value === 'number') cell.numFmt = '"R$" #,##0.00'
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, linhas.length + 1), column: headers.length } }
  return ws
}

function painelElegivel(row) {
  if (norm(row.tipo) !== 'PAGAR') return false
  return !GRUPOS_PAINEL_FORA.includes(norm(row.grupo_conta))
}

function montarPagar(row) {
  const conta = String(row.conta_numero ?? '').trim()
  let origem = row.competencia_titulo ? String(row.competencia_titulo).slice(0, 10) : ''
  let motivoAjuste = ''
  if (Number(row.ci_item) === 614 || Number(row.ci_item) === 29 || (origem && origem < '2020-01-01')) {
    origem = row.data_vencimento ? String(row.data_vencimento).slice(0, 10) : ''
    motivoAjuste = 'competencia_invalida_usou_vencimento'
  }
  let mesComp = mesDe(origem)
  const mesPag = mesDe(row.data_pagamento)
  if (conta.startsWith('8.2.01') && (mesPag === '2026-01' || mesPag === '2026-02')) {
    mesComp = '2025-12'
    motivoAjuste = 'bonus_jan_fev_2026'
  }
  const valor = abs(row.valor_item ?? row.valor_fluxo_item)
  const pago = row.data_pagamento ? abs(row.valor_pago_item) : 0
  const peri = aplicarPerimetro(row)
  const dep = DEPARTAMENTOS.find((d) => d[0] === String(row.departamento ?? '').trim())
  let classe = peri.efeito === 'fora'
    ? { grupo: peri.linha, subgrupo: peri.nota || peri.linha, natureza: '—', controlabilidade: '—', status: peri.status, nota: peri.nota }
    : classificarConta(conta)
  let flag = ''
  if (peri.efeito === 'dentro') {
    const over = overrideFornecedor(fornecedorDe(row))
    if (over) classe = { ...classe, ...over }
    else {
      const recl = reclassificarDescricao(conta, row.descricao, classe)
      flag = recl.flag || ''
      classe = recl
    }
  }
  const palavras = []
  const texto = norm(`${row.descricao || ''} ${row.plano_contas || ''}`)
  for (const [k, rotulo] of [['RESCIS', 'rescisão'], ['IMPLANTA', 'implantação'], ['MULTA', 'multa'], ['OBRA', 'obra'], ['REFORMA', 'reforma']]) {
    if (texto.includes(k)) palavras.push(rotulo)
  }
  return {
    ci: row.ci_item,
    tipo: 'PAGAR',
    conta,
    plano: row.plano_contas || '',
    grupoConta: row.grupo_conta || '',
    departamento: row.departamento || '',
    depTipo: dep ? dep[1] : 'nao_classificado',
    mesComp,
    mesPag,
    motivoAjuste,
    valor,
    pago,
    aberto: r2(Math.max(0, valor - Math.min(pago, valor))),
    dentro: peri.efeito === 'dentro',
    linhaFora: peri.linha,
    statusPerimetro: peri.status,
    grupo: classe.grupo,
    subgrupo: classe.subgrupo,
    natureza: classe.natureza,
    controlabilidade: classe.controlabilidade,
    statusClasse: classe.status,
    nota: classe.nota || '',
    flag,
    palavras,
    fornecedor: fornecedorDe(row),
    descricao: row.descricao || '',
    painel: painelElegivel(row),
    das: peri.linha.startsWith('Deduções') && (conta.startsWith('2.2.06.002') || /(^|[^A-Z])DAS([^A-Z]|$)/.test(norm(row.descricao))),
  }
}

function camadaDe(item, mediaConta, repeticoes) {
  if (!item.dentro) return { sugerida: '—', efetiva: '—', status: '—', motivo: '' }
  if (item.conta.startsWith('5.15.05')) return { sugerida: 'discricionario', efetiva: 'discricionario', status: 'confirmada', motivo: 'Patrocínios' }
  if (item.conta.startsWith('8.7')) return { sugerida: 'nao_recorrente', efetiva: 'nao_recorrente', status: 'confirmada', motivo: 'Desligamentos' }
  if (item.motivoAjuste === 'bonus_jan_fev_2026') return { sugerida: 'nao_recorrente', efetiva: 'nao_recorrente', status: 'confirmada', motivo: 'Bônus pago fora da competência' }
  const motivos = []
  if (item.palavras.length) motivos.push(`descrição: ${item.palavras.join(', ')}`)
  if (repeticoes === 1 && item.valor >= 1000) motivos.push('fornecedor sem outra ocorrência na conta em 12 meses')
  if (mediaConta.n >= 3 && mediaConta.media > 0 && item.valor > r2(mediaConta.media * 2) && item.valor >= 1000) {
    motivos.push(`valor acima de 2x a média da conta (${mediaConta.media})`)
  }
  if (motivos.length) {
    return { sugerida: 'nao_recorrente', efetiva: 'estrutural', status: 'sugerido', motivo: motivos.join('; ') }
  }
  return { sugerida: 'estrutural', efetiva: 'estrutural', status: 'padrao', motivo: '' }
}

function valorGerencial(item) {
  if (!item.dentro || !noRecorte(item.mesComp)) return 0
  if (item.conta.startsWith('8.2.04') || item.conta.startsWith('8.2.05')) return 0
  return item.valor
}
function valorSemProvisao(item) {
  if (!item.dentro || !noRecorte(item.mesComp)) return 0
  return item.valor
}
function valorCaixa(item) {
  if (!item.dentro || !noRecorte(item.mesPag)) return 0
  return item.pago
}

async function main() {
  const pagar = await paginar((a, b) =>
    supabase.from('financeiro_parcelas_itens').select(COLS).eq('tipo', 'PAGAR')
      .gte('competencia_titulo', '2024-02-01').lt('competencia_titulo', '2026-10-01')
      .order('ci_item', { ascending: true }).range(a, b))
  const pagarCaixa = await paginar((a, b) =>
    supabase.from('financeiro_parcelas_itens').select(COLS).eq('tipo', 'PAGAR')
      .gte('data_pagamento', '2024-02-01').lt('data_pagamento', '2026-10-01')
      .order('ci_item', { ascending: true }).range(a, b))
  const especiais = await paginar((a, b) =>
    supabase.from('financeiro_parcelas_itens').select(COLS).in('ci_item', [29, 614]).range(a, b))
  const receber = await paginar((a, b) =>
    supabase.from('financeiro_parcelas_itens').select(COLS).eq('tipo', 'RECEBER')
      .gte('competencia_titulo', '2025-01-01').lt('competencia_titulo', '2026-09-01')
      .order('ci_item', { ascending: true }).range(a, b))
  const receberCaixa = await paginar((a, b) =>
    supabase.from('financeiro_parcelas_itens').select(COLS).eq('tipo', 'RECEBER')
      .gte('data_pagamento', '2025-01-01').lt('data_pagamento', '2026-09-01')
      .order('ci_item', { ascending: true }).range(a, b))
  const orcamento = await paginar((a, b) =>
    supabase.from('opex_orcamento_linha').select('id,ano,mes,grupo_conta,plano_contas,conta_numero,descricao,departamento,valor')
      .eq('ano', 2026).order('id', { ascending: true }).range(a, b))
  const { data: inadRows, error: inadErr } = await supabase.from('receita_inadimplencia_fechamento_mensal').select('ano,mes,valor_total')
  if (inadErr) throw new Error(inadErr.message)
  const { data: colabs, error: colErr } = await supabase.from('colaboradores').select('full_name,area,cargo,is_active,admission_date,termination_date')
  if (colErr) throw new Error(colErr.message)
  const { data: turns, error: turnErr } = await supabase.from('sp_turnover').select('nome,area,cargo,admissao,desligamento')
  if (turnErr) throw new Error(turnErr.message)

  const porCi = new Map()
  for (const row of [...pagar, ...pagarCaixa, ...especiais]) porCi.set(row.ci_item, row)
  const itens = [...porCi.values()].map(montarPagar)

  const freq = new Map()
  const somaConta = new Map()
  for (const item of itens) {
    if (!item.mesComp) continue
    const chave = `${item.conta}|${norm(item.fornecedor)}`
    const lista = freq.get(chave) || []
    lista.push(item.mesComp)
    freq.set(chave, lista)
    if (noRecorte(item.mesComp) && item.valor > 0) {
      const s = somaConta.get(item.conta) || { soma: 0, n: 0 }
      s.soma = r2(s.soma + item.valor)
      s.n += 1
      somaConta.set(item.conta, s)
    }
  }
  for (const item of itens) {
    const mesesForn = freq.get(`${item.conta}|${norm(item.fornecedor)}`) || []
    const inicio = shiftMes(item.mesComp, -11)
    const repeticoes = mesesForn.filter((m) => m >= inicio && m <= item.mesComp).length
    const s = somaConta.get(item.conta) || { soma: 0, n: 0 }
    const media = s.n ? r2(s.soma / s.n) : 0
    item.camada = camadaDe(item, { n: s.n, media }, repeticoes)
  }

  const porReceber = new Map()
  for (const row of [...receber, ...receberCaixa]) porReceber.set(row.ci_item, row)
  const receitas = [...porReceber.values()].map((row) => {
    let origem = row.competencia_titulo ? String(row.competencia_titulo).slice(0, 10) : ''
    let motivoAjuste = ''
    if (Number(row.ci_item) === 614 || Number(row.ci_item) === 29 || (origem && origem < '2020-01-01')) {
      origem = row.data_vencimento ? String(row.data_vencimento).slice(0, 10) : ''
      motivoAjuste = 'competencia_invalida_usou_vencimento'
    }
    const plano = norm(row.plano_contas)
    const dep = String(row.departamento ?? '').trim()
    return {
      ci: row.ci_item,
      tipo: 'RECEBER',
      conta: String(row.conta_numero ?? ''),
      plano: row.plano_contas || '',
      departamento: dep,
      depTipo: (DEPARTAMENTOS.find((d) => d[0] === dep) || [null, 'nao_classificado'])[1],
      mesComp: mesDe(origem),
      mesPag: mesDe(row.data_pagamento),
      motivoAjuste,
      valor: abs(row.valor_item ?? row.valor_fluxo_item),
      pago: row.data_pagamento ? abs(row.valor_pago_item) : 0,
      descricao: row.descricao || '',
      reembolso: dep === 'Conta Corrente Clientes' && plano === 'REEMBOLSO DE DESPESAS',
      candidataRepasse: plano === 'OUTRAS RECEITAS' || plano.includes('REPASSE') || norm(row.descricao).includes('REPASSE'),
      textoRepasse: plano.includes('REPASSE') || norm(row.descricao).includes('REPASSE'),
    }
  })

  const usados = new Set()
  const pares = []
  for (const item of itens.filter((i) => i.linhaFora === 'Repasses a clientes' && noRecorte(i.mesComp))) {
    const match = receitas.find((r) =>
      !usados.has(r.ci) && r.candidataRepasse && r.mesComp === item.mesComp && r.departamento === item.departamento && Math.abs(r.valor - item.valor) < 0.02)
    if (match) usados.add(match.ci)
    pares.push({ item, match })
  }
  for (const r of receitas) if (r.textoRepasse) usados.add(r.ci)

  const dasPorMesRef = new Map(MESES.map((m) => [m, 0]))
  const dasSemMes = []
  for (const item of itens.filter((i) => i.das)) {
    const base = item.mesPag || item.mesComp
    if (!base) {
      dasSemMes.push(item.ci)
      continue
    }
    const ref = shiftMes(base, -1)
    if (dasPorMesRef.has(ref)) dasPorMesRef.set(ref, r2(dasPorMesRef.get(ref) + (item.mesPag ? item.pago || item.valor : item.valor)))
  }

  const outrasDed = new Map(MESES.map((m) => [m, 0]))
  for (const item of itens) {
    if (item.linhaFora !== 'Deduções / tributos sobre faturamento' || item.das) continue
    if (!noRecorte(item.mesComp)) continue
    outrasDed.set(item.mesComp, r2(outrasDed.get(item.mesComp) + item.valor))
  }

  const provisaoBase = new Map(MESES.map((m) => [m, 0]))
  for (const item of itens) {
    if (!item.dentro || !noRecorte(item.mesComp)) continue
    if (item.conta.startsWith('8.1.01') || item.conta.startsWith('8.1.02')) {
      provisaoBase.set(item.mesComp, r2(provisaoBase.get(item.mesComp) + item.valor))
    }
  }
  const provisao13 = new Map()
  const provisaoFerias = new Map()
  for (const mes of MESES) {
    const v = r2((provisaoBase.get(mes) || 0) / 12)
    provisao13.set(mes, v)
    provisaoFerias.set(mes, v)
  }

  function soma(pred, campo) {
    return r2(itens.filter(pred).reduce((s, i) => s + campo(i), 0))
  }

  const opexG = new Map()
  const opexS = new Map()
  const opexC = new Map()
  const fora = new Map()
  const painel = new Map()
  for (const mes of MESES) {
    for (const regime of ['gerencial', 'sem_provisao', 'caixa']) {
      opexG.set(`${mes}|${regime}`, 0)
    }
    const g = soma((i) => i.mesComp === mes, valorGerencial) + provisao13.get(mes) + provisaoFerias.get(mes)
    const s = soma((i) => i.mesComp === mes, valorSemProvisao)
    const c = soma((i) => i.mesPag === mes, valorCaixa)
    opexG.set(`${mes}|gerencial`, r2(g))
    opexG.set(`${mes}|sem_provisao`, s)
    opexG.set(`${mes}|caixa`, c)
    opexS.set(mes, s)
    opexC.set(mes, c)
    fora.set(`${mes}|competencia`, soma((i) => !i.dentro && i.mesComp === mes, (i) => i.valor))
    fora.set(`${mes}|caixa`, soma((i) => !i.dentro && i.mesPag === mes, (i) => i.pago))
    painel.set(`${mes}|competencia`, soma((i) => i.painel && i.mesComp === mes, (i) => i.valor))
    painel.set(`${mes}|caixa`, soma((i) => i.painel && i.mesPag === mes, (i) => i.pago))
  }

  const totalPagar = (mes, regime) => regime === 'caixa'
    ? soma((i) => i.mesPag === mes, (i) => i.pago)
    : soma((i) => i.mesComp === mes, (i) => i.valor)

  const bruta = new Map()
  const exclReemb = new Map()
  const exclRep = new Map()
  const recebida = new Map()
  for (const mes of MESES) {
    const doMes = receitas.filter((r) => r.mesComp === mes)
    bruta.set(mes, r2(doMes.reduce((s, r) => s + r.valor, 0)))
    exclReemb.set(mes, r2(doMes.filter((r) => r.reembolso).reduce((s, r) => s + r.valor, 0)))
    exclRep.set(mes, r2(doMes.filter((r) => usados.has(r.ci)).reduce((s, r) => s + r.valor, 0)))
    const caixaMes = receitas.filter((r) => r.mesPag === mes && !r.reembolso && !usados.has(r.ci))
    recebida.set(mes, r2(caixaMes.reduce((s, r) => s + r.pago, 0)))
  }

  const deducao = new Map()
  const deducaoStatus = new Map()
  for (const mes of MESES) {
    const seguinte = shiftMes(mes, 1)
    const das = dasPorMesRef.get(mes) || 0
    if (seguinte > '2026-08' && das === 0) {
      deducaoStatus.set(mes, indisp(`DAS de ${mes} seria pago em ${seguinte}, mês aberto, e não há lançamento`))
      deducao.set(mes, null)
    } else {
      deducao.set(mes, r2(das + (outrasDed.get(mes) || 0)))
      deducaoStatus.set(mes, das === 0 ? 'sem DAS pago no mês seguinte' : 'ok')
    }
  }

  const liquida = new Map()
  for (const mes of MESES) {
    if (deducao.get(mes) == null) liquida.set(mes, deducaoStatus.get(mes))
    else liquida.set(mes, r2(bruta.get(mes) - exclReemb.get(mes) - exclRep.get(mes) - deducao.get(mes)))
  }

  const aliquotas = []
  for (const mes of MESES) {
    const d = deducao.get(mes)
    const b = bruta.get(mes)
    if (typeof d === 'number' && d >= 1000 && b > 0) aliquotas.push(d / b)
  }
  aliquotas.sort((a, b) => a - b)
  const medianaAliq = aliquotas.length ? aliquotas[Math.floor(aliquotas.length / 2)] : null

  const inad = new Map()
  for (const row of inadRows ?? []) inad.set(`${row.ano}-${String(row.mes).padStart(2, '0')}`, Number(row.valor_total))

  const chaveNome = (s) => norm(s)
  const ghosts = []
  const ativosChaves = new Set((colabs ?? []).filter((c) => c.is_active).map((c) => chaveNome(c.full_name)))
  for (const t of turns ?? []) {
    if (!t.desligamento && !ativosChaves.has(chaveNome(t.nome))) ghosts.push(t.cargo || '')
  }
  function pessoasNoMes(ym) {
    const fim = fimDoMes(ym)
    const set = new Map()
    for (const t of turns ?? []) {
      if (!t.admissao || !t.desligamento) continue
      if (String(t.admissao) <= fim && String(t.desligamento) > fim) {
        set.set(chaveNome(t.nome), { cargo: t.cargo || '', area: t.area || '' })
      }
    }
    for (const c of colabs ?? []) {
      if (!c.is_active) continue
      const adm = c.admission_date || '1900-01-01'
      if (String(adm) <= fim) set.set(chaveNome(c.full_name), { cargo: c.cargo || '', area: c.area || '' })
    }
    return [...set.values()]
  }
  const head = new Map()
  for (const mes of [...MESES, '2026-09']) head.set(mes, pessoasNoMes(mes))

  const estrutural = (item) => item.camada.efetiva === 'estrutural'
  function caixaEstrutural(mes) {
    return r2(itens.filter((i) => i.mesPag === mes && estrutural(i)).reduce((s, i) => s + valorCaixa(i), 0))
  }
  const runRate = r2((caixaEstrutural('2026-06') + caixaEstrutural('2026-07') + caixaEstrutural('2026-08')) / 3)
  const realizado2026 = r2(MESES_2026.reduce((s, m) => s + opexC.get(m), 0))
  const refSetDez = r2((orcamento ?? []).filter((o) => o.mes >= 9).reduce((s, o) => s + Number(o.valor || 0), 0))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.title = `Baseline OPEX ${VERSAO}`

  const paramLinhas = PARAMETROS.map((p) => p)
  paramLinhas.push(['versao_baseline', VERSAO, 'confirmada', 'Snapshot congelado em 23/09/2026'])
  paramLinhas.push(['opex_estrutural_anualizado', runRate * 12, 'calculada', 'Run-rate estrutural em caixa, jun–ago/2026 × 12. Premissa: estrutura mantida, sem contratação, saída ou reajuste além do já observado. O reajuste listado na aba 11 não entra neste número.'])
  escrever(wb, '01_Parametros', ['parametro', 'valor', 'status', 'nota'], paramLinhas, [2])

  const ponte = []
  for (const regime of ['competencia', 'caixa']) {
    for (const mes of MESES) {
      const campoMes = regime === 'caixa' ? 'mesPag' : 'mesComp'
      const valorDe = regime === 'caixa' ? (i) => i.pago : (i) => i.valor
      const doMes = (pred) => soma((i) => i[campoMes] === mes && pred(i), valorDe)
      const efeitos = {
        socios: doMes((i) => i.painel && i.linhaFora === 'Sócios de capital'),
        deducoes: doMes((i) => i.painel && i.linhaFora.startsWith('Deduções')),
        passivo: doMes((i) => i.painel && i.linhaFora === 'Passivo tributário'),
        reembolso: doMes((i) => i.painel && i.linhaFora === 'Reembolsáveis de clientes'),
        repasse: doMes((i) => i.painel && i.linhaFora === 'Repasses a clientes'),
        capex: doMes((i) => i.painel && i.linhaFora === 'CAPEX'),
        naoOp: doMes((i) => i.painel && i.linhaFora === 'Não operacional'),
        permuta: doMes((i) => i.painel && i.linhaFora === 'Permuta'),
        entra: doMes((i) => i.dentro && !i.painel),
        jaFora: doMes((i) => !i.painel && !i.dentro),
      }
      const basePainel = painel.get(`${mes}|${regime}`)
      const lancado = regime === 'caixa' ? opexC.get(mes) : opexS.get(mes)
      const calculado = r2(basePainel - efeitos.socios - efeitos.deducoes - efeitos.passivo - efeitos.reembolso - efeitos.repasse - efeitos.capex - efeitos.naoOp - efeitos.permuta + efeitos.entra)
      ponte.push([
        mes, regime, basePainel, efeitos.socios, efeitos.deducoes, efeitos.passivo, efeitos.reembolso, efeitos.repasse, efeitos.capex, efeitos.naoOp, efeitos.permuta, efeitos.entra, efeitos.jaFora, lancado, r2(calculado - lancado),
        regime === 'competencia' ? r2(opexG.get(`${mes}|gerencial`) - lancado) : 'provisão não se aplica ao caixa',
        regime === 'competencia' ? opexG.get(`${mes}|gerencial`) : lancado,
      ])
    }
  }
  escrever(wb, '02_Ponte_painel_para_v2', [
    'mes', 'regime', 'opex_painel', 'sai_socios', 'sai_deducoes', 'sai_passivo', 'sai_reembolsaveis', 'sai_repasses', 'sai_capex', 'sai_nao_operacional', 'sai_permuta', 'entra_no_v2', 'ja_fora_do_painel', 'opex_v2_lancado', 'diferenca_ponte', 'ajuste_provisao', 'opex_v2',
  ], ponte, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])

  const grupos = [...new Set(itens.filter((i) => i.dentro).map((i) => i.grupo)), 'Provisão de 13º', 'Provisão de férias']
  const opexMensal = []
  for (const mes of MESES) {
    for (const grupo of grupos) {
      for (const camada of ['estrutural', 'discricionario', 'nao_recorrente']) {
        const g = itens.filter((i) => i.mesComp === mes && i.grupo === grupo && i.camada.efetiva === camada).reduce((s, i) => s + valorGerencial(i), 0)
        const s = itens.filter((i) => i.mesComp === mes && i.grupo === grupo && i.camada.efetiva === camada).reduce((s0, i) => s0 + valorSemProvisao(i), 0)
        const c = itens.filter((i) => i.mesPag === mes && i.grupo === grupo && i.camada.efetiva === camada).reduce((s0, i) => s0 + valorCaixa(i), 0)
        let gVal = r2(g)
        if (grupo === 'Provisão de 13º' && camada === 'estrutural') gVal = provisao13.get(mes)
        if (grupo === 'Provisão de férias' && camada === 'estrutural') gVal = provisaoFerias.get(mes)
        if ((grupo === 'Provisão de 13º' || grupo === 'Provisão de férias') && camada !== 'estrutural') continue
        if (gVal === 0 && r2(s) === 0 && r2(c) === 0) continue
        opexMensal.push([mes, mes.startsWith('2025') ? 'não comparável' : '2026', grupo, camada, r2(c), gVal, r2(s)])
      }
    }
    const pago = soma((i) => i.dentro && i.mesComp === mes, (i) => Math.min(i.pago, i.valor))
    const aberto = soma((i) => i.dentro && i.mesComp === mes, (i) => i.aberto)
    opexMensal.push([mes, mes.startsWith('2025') ? 'não comparável' : '2026', 'TOTAL', 'todas', opexC.get(mes), opexG.get(`${mes}|gerencial`), opexS.get(mes), pago, aberto])
  }
  escrever(wb, '03_OPEX_mensal', ['mes', 'leitura', 'grupo', 'camada', 'caixa', 'competencia_gerencial_auxiliar', 'competencia_sem_provisao_auxiliar', 'ja_pago_na_competencia', 'em_aberto_na_competencia'], opexMensal, [5, 6, 7, 8, 9])
  const opexSheet = wb.getWorksheet('03_OPEX_mensal')
  opexSheet.addRow([])
  opexSheet.addRow([AVISO_2025])
  opexSheet.addRow([`Competência é visão auxiliar. ${AVISO_COMPETENCIA}`])

  const linhasFora = ['Sócios de capital', 'Deduções / tributos sobre faturamento', 'Passivo tributário', 'Reembolsáveis de clientes', 'Repasses a clientes', 'CAPEX', 'Não operacional', 'Permuta']
  const foraLinhas = []
  for (const mes of MESES) {
    for (const linha of linhasFora) {
      const comp = soma((i) => i.linhaFora === linha && i.mesComp === mes, (i) => i.valor)
      const caixa = soma((i) => i.linhaFora === linha && i.mesPag === mes, (i) => i.pago)
      if (comp === 0 && caixa === 0) continue
      foraLinhas.push([mes, linha, comp, caixa])
    }
  }
  escrever(wb, '04_Fora_do_OPEX', ['mes', 'linha', 'competencia', 'caixa'], foraLinhas, [3, 4])

  const hon = new Map()
  const honTipo = new Map()
  const honDep = new Map()
  const foraRec = new Map()
  for (const mes of MESES) {
    hon.set(mes, 0)
    for (const tipo of ['recorrente', 'variavel', 'nao_classificavel']) honTipo.set(`${mes}|${tipo}`, 0)
  }
  for (const r of receitas) {
    if (!noRecorte(r.mesComp)) continue
    const foraLinha = linhaForaReceita(r.conta, r.departamento)
    if (foraLinha || !ehHonorario(r.conta, r.departamento)) {
      const motivo = foraLinha || 'demais contas, fora dos honorários'
      const k = `${r.mesComp}|${motivo}`
      foraRec.set(k, r2((foraRec.get(k) || 0) + r.valor))
      continue
    }
    hon.set(r.mesComp, r2(hon.get(r.mesComp) + r.valor))
    const tipo = tipoHonorario(r.conta)
    honTipo.set(`${r.mesComp}|${tipo}`, r2((honTipo.get(`${r.mesComp}|${tipo}`) || 0) + r.valor))
    const kd = `${r.mesComp}|${r.departamento || '(sem departamento)'}`
    honDep.set(kd, r2((honDep.get(kd) || 0) + r.valor))
  }
  const receitaLinhas = []
  for (const mes of MESES) {
    const das = mes.startsWith('2026') ? (deducao.get(mes) ?? deducaoStatus.get(mes)) : 'não apresentado — DAS só em 2026'
    receitaLinhas.push([
      mes,
      hon.get(mes),
      honTipo.get(`${mes}|recorrente`),
      honTipo.get(`${mes}|variavel`),
      honTipo.get(`${mes}|nao_classificavel`),
      das,
      inad.has(mes) ? inad.get(mes) : indisp('sem fechamento em receita_inadimplencia_fechamento_mensal'),
    ])
  }
  escrever(wb, '05_Receita', ['mes', 'honorarios_brutos', 'recorrente', 'variavel', 'nao_classificavel', 'das', 'inadimplencia_fechamento'], receitaLinhas, [2, 3, 4, 5, 6, 7])
  const recSheet = wb.getWorksheet('05_Receita')
  recSheet.addRow([])
  recSheet.addRow(['Receita operacional = honorários brutos nas contas 3.1.01, 3.1.03, 3.1.04, 3.1.05, 3.1.06, 3.1.07 e 3.1.08. Fora: 3.1.02, 3.2.06, 3.2.01, 2.1.08, 11.1.01, 3.5.x e todo o departamento Conta Corrente Clientes. Tipo: recorrente 3.1.03/05/06, variável 3.1.04/07/08, não classificável 3.1.01. DAS à parte, só em 2026, e não abate o honorário bruto.'])
  recSheet.addRow([])
  recSheet.addRow(['Fora da receita operacional'])
  recSheet.addRow(['mes', 'motivo', 'valor'])
  for (const [k, v] of [...foraRec.entries()].sort()) {
    const sep = k.indexOf('|')
    const added = recSheet.addRow([k.slice(0, sep), k.slice(sep + 1), v])
    added.getCell(3).numFmt = '"R$" #,##0.00'
  }
  recSheet.addRow([])
  recSheet.addRow(['Honorários brutos por departamento'])
  for (const [k, v] of [...honDep.entries()].sort()) {
    const sep = k.indexOf('|')
    const added = recSheet.addRow([k.slice(0, sep), k.slice(sep + 1), v])
    added.getCell(3).numFmt = '"R$" #,##0.00'
  }

  const oxr = []
  let acumOpex = 0
  let acumHon = 0
  MESES_2026.forEach((mes, idx) => {
    const opex = opexC.get(mes)
    const bruto = hon.get(mes)
    const rec = honTipo.get(`${mes}|recorrente`)
    acumOpex = r2(acumOpex + opex)
    acumHon = r2(acumHon + bruto)
    const indice = bruto > 0 ? opex / bruto : indisp('honorários brutos zerados')
    let indiceMm3 = indisp('menos de 3 meses em 2026')
    if (idx >= 2) {
      const o3 = MESES_2026.slice(idx - 2, idx + 1).reduce((s, m) => s + opexC.get(m), 0)
      const h3 = MESES_2026.slice(idx - 2, idx + 1).reduce((s, m) => s + hon.get(m), 0)
      indiceMm3 = h3 > 0 ? o3 / h3 : indisp('honorários brutos zerados na janela')
    }
    const indiceAcum = acumHon > 0 ? acumOpex / acumHon : indisp('honorários brutos acumulados zerados')
    const cobertura = opex > 0 ? rec / opex : indisp('OPEX zerado')
    oxr.push([mes, opex, bruto, indice, indiceMm3, indiceAcum, rec, cobertura])
  })
  escrever(wb, '06_OPEX_x_Receita', ['mes', 'opex_caixa', 'honorarios_brutos', 'opex_sobre_honorarios', 'opex_sobre_honorarios_mm3', 'opex_sobre_honorarios_acumulado', 'honorarios_recorrentes', 'cobertura_recorrente'], oxr, [2, 3, 7])
  const compSheet = wb.getWorksheet('06_OPEX_x_Receita')
  for (const row of compSheet.getRows(2, oxr.length) || []) {
    for (const col of [4, 5, 6, 8]) {
      const cell = row.getCell(col)
      if (typeof cell.value === 'number') cell.numFmt = '0.00%'
    }
  }
  compSheet.addRow([])
  compSheet.addRow([AVISO_2025])
  compSheet.addRow(['Índice = OPEX em caixa / honorários brutos. Cobertura recorrente = honorários recorrentes / OPEX em caixa. Série só de 2026.'])

  function pontePeriodo(mesesA, mesesB, filtro) {
    const media = (meses) => {
      const map = new Map()
      for (const mes of meses) {
        for (const item of itens) {
          if (item.mesPag !== mes || !filtro(item)) continue
          map.set(item.grupo, r2((map.get(item.grupo) || 0) + valorCaixa(item)))
        }
      }
      for (const [k, v] of map) map.set(k, r2(v / meses.length))
      return map
    }
    return [media(mesesA), media(mesesB)]
  }
  const drv = wb.addWorksheet('07_Drivers')
  drv.addRow([AVISO_2025])
  drv.addRow(['Ponte da média mensal em caixa, só 2026']).font = { bold: true }
  drv.addRow(['comparacao', 'grupo', 'media_a', 'media_b', 'delta'])
  const comparacoes = [
    ['1º tri/2026 x jun–ago/2026', ['2026-01', '2026-02', '2026-03'], ['2026-06', '2026-07', '2026-08']],
  ]
  const filtrosCamada = [
    ['estrutural', (i) => i.dentro && i.camada.efetiva === 'estrutural'],
    ['discricionario', (i) => i.dentro && i.camada.efetiva === 'discricionario'],
    ['nao_recorrente', (i) => i.dentro && i.camada.efetiva === 'nao_recorrente'],
  ]
  for (const [nome, a, b] of comparacoes) {
    for (const [camada, filtro] of filtrosCamada) {
      const [ma, mb] = pontePeriodo(a, b, filtro)
      const chaves = new Set([...ma.keys(), ...mb.keys()])
      let delta = 0
      for (const grupo of chaves) {
        const va = ma.get(grupo) || 0
        const vb = mb.get(grupo) || 0
        delta = r2(delta + vb - va)
        drv.addRow([`${nome} | ${camada}`, grupo, va, vb, r2(vb - va)])
      }
      drv.addRow([`${nome} | ${camada}`, 'TOTAL', '', '', delta])
    }
  }
  drv.addRow([])
  drv.addRow(['Associados por departamento — mesma ponte']).font = { bold: true }
  drv.addRow(['comparacao', 'departamento', 'media_a', 'media_b', 'delta'])
  for (const [nome, a, b] of comparacoes) {
    const mediaDep = (meses) => {
      const map = new Map()
      for (const mes of meses) {
        for (const item of itens) {
          if (item.mesPag !== mes || !item.conta.startsWith('8.1.01') || !item.dentro) continue
          map.set(item.departamento || '(sem)', r2((map.get(item.departamento || '(sem)') || 0) + item.pago))
        }
      }
      for (const [k, v] of map) map.set(k, r2(v / meses.length))
      return map
    }
    const ma = mediaDep(a)
    const mb = mediaDep(b)
    for (const dep of new Set([...ma.keys(), ...mb.keys()])) {
      drv.addRow([nome, dep, ma.get(dep) || 0, mb.get(dep) || 0, r2((mb.get(dep) || 0) - (ma.get(dep) || 0))])
    }
  }
  drv.addRow([])
  drv.addRow(['Volume x preço em Pessoas']).font = { bold: true }
  drv.addRow(['comparacao', 'fte_a', 'fte_b', 'custo_medio_a', 'custo_medio_b', 'efeito_volume', 'efeito_preco', 'fecha'])
  function fteMes(mes) {
    return r2(head.get(mes).reduce((s, p) => s + categoriaCargo(p.cargo, p.area).peso, 0))
  }
  function custoPessoas(mes) {
    return r2(itens.filter((i) => i.mesPag === mes && i.grupo === 'Pessoas').reduce((s, i) => s + valorCaixa(i), 0))
  }
  for (const [nome, a, b] of comparacoes) {
    const fteA = r2(a.reduce((s, m) => s + fteMes(m), 0) / a.length)
    const fteB = r2(b.reduce((s, m) => s + fteMes(m), 0) / b.length)
    const custoA = r2(a.reduce((s, m) => s + custoPessoas(m), 0) / a.length)
    const custoB = r2(b.reduce((s, m) => s + custoPessoas(m), 0) / b.length)
    if (fteA === 0 || fteB === 0) {
      drv.addRow([nome, fteA, fteB, '', '', indisp('FTE zerado'), indisp('FTE zerado'), ''])
      continue
    }
    const medA = custoA / fteA
    const medB = custoB / fteB
    const vol = r2((fteB - fteA) * medA)
    const preco = r2((medB - medA) * fteB)
    drv.addRow([nome, fteA, fteB, r2(medA), r2(medB), vol, preco, r2(vol + preco - (custoB - custoA))])
  }
  const contasDelta = new Map()
  for (const item of itens) {
    if (!item.dentro) continue
    const ano = ['2026-01', '2026-02', '2026-03'].includes(item.mesPag) ? 'a' : ['2026-06', '2026-07', '2026-08'].includes(item.mesPag) ? 'b' : ''
    if (!ano || !item.dentro) continue
    const k = item.conta
    const atual = contasDelta.get(k) || { conta: k, plano: item.plano, a: 0, b: 0 }
    atual[ano] = r2(atual[ano] + item.pago)
    contasDelta.set(k, atual)
  }
  const deltas = [...contasDelta.values()].map((c) => ({ ...c, delta: r2(c.b - c.a), cresc: c.a > 0 ? (c.b - c.a) / c.a : null }))
  const opexConta2026 = r2(deltas.reduce((s, c) => s + c.b, 0))
  drv.addRow([])
  drv.addRow(['Matriz por conta — caixa, 1º tri/2026 contra jun–ago/2026. 2025 fora da comparação.']).font = { bold: true }
  drv.addRow(['conta', 'plano', 'valor_1tri', 'valor_jun_ago', 'pct_opex_jun_ago', 'crescimento', 'delta'])
  for (const c of deltas.sort((a, b) => b.b - a.b)) {
    drv.addRow([c.conta, c.plano, c.a, c.b, opexConta2026 ? c.b / opexConta2026 : 0, c.cresc ?? indisp('base 2025 zerada'), c.delta])
  }
  drv.addRow([])
  drv.addRow(['Top 10 aumentos']).font = { bold: true }
  for (const c of [...deltas].sort((a, b) => b.delta - a.delta).slice(0, 10)) drv.addRow([c.conta, c.plano, c.delta])
  drv.addRow(['Top 10 reduções']).font = { bold: true }
  for (const c of [...deltas].sort((a, b) => a.delta - b.delta).slice(0, 10)) drv.addRow([c.conta, c.plano, c.delta])

  const pesLinhas = []
  const catMap = new Map()
  for (const mes of [...MESES, '2026-09']) {
    const agg = new Map()
    for (const p of head.get(mes)) {
      const cat = categoriaCargo(p.cargo, p.area)
      const dep = areaParaDepartamento(p.area)
      const k = `${cat.categoria}|${dep}`
      const atual = agg.get(k) || { n: 0, fte: 0 }
      atual.n += 1
      atual.fte = r2(atual.fte + cat.peso)
      agg.set(k, atual)
      const ck = `${p.cargo}|${p.area}`
      if (!catMap.has(ck)) catMap.set(ck, { cargo: p.cargo, area: p.area, ...cat })
    }
    let totalN = 0
    let totalFte = 0
    for (const [k, v] of agg) {
      const [categoria, dep] = k.split('|')
      pesLinhas.push([mes, categoria, dep, v.n, v.fte])
      totalN += v.n
      totalFte = r2(totalFte + v.fte)
    }
    pesLinhas.push([mes, 'TOTAL', '', totalN, totalFte])
  }
  escrever(wb, '08_Pessoas', ['mes', 'categoria', 'departamento', 'headcount', 'fte'], pesLinhas)
  const pes = wb.getWorksheet('08_Pessoas')
  pes.addRow([])
  pes.addRow(['Premissa fixa, sem revisão manual. Áreas jurídicas: Reestruturação, Trabalhista, Cível, Contratos, Recuperação de Crédito, Tributário e Distressed Deals. O cadastro grava Distressed Deals como Distressd Deals; a regra trata os dois como a mesma área. Estagiário fora da área jurídica é apoio, com FTE 0,75.'])
  pes.addRow(['cargo', 'area', 'categoria', 'regra_aplicada', 'peso_fte'])
  for (const c of [...catMap.values()].sort((a, b) => a.area.localeCompare(b.area) || a.cargo.localeCompare(b.cargo))) {
    pes.addRow([c.cargo, c.area, c.categoria, c.regra, c.peso])
  }
  pes.addRow(['Validação set/2026', head.get('2026-09').length, head.get('2026-09').length === 59 ? 'OK' : 'ALERTA'])

  const efic = []
  const areasMeta = DEPARTAMENTOS.filter((d) => d[2]).map((d) => d[0])
  for (const mes of MESES_2026) {
    const fte = fteMes(mes)
    const fteAdv = r2(head.get(mes).filter((p) => categoriaCargo(p.cargo, p.area).categoria === 'advogado').reduce((s, p) => s + categoriaCargo(p.cargo, p.area).peso, 0))
    const fteApoio = r2(head.get(mes).filter((p) => categoriaCargo(p.cargo, p.area).categoria === 'apoio').reduce((s, p) => s + categoriaCargo(p.cargo, p.area).peso, 0))
    const bruto = hon.get(mes)
    efic.push([
      mes,
      opexC.get(mes),
      fte,
      fte ? r2(opexC.get(mes) / fte) : indisp('FTE zerado'),
      fteAdv ? r2(bruto / fteAdv) : indisp('FTE de advogado zerado'),
      fte ? r2(bruto / fte) : indisp('FTE zerado'),
      fte ? fteApoio / fte : indisp('FTE zerado'),
    ])
  }
  escrever(wb, '09_Eficiencia', ['mes', 'opex_caixa', 'fte', 'opex_por_fte', 'honorarios_por_advogado', 'honorarios_por_fte', 'pct_fte_apoio'], efic, [2, 4, 5, 6])
  for (const row of wb.getWorksheet('09_Eficiencia').getRows(2, efic.length) || []) {
    const cell = row.getCell(7)
    if (typeof cell.value === 'number') cell.numFmt = '0.00%'
  }
  const ef = wb.getWorksheet('09_Eficiencia')
  ef.addRow([])
  ef.addRow([AVISO_2025])
  ef.addRow(['Margem de contribuição direta por área jurídica, só 2026. Receita = honorários brutos do departamento. Custo direto em caixa. Sem rateio de indireto e sem ratear o DAS.'])
  ef.addRow(['mes', 'area', 'honorarios_brutos', 'associados_caixa', 'comissoes_caixa', 'custas_caixa', 'custo_direto', 'margem'])
  for (const mes of MESES_2026) {
    for (const area of areasMeta) {
      const rec = receitas.filter((r) => r.mesComp === mes && r.departamento === area && ehHonorario(r.conta, r.departamento)).reduce((s, r) => s + r.valor, 0)
      const assoc = itens.filter((i) => i.mesPag === mes && i.departamento === area && i.conta.startsWith('8.1.01') && i.dentro).reduce((s, i) => s + i.pago, 0)
      const com = itens.filter((i) => i.mesPag === mes && i.departamento === area && i.grupo === 'Comissões e parcerias' && i.dentro).reduce((s, i) => s + i.pago, 0)
      const cus = itens.filter((i) => i.mesPag === mes && i.departamento === area && i.grupo === 'Despesas processuais' && i.dentro).reduce((s, i) => s + i.pago, 0)
      const custo = r2(assoc + com + cus)
      ef.addRow([mes, area, r2(rec), r2(assoc), r2(com), r2(cus), custo, r2(rec - custo)])
    }
  }

  const refMap = new Map()
  for (const o of orcamento ?? []) {
    if (o.mes > 8) continue
    const k = `${norm(o.grupo_conta)}|${norm(o.plano_contas)}`
    const atual = refMap.get(k) || { grupo: o.grupo_conta || '', plano: o.plano_contas || '', conta: o.conta_numero || '', valor: 0 }
    atual.valor = r2(atual.valor + Number(o.valor || 0))
    if (!atual.conta && o.conta_numero) atual.conta = o.conta_numero
    refMap.set(k, atual)
  }
  const realMap = new Map()
  for (const item of itens) {
    if (!item.dentro || !item.mesComp.startsWith('2026')) continue
    const k = `${norm(item.grupoConta)}|${norm(item.plano)}`
    const atual = realMap.get(k) || { grupo: item.grupoConta, plano: item.plano, conta: item.conta, valor: 0 }
    atual.valor = r2(atual.valor + valorSemProvisao(item))
    realMap.set(k, atual)
  }
  const refLinhas = []
  const chavesRef = new Set([...refMap.keys(), ...realMap.keys()])
  for (const k of chavesRef) {
    const ref = refMap.get(k)
    const real = realMap.get(k)
    const rv = real?.valor || 0
    const fv = ref?.valor || 0
    refLinhas.push([
      real?.grupo || ref?.grupo, real?.plano || ref?.plano, real?.conta || ref?.conta || '', rv, fv, r2(rv - fv), fv ? (rv - fv) / fv : indisp('referência zerada'),
      ref ? 'casado' : 'realizado sem referência',
    ])
  }
  refLinhas.sort((a, b) => (b[3] || 0) - (a[3] || 0))
  escrever(wb, '10_Referencia_2026', ['grupo_conta', 'subplano', 'conta', 'realizado_jan_ago', 'referencia_jan_ago', 'variacao', 'variacao_pct', 'casamento'], refLinhas, [4, 5, 6])
  wb.getWorksheet('10_Referencia_2026').insertRow(1, ['Referência 2026 não é orçamento aprovado. Referência montada em jul/2026 a partir do realizado até ago. Realizado = competência sem provisão, perímetro v2. Variação positiva = acima da referência.'])

  const consLinhas = []
  for (const [nome, tema, fim, nota] of CONSULTORIAS) {
    const alvo = norm(nome).slice(0, 18)
    const mov = itens.filter((i) => norm(i.fornecedor).includes(norm(nome).split(' ').slice(0, 2).join(' ')) && i.dentro && noRecorte(i.mesComp))
    const porMes = new Map()
    for (const i of mov) porMes.set(i.mesComp, r2((porMes.get(i.mesComp) || 0) + i.valor))
    const valores = [...porMes.values()].filter((v) => v > 0).sort((a, b) => a - b)
    const mediana = valores.length ? valores[Math.floor(valores.length / 2)] : null
    const inicio = [...porMes.keys()].sort()[0] || ''
    consLinhas.push([nome, tema, inicio, fim || 'indeterminado', mediana ?? indisp('sem lançamento no perímetro'), 'sugerida', nota])
  }
  consLinhas.push(['Francisco de Assis Barbosa Campos Zanin', 'Parceria por contrato — não é consultoria estratégica', '', '', '', 'confirmada', 'Classificado em Comissões e parcerias, mesmo na conta 5.8.20'])
  escrever(wb, '11_Consultorias_e_Contratos', ['fornecedor', 'tema', 'inicio_observado', 'fim', 'valor_mensal_mediana', 'status', 'nota'], consLinhas, [5])
  function ultimoReajuste(serie) {
    let achado = null
    for (let i = 1; i < serie.length; i++) {
      const anterior = serie[i - 1].valor
      const atual = serie[i].valor
      if (anterior <= 0 || atual <= 0) continue
      const pct = (atual - anterior) / anterior
      if (Math.abs(pct) < 0.03 || Math.abs(atual - anterior) < 1) continue
      const seguinte = serie[i + 1]
      if (!seguinte || seguinte.valor <= 0 || Math.abs(seguinte.valor - atual) / atual >= 0.03) continue
      achado = { mes: serie[i].mes, pct, conta: serie[i].conta }
    }
    return achado
  }
  const recorre = new Map()
  for (const item of itens) {
    if (!item.dentro || !item.mesPag || omitirTextoPessoa(item.conta)) continue
    const semNome = item.fornecedor === '—'
    const k = semNome ? `conta:${item.conta}` : norm(item.fornecedor)
    const atual = recorre.get(k) || { fornecedor: semNome ? '(sem fornecedor no lançamento)' : item.fornecedor, contas: new Set(), meses2026: new Set(), porConta: new Map(), porMes: new Map() }
    atual.contas.add(item.conta)
    if (item.mesPag.startsWith('2026') && item.mesPag <= '2026-08') atual.meses2026.add(item.mesPag)
    if (item.mesPag >= '2025-01' && item.mesPag <= '2026-08') {
      const serieConta = atual.porConta.get(item.conta) || new Map()
      serieConta.set(item.mesPag, r2((serieConta.get(item.mesPag) || 0) + item.pago))
      atual.porConta.set(item.conta, serieConta)
      atual.porMes.set(item.mesPag, r2((atual.porMes.get(item.mesPag) || 0) + item.pago))
    }
    recorre.set(k, atual)
  }
  const recSheet2 = wb.getWorksheet('11_Consultorias_e_Contratos')
  recSheet2.addRow([])
  recSheet2.addRow(['Contratos recorrentes: fornecedor, ou a conta quando o lançamento não tem fornecedor, com pagamento em 6 meses ou mais de 2026. Reajuste = última variação de 3% ou mais contra o mês anterior, que se manteve no mês seguinte, medida na série da conta. O reajuste não entra no forecast.'])
  recSheet2.addRow(['fornecedor', 'contas', 'meses_com_pagamento_2026', 'valor_mensal_atual', 'conta_do_reajuste', 'mes_ultimo_reajuste', 'percentual_ultimo_reajuste', 'mes_proximo_reajuste'])
  for (const r of [...recorre.values()].filter((r) => r.meses2026.size >= 6).sort((a, b) => b.meses2026.size - a.meses2026.size)) {
    let reajuste = null
    for (const [conta, mapa] of r.porConta) {
      const serie = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, valor]) => ({ mes, valor, conta }))
      const achado = ultimoReajuste(serie)
      if (achado && (!reajuste || achado.mes > reajuste.mes)) reajuste = achado
    }
    const ultimoMes = [...r.meses2026].sort().at(-1)
    const added = recSheet2.addRow([
      r.fornecedor,
      [...r.contas].sort().join(', '),
      r.meses2026.size,
      r.porMes.get(ultimoMes) || 0,
      reajuste ? reajuste.conta : '',
      reajuste ? reajuste.mes : 'sem reajuste observado',
      reajuste ? reajuste.pct : 'sem reajuste observado',
      reajuste ? shiftMes(reajuste.mes, 12) : indisp('sem reajuste observado para datar o próximo'),
    ])
    added.getCell(4).numFmt = '"R$" #,##0.00'
    if (reajuste) added.getCell(7).numFmt = '0.00%'
  }

  const camadasLinhas = itens
    .filter((i) => i.dentro && (i.camada.efetiva !== 'estrutural' || i.camada.status === 'sugerido'))
    .map((i) => [i.ci, i.mesComp, i.conta, i.grupo, i.camada.sugerida, i.camada.efetiva, i.camada.status, i.camada.motivo, i.valor])
  escrever(wb, '12_Camadas', ['ci_item', 'mes', 'conta', 'grupo', 'camada_sugerida', 'camada_efetiva', 'status', 'motivo', 'valor_competencia'], camadasLinhas, [9])

  const bonus2025 = r2(itens.filter((i) => i.motivoAjuste === 'bonus_jan_fev_2026').reduce((s, i) => s + i.pago, 0))
  const notaRunRate = `Média da camada estrutural em caixa, jun–ago/2026. ${AVISO_COMPETENCIA}. A competência não entra neste número.`
  const forecast = [
    ['cenario', 'Estrutura mantida', 'Regime caixa. Premissa: sem contratações, saídas ou reajustes além dos já observados nos dados.'],
    ['realizado_jan_ago', realizado2026, 'Caixa, todas as camadas, jan–ago/2026'],
    ['run_rate_mensal', runRate, notaRunRate],
    ['run_rate_x_4', r2(runRate * 4), 'Setembro a dezembro'],
    ['fechamento_estrutura_mantida', r2(realizado2026 + runRate * 4), 'Realizado caixa jan–ago + run-rate × 4. Reajuste não aplicado.'],
    ['cenario_comparacao', 'Referência set–dez', ''],
    ['referencia_set_dez', refSetDez, 'Perímetro da referência de jul/2026, não o perímetro v2'],
    ['fechamento_comparacao', r2(realizado2026 + refSetDez), 'Realizado jan–ago + referência set–dez'],
    ['opex_anualizado_normalizado', r2(runRate * 12), 'Run-rate estrutural em caixa × 12. Mesma premissa da estrutura mantida. Não inclui reajuste futuro.'],
    ['risco_1_bonus_2026', bonus2025, 'Fora do número. Bônus 2026 não provisionado. Valor de referência = bônus pago em jan–fev/2026, competência 2025.'],
    ['risco_2_consultoria_prazo_indeterminado', '', 'Fora do número. Mais Humanidade e Carlos Zamboni Neto, prazo indeterminado.'],
    ['risco_3_antunes', '', 'Fora do número. Contrato da Antunes termina em 12/2026, sem decisão de renovação.'],
  ]
  escrever(wb, '13_Forecast', ['linha', 'valor', 'nota'], forecast, [2])

  const classMap = new Map()
  for (const item of itens) {
    if (!item.conta) continue
    const atual = classMap.get(item.conta) || { ...item, comp: 0, n: 0 }
    if (noRecorte(item.mesComp)) {
      atual.comp = r2(atual.comp + (item.dentro ? valorSemProvisao(item) : item.valor))
      atual.n += 1
    }
    classMap.set(item.conta, atual)
  }
  const classLinhas = [...classMap.values()].sort((a, b) => a.conta.localeCompare(b.conta)).map((c) => [
    c.conta, c.plano, c.grupoConta, c.dentro ? 'dentro' : 'fora', c.linhaFora, c.grupo, c.subgrupo, c.natureza, c.controlabilidade, 'não avaliado', c.statusClasse, c.comp, c.n,
  ])
  escrever(wb, '14_Classificacao_contas', ['conta', 'plano', 'grupo_conta', 'perimetro', 'linha_fora', 'grupo_gerencial', 'subgrupo', 'natureza', 'controlabilidade', 'potencial_eficiencia', 'status', 'valor_no_recorte', 'qtd'], classLinhas, [12])

  const base = []
  for (const item of itens) {
    if (!noRecorte(item.mesComp) && !noRecorte(item.mesPag) && item.motivoAjuste !== 'competencia_invalida_usou_vencimento') continue
    const omi = item.grupo === 'Pessoas' || omitirTextoPessoa(item.conta) || item.linhaFora === 'Sócios de capital'
    base.push([
      item.ci, 'PAGAR', item.mesComp, item.motivoAjuste, item.mesPag, item.departamento, item.depTipo, item.conta, item.plano, item.grupoConta,
      item.grupo, item.subgrupo, item.camada.efetiva, item.dentro ? 'opex' : item.linhaFora, item.natureza, item.valor, item.pago, item.aberto, noRecorte(item.mesPag) ? item.pago : 0,
      omi ? '' : item.fornecedor, omi ? '' : item.descricao, item.flag, item.camada.motivo,
    ])
  }
  for (const r of receitas) {
    if (!noRecorte(r.mesComp) && !noRecorte(r.mesPag)) continue
    base.push([
      r.ci, 'RECEBER', r.mesComp, r.motivoAjuste, r.mesPag, r.departamento, r.depTipo, r.conta, r.plano, '',
      usados.has(r.ci) ? 'Exclusão de repasse' : r.reembolso ? 'Exclusão de reembolso' : 'Receita', '', '', r.reembolso || usados.has(r.ci) ? 'fora da receita' : 'receita', '',
      r.valor, r.pago, '', noRecorte(r.mesPag) ? r.pago : 0, '', r.descricao, r.textoRepasse ? 'texto_repasse' : '', '',
    ])
  }
  escrever(wb, '15_Base_lancamentos', [
    'ci_item', 'tipo', 'mes_competencia', 'ajuste', 'mes_pagamento', 'departamento', 'departamento_tipo', 'conta', 'plano', 'grupo_conta',
    'grupo_gerencial', 'subgrupo', 'camada', 'perimetro', 'natureza', 'valor_competencia', 'valor_pago', 'em_aberto', 'valor_caixa',
    'fornecedor', 'descricao', 'flag', 'motivo_camada',
  ], base, [16, 17, 18, 19])

  const valid = []
  const push = (nome, ok, detalhe) => valid.push([ok ? 'OK' : 'ALERTA', nome, detalhe])
  for (const mes of MESES) {
    const total = totalPagar(mes, 'competencia')
    const somaPartes = r2(opexS.get(mes) + fora.get(`${mes}|competencia`))
    push(`Competência ${mes}: OPEX + fora = PAGAR`, Math.abs(total - somaPartes) < 0.05, `total ${total} | partes ${somaPartes}`)
    const totalCx = totalPagar(mes, 'caixa')
    const partesCx = r2(opexC.get(mes) + fora.get(`${mes}|caixa`))
    push(`Caixa ${mes}: OPEX + fora = PAGAR`, Math.abs(totalCx - partesCx) < 0.05, `total ${totalCx} | partes ${partesCx}`)
  }
  for (const mes of MESES) {
    const gruposSoma = r2(itens.filter((i) => i.mesComp === mes).reduce((s, i) => s + valorGerencial(i), 0) + provisao13.get(mes) + provisaoFerias.get(mes))
    push(`Grupos ${mes} = OPEX gerencial`, Math.abs(gruposSoma - opexG.get(`${mes}|gerencial`)) < 0.05, `${gruposSoma}`)
    const l = liquida.get(mes)
    if (typeof l === 'number') {
      const calc = r2(bruta.get(mes) - exclReemb.get(mes) - exclRep.get(mes) - deducao.get(mes))
      push(`Receita ${mes}`, Math.abs(calc - l) < 0.05, `${l}`)
    } else push(`Receita ${mes}`, false, l)
  }
  const repPago = r2(pares.reduce((s, p) => s + p.item.valor, 0))
  const repEnt = r2(pares.filter((p) => p.match).reduce((s, p) => s + p.match.valor, 0))
  push('Conciliação de repasses', true, `pago ${repPago} | entrada vinculada ${repEnt} | sem entrada ${pares.filter((p) => !p.match).length}`)
  push('Headcount set/2026 = 59', head.get('2026-09').length === 59, String(head.get('2026-09').length))
  const semClasse = itens.filter((i) => i.dentro && i.grupo === 'Outros' && noRecorte(i.mesComp))
  const opexTotal = r2(MESES.reduce((s, m) => s + opexS.get(m), 0))
  const outros = r2(semClasse.reduce((s, i) => s + i.valor, 0))
  push('Contas sem classificação', semClasse.length === 0, `${new Set(semClasse.map((i) => i.conta)).size} contas`)
  push('Outros acima de 5% do OPEX', opexTotal === 0 || outros / opexTotal <= 0.05, `${r2((outros / (opexTotal || 1)) * 100)}%`)
  push('Meses sem headcount', MESES.every((m) => head.get(m).length > 0), '')
  push('Turnover em aberto sem cadastro ativo', true, `${ghosts.length} registros excluídos da série para não inflar o headcount`)
  const diffsMes = MESES.map((mes) => ({ mes, diff: r2(opexS.get(mes) - opexC.get(mes)) })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)
  for (const d of diffsMes) {
    const causas = itens
      .filter((i) => i.dentro && (i.mesComp === d.mes || i.mesPag === d.mes) && i.mesComp !== i.mesPag)
      .reduce((map, i) => {
        const k = i.conta
        map.set(k, r2((map.get(k) || 0) + (i.mesComp === d.mes ? i.valor : 0) - (i.mesPag === d.mes ? i.pago : 0)))
        return map
      }, new Map())
    const top = [...causas.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([c, v]) => `${c}: ${v}`).join(' | ')
    push(`Diferença competência x caixa ${d.mes}`, true, `diferença ${d.diff}. Maiores contas com mês de competência diferente do pagamento: ${top}`)
  }
  const diffGrupo = new Map()
  for (const item of itens) {
    if (!item.dentro) continue
    diffGrupo.set(item.grupo, r2((diffGrupo.get(item.grupo) || 0) + (noRecorte(item.mesComp) ? item.valor : 0) - (noRecorte(item.mesPag) ? item.pago : 0)))
  }
  for (const [g, v] of [...diffGrupo.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5)) {
    push(`Diferença por grupo ${g}`, true, `competência menos caixa no período: ${v}. O sinal positivo significa competência maior que o caixa.`)
  }
  const invalidos = itens.filter((i) => i.motivoAjuste === 'competencia_invalida_usou_vencimento')
  push('Competências inválidas', true, invalidos.length ? invalidos.map((i) => `${i.ci} → ${i.mesComp || 'sem vencimento'}`).join(', ') : 'nenhuma no recorte carregado')
  push('Pendência: mês do bônus de 2025', false, 'Pagamentos de jan–fev/2026 da conta 8.2.01 foram para dez/2025. O ano estava definido; o mês, não.')
  push('Pendência: base da provisão de 13º e férias', false, 'Método sugerido: 1/12 de associados + CLT do próprio mês. A visão sem provisão está na coluna ao lado.')
  push('Pendência: semivariável no equilíbrio', false, 'Entra como fixo até você definir.')
  push('DAS de ago/2026', deducaoStatus.get('2026-08') === 'ok', String(deducaoStatus.get('2026-08')))
  push('Pendência: outras receitas sem vínculo de repasse', false, `${receitas.filter((r) => norm(r.plano) === 'OUTRAS RECEITAS' && !usados.has(r.ci) && noRecorte(r.mesComp)).length} lançamentos permanecem na receita`)
  escrever(wb, '16_Validacao', ['status', 'teste', 'detalhe'], valid)

  await mkdir(path.dirname(OUT), { recursive: true })
  await wb.xlsx.writeFile(OUT)

  const sqlRegras = []
  const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replaceAll("'", "''")}'`)
  for (const p of PARAMETROS) sqlRegras.push(`insert into public.opex_v2_parametro (chave, valor, status, nota) values (${q(p[0])}, ${q(p[1])}, ${q(p[2])}, ${q(p[3])}) on conflict (chave) do update set valor = excluded.valor, status = excluded.status, nota = excluded.nota;`)
  for (const r of PERIMETRO) sqlRegras.push(`insert into public.opex_v2_perimetro (prioridade, tipo_regra, chave, descricao_contem, departamento_tipo, efeito, linha, status, nota) values (${r[0]}, ${q(r[1])}, ${q(r[2])}, ${q(r[3])}, ${q(r[4])}, ${q(r[5])}, ${q(r[6])}, ${q(r[7])}, ${q(r[8])});`)
  for (const c of CLASSIFICACAO) sqlRegras.push(`insert into public.opex_v2_classificacao (conta_prefixo, grupo_gerencial, subgrupo, natureza, controlabilidade, status) values (${q(c[0])}, ${q(c[1])}, ${q(c[2])}, ${q(c[3])}, ${q(c[4])}, 'sugerida') on conflict (conta_prefixo) do nothing;`)
  for (const d of DEPARTAMENTOS) sqlRegras.push(`insert into public.opex_v2_departamento (nome, tipo, area_meta, status, nota) values (${q(d[0])}, ${q(d[1])}, ${d[2]}, ${q(d[3])}, ${q(d[4])}) on conflict (nome) do update set tipo = excluded.tipo, status = excluded.status, nota = excluded.nota;`)
  for (const f of FORNECEDORES) sqlRegras.push(`insert into public.opex_v2_regra_fornecedor (fornecedor_contem, grupo_gerencial, subgrupo, natureza, controlabilidade, status, nota) values (${q(f[0])}, ${q(f[1])}, ${q(f[2])}, ${q(f[3])}, ${q(f[4])}, ${q(f[5])}, ${q(f[6])});`)
  for (const c of CAMADAS) sqlRegras.push(`insert into public.opex_v2_regra_camada (tipo_regra, chave, camada, status, nota) values (${q(c[0])}, ${q(c[1])}, ${q(c[2])}, ${q(c[3])}, ${q(c[4])});`)
  for (const c of catMap.values()) sqlRegras.push(`insert into public.opex_v2_categoria_cargo (cargo, area, categoria, peso_fte, status, nota) values (${q(c.cargo)}, ${q(c.area)}, ${q(c.categoria)}, ${c.peso}, 'premissa', ${q(c.regra)}) on conflict (cargo, area) do update set categoria = excluded.categoria, peso_fte = excluded.peso_fte, status = excluded.status, nota = excluded.nota;`)
  sqlRegras.push(`insert into public.opex_v2_versao (versao, nota) values (${q(VERSAO)}, 'Baseline jan/2025–ago/2026') on conflict (versao) do nothing;`)
  await writeFile('scripts/opex-v2/ajuste-premissas.sql', [
    "delete from public.opex_v2_parametro where chave = 'provisao_bonus_2026';",
    'drop table if exists public.opex_v2_eventos_futuros;',
    ...sqlRegras.filter((s) => s.includes('opex_v2_parametro') || s.includes('opex_v2_categoria_cargo') || s.includes('opex_v2_versao')),
    '',
  ].join('\n'))
  const migration = await readFile('supabase/migrations/20260923205142_opex_v2_baseline.sql', 'utf8')
  if (!migration.includes('opex_v2_parametro (chave')) {
    await writeFile('supabase/migrations/20260923205142_opex_v2_baseline.sql', `${migration}\n${sqlRegras.join('\n')}\n`)
  }

  const alertas = valid.filter((v) => v[0] === 'ALERTA').length
  console.log(JSON.stringify({
    arquivo: OUT,
    pagar: itens.length,
    receber: receitas.length,
    headcountSet: head.get('2026-09').length,
    ghosts: ghosts.length,
    runRate,
    realizado2026,
    outrosPct: opexTotal ? r2((outros / opexTotal) * 100) : 0,
    alertas,
    agoLiquida: liquida.get('2026-08'),
    ponteMax: Math.max(...ponte.map((p) => Math.abs(Number(p[14]) || 0))),
  }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
