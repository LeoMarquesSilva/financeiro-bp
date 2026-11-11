import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DL_ALIQUOTA_IMPOSTO_PCT,
  explicarDlGestoresResumo,
  explicarDlLinha,
  explicarDlResultado,
  formatarDlTotal,
  periodoDl,
  type DlFenixContexto,
} from '../src/features/dl/fenix/dlFenix.ts'
import {
  DL_DIAS_MES,
  DL_EFICIENCIA,
  DL_HORAS_DIA,
  calcularDemonstrativo,
  dlGestorPorArea,
  totalDemonstrativo,
} from '../src/features/dl/utils/dlCalc.ts'
import {
  explicarOpexMediaFixas,
  explicarOpexOrcamentoPeriodo,
  explicarOpexProjecao,
  explicarOpexProjecaoFixas,
  explicarOpexRealizado,
  explicarOpexVariacao,
  explicarOpexVsAnoAnterior,
  mesesNoKpiOpex,
  type OpexFenixContexto,
} from '../src/features/opex/fenix/opexFenix.ts'
import {
  explicarEscritorioProcessos,
  explicarEscritorioPublicacoes,
  explicarEscritorioTarefas,
  explicarEscritorioTimesheet,
  explicarRentabilidadeGrupo,
  explicarRentabilidadeHoraEfetiva,
  explicarRentabilidadeHoras,
  valorHora,
} from '../src/features/escritorio/fenix/escritorioFenix.ts'
import { formatCurrency, formatHorasDuracao, formatPercent } from '../src/shared/utils/format.ts'
import type { FenixExplicacao, FenixLinha } from '../src/shared/fenix/fenix.types.ts'
import type { DlGestor, DlGestorMes, DlMesRow } from '../src/features/dl/types/dl.types.ts'
import type { OpexKpis, OpexMesRow, OpexGrupoRow } from '../src/features/opex/types/opex.types.ts'
import type { LevantamentoFiltros, LevantamentoResumo } from '../src/features/escritorio/services/escritorioLevantamentoService.ts'
import type { RentabilidadeContratos } from '../src/features/escritorio/services/escritorioRentabilidadeService.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)

const parcelas = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const infos = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'info')
/** Soma com sinal: '−' subtrai; '+' ou sem operador soma. */
const somaComSinal = (linhas: FenixLinha[]) =>
  linhas.reduce((s, l) => s + (l.operador === '−' ? -(l.numero ?? 0) : (l.numero ?? 0)), 0)
const perto = (a: number, b: number, tol = 0.005) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`)
/** Campos `undefined` somem no JSON; o resto (inclusive números) tem de sobreviver igual. */
const semUndefined = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(semUndefined)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, semUndefined(x)]))
      : v
const serializavel = (e: FenixExplicacao) => assert.deepEqual(JSON.parse(JSON.stringify(e)), semUndefined(e))

// ---------------------------------------------------------------------------
// DL
// ---------------------------------------------------------------------------

const linha = (area_key: string, mes: number, over: Partial<DlMesRow> = {}): DlMesRow => ({
  area_key,
  mes,
  receita_bruta: 100_000.11,
  impostos: 10_000.37,
  desp_operacionais: 30_000.5,
  desp_controladoria: 5_000.25,
  desp_indiretas: 15_000.07,
  profissionais: 5,
  pct_controladoria: 12.5,
  parametro_herdado: false,
  socios_prolabore: 120_000,
  ...over,
})

const rows: DlMesRow[] = [
  linha('civel', 9),
  linha('civel', 10, { receita_bruta: 80_000, impostos: 9_000 }),
  linha('civel', 11, { parametro_herdado: true, profissionais: 6 }),
  linha('contratos', 9, { profissionais: 3, pct_controladoria: 20 }),
  linha('contratos', 10, { profissionais: 3, pct_controladoria: 20 }),
  linha('contratos', 11, { profissionais: 3, pct_controladoria: 20, desp_operacionais: 90_000 }),
]
const gestores: DlGestor[] = [
  { id: 'g1', ano: 2026, area_key: 'civel', nome: 'Gestor A', pct: 5, mes_inicio: 1, mes_fim: 12 },
  { id: 'g2', ano: 2026, area_key: 'contratos', nome: 'Gestor B', pct: 10, mes_inicio: 1, mes_fim: 12 },
]
const gestorMes: DlGestorMes[] = [
  { gestor_id: 'g1', mes: 9, clientes: 3, liquido_clientes: 50_000, resultado_clientes: 20_000, dl: 1_000.33 },
  { gestor_id: 'g1', mes: 10, clientes: 3, liquido_clientes: 50_000, resultado_clientes: 10_000, dl: 500.1 },
  { gestor_id: 'g1', mes: 11, clientes: 3, liquido_clientes: 50_000, resultado_clientes: -1_000, dl: 0 },
  { gestor_id: 'g2', mes: 9, clientes: 1, liquido_clientes: 9_000, resultado_clientes: 9_000, dl: 900 },
]
const meses = [9, 10, 11]
const dlGestor = dlGestorPorArea(gestores, gestorMes)
const civel = { key: 'civel', nome: 'Cível', departamento: 'Cível', referencia: 0.57 }
const ctxArea: DlFenixContexto = { ano: 2026, meses, area: civel, mesParcial: 11, rows, gestores }
const ctxGeral: DlFenixContexto = { ano: 2026, meses, areasNomes: ['Cível', 'Contratos'], mesParcial: 11, rows, gestores }
const demoArea = calcularDemonstrativo(rows, ['civel'], meses, dlGestor)
const totalArea = totalDemonstrativo(demoArea)
const demoGeral = calcularDemonstrativo(rows, ['civel', 'contratos'], meses, dlGestor)
const totalGeral = totalDemonstrativo(demoGeral)

test('DL: período e formato da coluna Total', () => {
  assert.equal(periodoDl(2026, [9, 10, 11]), 'Set–Nov/2026')
  assert.equal(periodoDl(2026, [3]), 'Mar/2026')
  assert.equal(formatarDlTotal('profissionais', 5.333), '5,3 (média)')
  assert.equal(formatarDlTotal('custo_hora', 0), '—')
})

test('DL › Receita bruta: meses somam o total da tabela e regras de honorários aparecem', () => {
  const exp = explicarDlLinha('receita_bruta', demoArea, totalArea, ctxArea)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 3)
  perto(somaComSinal(p), totalArea.receita_bruta)
  assert.equal(totais(exp.conta)[0]?.numero, totalArea.receita_bruta)
  assert.equal(exp.valor, formatCurrency(totalArea.receita_bruta))
  assert.equal(exp.tela, 'DL › Por área › Cível')
  assert.ok(exp.regras?.some((r) => r.includes('sucumbência') && r.includes('por hora trabalhada')))
  assert.ok(exp.regras?.some((r) => r.includes('data de pagamento')))
  assert.ok(exp.regras?.some((r) => r.includes('Nov/26') && r.includes('andamento')))
  assert.match(p[2]?.detalhe ?? '', /andamento/)
  serializavel(exp)
})

test('DL › Impostos: alíquota da planilha, só com nota fiscal, e % efetivo como info', () => {
  const exp = explicarDlLinha('impostos', demoArea, totalArea, ctxArea)
  perto(somaComSinal(parcelas(exp.conta)), totalArea.impostos)
  assert.ok(exp.regras?.some((r) => r.includes('16,0587%') && r.includes('nota fiscal')))
  const efetivo = infos(exp.conta).find((l) => l.rotulo.startsWith('Imposto ÷'))
  perto(efetivo?.numero ?? 0, (totalArea.impostos / totalArea.receita_bruta) * 100, 1e-9)
  assert.ok(DL_ALIQUOTA_IMPOSTO_PCT > 16 && DL_ALIQUOTA_IMPOSTO_PCT < 17)
})

test('DL › Receita líquida e Margem: cascata fecha com a tela', () => {
  const liq = explicarDlLinha('receita_liquida', demoGeral, totalGeral, ctxGeral)
  perto(somaComSinal(parcelas(liq.conta)), totalGeral.receita_liquida)
  assert.equal(totais(liq.conta)[0]?.numero, totalGeral.receita_liquida)
  assert.ok(liq.regras?.some((r) => r.includes('soma das 2 áreas')))

  const mg = explicarDlLinha('margem', demoGeral, totalGeral, ctxGeral)
  perto(somaComSinal(parcelas(mg.conta)), totalGeral.margem)
  const pct = infos(mg.conta).find((l) => l.rotulo === 'Margem %')
  assert.equal(pct?.valor, formatPercent(totalGeral.margem_pct * 100))
  assert.match(pct?.detalhe ?? '', /58,00%/)
})

test('DL › Margem %: margem ÷ receita líquida e referência da área', () => {
  const exp = explicarDlLinha('margem_pct', demoArea, totalArea, ctxArea)
  const [m, l] = parcelas(exp.conta)
  assert.equal(l?.operador, '÷')
  perto(((m?.numero ?? 0) / (l?.numero ?? 1)) * 100, totais(exp.conta)[0]?.numero ?? 0, 1e-9)
  assert.equal(exp.valor, formatPercent(totalArea.margem_pct * 100))
  assert.equal(infos(exp.conta)[0]?.valor, '57,00%')
})

test('DL › Resultado: cascata completa (bruta − impostos − despesas) e DL fora da conta', () => {
  const exp = explicarDlResultado(totalGeral, ctxGeral)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 5)
  perto(somaComSinal(p), totalGeral.resultado)
  assert.equal(exp.valor, formatCurrency(totalGeral.resultado))
  const dl = infos(exp.conta).find((l) => l.rotulo.startsWith('DL dos gestores'))
  assert.equal(dl?.numero, totalGeral.dl_gestor)
  assert.ok(exp.regras?.some((r) => r.includes('não é despesa da área')))
  // Pela linha do demonstrativo dá o mesmo.
  assert.deepEqual(explicarDlLinha('resultado', demoGeral, totalGeral, ctxGeral).conta, exp.conta)
})

test('DL › Controladoria e Indiretas: % e profissionais reais de cada mês no detalhe', () => {
  const ctrl = explicarDlLinha('desp_controladoria', demoArea, totalArea, ctxArea)
  const p = parcelas(ctrl.conta)
  perto(somaComSinal(p), totalArea.desp_controladoria)
  assert.match(p[0]?.detalhe ?? '', /12,5% das despesas de Operações Legais/)
  assert.match(p[2]?.detalhe ?? '', /herdados/)
  assert.ok(ctrl.regras?.some((r) => r.includes('Operações Legais') && r.includes('%')))

  const ctrlGeral = explicarDlLinha('desp_controladoria', demoGeral, totalGeral, ctxGeral)
  assert.match(parcelas(ctrlGeral.conta)[0]?.detalhe ?? '', /as áreas somam 32,5%/)

  const ind = explicarDlLinha('desp_indiretas', demoArea, totalArea, ctxArea)
  assert.match(parcelas(ind.conta)[0]?.detalhe ?? '', /5 de 8 profissionais/)
  assert.match(parcelas(ind.conta)[2]?.detalhe ?? '', /6 de 9 profissionais/)
  const pl = infos(ind.conta).find((l) => l.rotulo.startsWith('Pró-labore'))
  assert.equal(pl?.numero, 360_000)
  assert.ok(ind.regras?.some((r) => r.includes('Facilities') && r.includes('pró-labore')))
})

test('DL › DL Gestor: soma dos meses, gestor no detalhe, mês negativo zerado', () => {
  const exp = explicarDlLinha('dl_gestor', demoArea, totalArea, ctxArea)
  const p = parcelas(exp.conta)
  perto(somaComSinal(p), totalArea.dl_gestor)
  assert.match(p[0]?.detalhe ?? '', /Gestor A 5%/)
  assert.match(p[2]?.detalhe ?? '', /zero/)
  assert.ok(exp.regras?.some((r) => r.includes('negativo') && r.includes('zero')))
  assert.ok(exp.regras?.some((r) => r.includes('não é despesa da área')))
})

test('DL › Profissionais: média = soma ÷ meses com profissionais', () => {
  const exp = explicarDlLinha('profissionais', demoArea, totalArea, ctxArea)
  const soma = infos(exp.conta).find((l) => l.rotulo === 'Soma dos meses')?.numero ?? 0
  const n = (exp.conta ?? []).find((l) => l.operador === '÷')?.numero ?? 1
  perto(soma / n, totais(exp.conta)[0]?.numero ?? 0, 1e-9)
  assert.equal(totalArea.profissionais, 16 / 3)
  assert.equal(exp.valor, '5,3 (média)')
})

test('DL › Custo hora: custo ÷ horas com as premissas de dlCalc', () => {
  const exp = explicarDlLinha('custo_hora', demoArea, totalArea, ctxArea)
  const [custo, horas] = parcelas(exp.conta)
  perto(horas?.numero ?? 0, DL_HORAS_DIA * DL_DIAS_MES * 16 * DL_EFICIENCIA, 1e-9)
  perto((custo?.numero ?? 0) / (horas?.numero ?? 1), totalArea.custo_hora, 1e-9)
  assert.equal(totais(exp.conta)[0]?.valor, formatCurrency(totalArea.custo_hora))
  assert.ok(exp.regras?.some((r) => r.includes(`${DL_HORAS_DIA} h`) && r.includes(`${DL_DIAS_MES} dias`) && r.includes('80%')))
})

test('DL › Card DL Gestores: áreas somam o total, com os gestores de cada uma', () => {
  const porArea = [
    { area: civel, dl: totalArea.dl_gestor },
    {
      area: { key: 'contratos', nome: 'Contratos', departamento: 'Contratos', referencia: 0.8 },
      dl: totalDemonstrativo(calcularDemonstrativo(rows, ['contratos'], meses, dlGestor)).dl_gestor,
    },
  ]
  const exp = explicarDlGestoresResumo(porArea, totalGeral.dl_gestor, ctxGeral)
  perto(somaComSinal(parcelas(exp.conta)), totalGeral.dl_gestor)
  assert.match(parcelas(exp.conta)[1]?.detalhe ?? '', /Gestor B 10%/)
  serializavel(exp)
})

// ---------------------------------------------------------------------------
// OPEX
// ---------------------------------------------------------------------------

const evolucao: OpexMesRow[] = Array.from({ length: 12 }, (_, i) => {
  const mes = i + 1
  return {
    mes,
    mesLabel: String(mes),
    previsto: 100_000 + mes,
    previsto_vios: 90_000,
    realizado: mes <= 11 ? 95_000.15 + mes : 0,
    projetado_fixas: mes <= 11 ? 60_000 + mes * 10 : 61_000,
    variacao: 0,
  }
})
const ytd = (campo: 'realizado' | 'previsto' | 'previsto_vios', ate = 11) =>
  Math.round(evolucao.filter((e) => e.mes <= ate).reduce((s, e) => s + e[campo], 0) * 100) / 100
const kpis: OpexKpis = {
  realizado_ytd: ytd('realizado'),
  previsto_ytd: ytd('previsto'),
  previsto_vios_ytd: ytd('previsto_vios'),
  previsto_ano: ytd('previsto', 12),
  previsto_vios_ano: ytd('previsto_vios', 12),
  projetado_ano: Math.round((ytd('realizado') + evolucao[11]!.previsto) * 100) / 100,
  media_mensal_fixas: 60_060,
  variancia_ytd_pct: 0,
}
kpis.variancia_ytd_pct = Math.round(((kpis.realizado_ytd - kpis.previsto_ytd) / kpis.previsto_ytd) * 1000) / 10
const ctxOpex: OpexFenixContexto = {
  ano: 2026,
  mesAtual: 11,
  mesesFiltro: [],
  periodo: 'jan–nov / 2026',
  orcamentoImportado: true,
  evolucao,
  planoFiltro: { gruposExcluidos: [], planosExcluidos: [] },
  hoje: HOJE,
}

test('OPEX: meses do card seguem opex_mes_no_kpi', () => {
  assert.deepEqual(mesesNoKpiOpex({ mesesFiltro: [], mesAtual: 3 }), [1, 2, 3])
  assert.equal(mesesNoKpiOpex({ mesesFiltro: [], mesAtual: 0 }).length, 12)
  assert.deepEqual(mesesNoKpiOpex({ mesesFiltro: [7, 2], mesAtual: 11 }), [2, 7])
})

test('OPEX › Realizado: meses somam o card, mês em andamento e folha avisados', () => {
  const exp = explicarOpexRealizado(kpis, ctxOpex)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 11)
  perto(somaComSinal(p), kpis.realizado_ytd)
  assert.equal(exp.valor, formatCurrency(kpis.realizado_ytd))
  assert.match(p[10]?.detalhe ?? '', /andamento/)
  assert.ok(exp.regras?.some((r) => r.includes('distribuição de lucros')))
  assert.ok(exp.regras?.some((r) => r.includes('folha')))
  serializavel(exp)
})

test('OPEX › Orçamento no período: soma mensal e Previsto VIOS como info', () => {
  const exp = explicarOpexOrcamentoPeriodo(kpis, ctxOpex)
  perto(somaComSinal(parcelas(exp.conta)), kpis.previsto_ytd)
  assert.equal(infos(exp.conta).find((l) => l.rotulo.startsWith('Previsto VIOS'))?.numero, kpis.previsto_vios_ytd)
  assert.ok(exp.regras?.some((r) => r.includes('congelada')))
})

test('OPEX › Projeção até dez: realizado até o mês atual + orçamento dos seguintes', () => {
  const exp = explicarOpexProjecao(kpis, ctxOpex)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 2)
  assert.equal(p[0]?.rotulo, 'Realizado Jan–Nov/2026')
  assert.equal(p[1]?.rotulo, 'Orçamento Dez/26')
  perto(somaComSinal(p), kpis.projetado_ano)
  assert.ok(exp.regras?.some((r) => r.includes('Nov/26') && r.includes('não aparece')))
})

test('OPEX › Variação: (realizado − orçamento) ÷ orçamento, com aviso do arredondamento', () => {
  const exp = explicarOpexVariacao(kpis, ctxOpex)
  assert.equal(totais(exp.conta)[0]?.numero, kpis.variancia_ytd_pct)
  assert.equal(exp.valor, formatPercent(Math.abs(kpis.variancia_ytd_pct)))
  assert.match(exp.resumo, /abaixo do orçamento/)
  // -4,9996% arredonda para -5,0 e aparece igual: sem nota.
  assert.equal(infos(exp.conta).some((l) => l.rotulo === 'Conta sem arredondar'), false)

  // 1.000 ÷ 1.030: -2,9126% vira -2,9% no banco; a nota mostra a conta exata.
  const k2: OpexKpis = { ...kpis, realizado_ytd: 1_000, previsto_ytd: 1_030, variancia_ytd_pct: -2.9 }
  const exp2 = explicarOpexVariacao(k2, ctxOpex)
  const nota = infos(exp2.conta).find((l) => l.rotulo === 'Conta sem arredondar')
  perto(nota?.numero ?? 0, (-30 / 1_030) * 100, 1e-9)
  assert.equal(exp2.valor, '2,90%')
  const sem = explicarOpexVariacao({ ...kpis, previsto_ytd: 0, variancia_ytd_pct: 0 }, ctxOpex)
  assert.match(sem.resumo, /Sem orçamento/)
})

test('OPEX › Vs. ano anterior: conta fecha, aviso de 2025 e do mês em andamento; sem base vira —', () => {
  const anterior = 900_000
  const yoy = ((kpis.realizado_ytd - anterior) / anterior) * 100
  const exp = explicarOpexVsAnoAnterior({ ctx: ctxOpex, atual: kpis.realizado_ytd, anterior, yoy, periodoAnterior: 'jan–nov / 2025' })
  assert.equal(totais(exp.conta)[0]?.numero, yoy)
  assert.ok(exp.regras?.some((r) => r.includes('2025') && r.includes('folha')))
  assert.ok(exp.regras?.some((r) => r.includes('Nov/26') && r.includes('completo')))
  const semBase = explicarOpexVsAnoAnterior({ ctx: ctxOpex, atual: kpis.realizado_ytd, anterior: 0, yoy: null, periodoAnterior: 'jan–nov / 2025' })
  assert.equal(semBase.valor, '—')
  assert.equal(totais(semBase.conta).length, 0)
})

test('OPEX › Projeção de fixas: grupos somam o total e cada grupo abre pago + previsto + extrapolação', () => {
  const grupo = (grupo_conta: string, ytdG: number, restante: number): OpexGrupoRow => ({
    grupo_conta,
    fixo: true,
    realizado_ytd: ytdG,
    previsto_ano: 0,
    previsto_vios: 0,
    previsto_vios_futuro: 0,
    previsto_restante: restante,
    projetado_ano: Math.round((ytdG + restante + (ytdG / 11) * 1) * 100) / 100,
  })
  const fixas = [grupo('REMUNERAÇÃO FIXA', 1_100_000, 100_000), grupo('ALUGUÉIS', 220_000.5, 20_000)]
  const total = fixas.reduce((s, g) => s + g.projetado_ano, 0)
  const exp = explicarOpexProjecaoFixas({ ctx: ctxOpex, fixas, total })
  perto(somaComSinal(parcelas(exp.conta)), total)
  assert.match(parcelas(exp.conta)[0]?.detalhe ?? '', /extrapolação R\$\s100\.000,00/)
  assert.ok(exp.regras?.some((r) => r.includes('11 meses decorridos') && r.includes('1 meses restantes')))

  const media = explicarOpexMediaFixas({ ctx: ctxOpex, media: kpis.media_mensal_fixas })
  const soma = infos(media.conta).find((l) => l.rotulo === 'Soma')?.numero ?? 0
  perto(soma / 11, kpis.media_mensal_fixas)
  assert.ok(media.regras?.some((r) => r.includes('Nov/26')))
})

// ---------------------------------------------------------------------------
// Escritório
// ---------------------------------------------------------------------------

const filtros: LevantamentoFiltros = { dataInicio: '2026-01-01', dataFim: '2026-11-30', grupos: [], area: 'Reestruturação' }
const resumo: LevantamentoResumo = {
  publicacoes_total: 12_345,
  timesheet_apontamentos: 8_000,
  timesheet_horas: 9_876 + 25 / 60,
  processos_total: 1_000,
  processos_por_situacao: [],
  processos_por_tipo: [
    { tipo: 'Principal', qtd: 800 },
    { tipo: 'Recurso', qtd: 150 },
    { tipo: 'Incidente', qtd: 40 },
    { tipo: '', qtd: 10 },
  ],
  processos_por_departamento: [],
  agendamento_total: 0,
  agendamento_por_tipo: [],
  tarefas_total: 700,
  tarefas_prazos: 500,
  tarefas_providencias: 150,
  timesheet_data_max: '2026-11-07',
  data_inicio: '2026-01-01',
  data_fim: '2026-11-30',
  grupos: [],
  area: 'Reestruturação',
}

test('Escritório › Levantamento: processos por tipo somam o total; tarefas e timesheet fecham', () => {
  const proc = explicarEscritorioProcessos(resumo, filtros)
  perto(somaComSinal(parcelas(proc.conta)), resumo.processos_total)
  assert.equal(parcelas(proc.conta)[3]?.rotulo, 'Sem classificação')
  assert.ok(proc.regras?.some((r) => r.includes('Ativo')))
  assert.ok(proc.regras?.some((r) => r.includes('Insolvência')))

  const tar = explicarEscritorioTarefas(resumo, filtros)
  perto(somaComSinal(parcelas(tar.conta)), 650)
  assert.equal(infos(tar.conta)[0]?.numero, 50)
  assert.equal(tar.valor, '500 prazos · 150 providências')
  assert.ok(tar.regras?.some((r) => r.includes('ENVIAR')))

  const ts = explicarEscritorioTimesheet(resumo, filtros)
  const minutos = parcelas(ts.conta)[0]?.numero ?? 0
  perto(minutos / 60, resumo.timesheet_horas, 1e-9)
  assert.equal(ts.valor, formatHorasDuracao(resumo.timesheet_horas))
  assert.ok(ts.regras?.some((r) => r.includes('07/11/2026')))

  const pub = explicarEscritorioPublicacoes(resumo, filtros)
  assert.equal(pub.valor, '12.345')
  assert.ok(pub.regras?.some((r) => r.includes('Criado')))
  serializavel(pub)
})

const rent: RentabilidadeContratos = {
  horas_minutos: 60_030,
  recebido_escritorio: 1_500_000,
  previsto_escritorio: 1_800_000,
  valor_hora_efetivo_escritorio: Math.round((1_500_000 / (60_030 / 60)) * 100) / 100,
  valor_hora_previsto_escritorio: Math.round((1_800_000 / (60_030 / 60)) * 100) / 100,
  linhas: [
    {
      cliente: 'Grupo X',
      razoes_sociais: ['X SA', 'X Ltda'],
      recebido_periodo: 300_000,
      previsto_periodo: 320_000,
      horas_minutos: 6_000,
      valor_hora_efetivo: 3_000,
      valor_hora_previsto: 3_200,
    },
  ],
  data_inicio: '2026-01-01',
  data_fim: '2026-10-31',
  area: null,
}

test('Escritório › Rentabilidade: recebido ÷ horas = valor da hora, e grupo comparado com a média', () => {
  const f: LevantamentoFiltros = { ...filtros, dataFim: '2026-10-31', area: null }
  const horas = explicarRentabilidadeHoras(rent, f)
  assert.equal(horas.valor, '1000:30')

  const ef = explicarRentabilidadeHoraEfetiva(rent, f)
  const [rec, h] = parcelas(ef.conta)
  perto(Math.round(((rec?.numero ?? 0) / (h?.numero ?? 1)) * 100) / 100, rent.valor_hora_efetivo_escritorio ?? 0)
  assert.equal(ef.valor, valorHora(rent.valor_hora_efetivo_escritorio))
  assert.match(ef.valor, /^R\$ [\d.]+,\d{2}\/h$/)
  assert.ok(ef.regras?.some((r) => r.includes('mês anterior')))

  const g = explicarRentabilidadeGrupo(rent.linhas[0]!, rent, f, 1)
  assert.equal(g.titulo, 'Grupo X (1º)')
  assert.match(infos(g.conta)[0]?.detalhe ?? '', /^\+R\$ .*\/h vs média$/)
  assert.ok(g.filtros?.some((x) => x.rotulo === 'Razões sociais' && x.valor === '2'))
  serializavel(g)
})
