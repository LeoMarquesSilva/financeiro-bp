import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarIndicadorEfetividade,
  explicarIndicadorValorD1,
  explicarIndicadorVencidos,
  explicarPainelAguardando,
  explicarPainelCobrados,
  explicarPainelValorPendente,
  explicarPontualAcima60,
  explicarPontualDepartamentos,
  explicarPontualFaixa31a60,
  explicarPontualGrupos,
  explicarPontualValorEmAberto,
  filtrosPontualPagina,
  type CobrancaIndicadoresKpi,
  type CobrancaPainelFenixFiltros,
  type PontualFenixContexto,
} from '../src/features/cobranca/fenix/cobrancaFenix.ts'
import {
  explicarJudicializadaLancamentoVios,
  explicarJudicializadaProcessos,
  explicarJudicializadaValorCausa,
  explicarJudicializadaValorCorrigido,
} from '../src/features/inadimplencia-judicializada/fenix/judicializadaFenix.ts'
import {
  TELA_COMITE,
  explicarClasse,
  explicarRecorrenteClientes,
  explicarRecuperacaoComite,
  explicarRecuperacaoMes,
  explicarSaldoAcumulado,
  explicarSaldoCresceram,
  explicarSaldoEstoqueAnterior,
  explicarTempoMedioRecuperacao,
  explicarTotalEmAbertoCarteiras,
  explicarTotalEmAbertoOperacional,
} from '../src/features/inadimplencia/fenix/inadimplenciaFenix.ts'
import type { FenixExplicacao, FenixLinha } from '../src/shared/fenix/fenix.types.ts'
import type { CobrancaSeguimentoGrupo } from '../src/features/cobranca/types/cobrancaSeguimento.types.ts'
import type { InadimplenciaJudicializadaRow } from '../src/features/inadimplencia-judicializada/types/judicializada.types.ts'
import type { DashboardData } from '../src/features/inadimplencia/services/dashboardService.ts'
import type { ClienteSaldoDevedor, EvolucaoSaldoDevedorData } from '../src/features/inadimplencia/utils/saldoDevedor.ts'

const HOJE = new Date(2026, 10, 11)

const parcelas = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const soma = (linhas: FenixLinha[]) => linhas.reduce((s, l) => s + (l.numero ?? 0), 0)
const cent = (v: number) => Math.round(v * 100)
/** Garante que o objeto é serializável (vira o contexto da IA): nada de NaN, Infinity ou funções. */
const serializavel = (e: FenixExplicacao) => {
  const j = JSON.parse(JSON.stringify(e)) as FenixExplicacao
  assert.equal(j.valor, e.valor)
  assert.deepEqual(j.regras, e.regras)
  assert.deepEqual(
    j.conta?.map((l) => [l.rotulo, l.valor, l.numero ?? null]),
    e.conta?.map((l) => [l.rotulo, l.valor, l.numero ?? null]),
  )
}

// ---------------------------------------------------------------------------
// Cobrança › Painel
// ---------------------------------------------------------------------------

const filtrosPainel: CobrancaPainelFenixFiltros = {
  busca: '',
  incluirConcluidos: false,
  rotinaVencidosOntem: true,
  mes: null,
  ano: null,
  planoContas: null,
  statusCobranca: null,
  faixaAtraso: null,
}

test('Painel: valor pendente fecha com o card e mostra a fila D+1 de hoje', () => {
  const exp = explicarPainelValorPendente({
    resumo: { totalValor: 12_345.67, qtd: 7, comWhatsapp: 0 },
    filtros: filtrosPainel,
    hoje: HOJE,
  })
  assert.equal(exp.valor, 'R$ 12.345,67')
  assert.equal(totais(exp.conta)[0]?.numero, 12_345.67)
  assert.ok(exp.filtros?.some((f) => f.valor.includes('11/11/2026')))
  assert.ok(exp.regras?.some((r) => r.includes('Servidor Público') && r.includes('Bandeira')))
  assert.ok(exp.regras?.some((r) => r.includes('Outras Receitas')))
  serializavel(exp)
})

test('Painel: cobrados avisa que fica 0/N com concluídos escondidos; aguardando = títulos − cobrados', () => {
  const cobrados = explicarPainelCobrados({ resumo: { totalValor: 1, qtd: 9, comWhatsapp: 0 }, filtros: filtrosPainel, hoje: HOJE })
  assert.equal(cobrados.valor, '0/9')
  assert.ok(cobrados.regras?.[0]?.includes('0/N'))

  const comConcluidos = { ...filtrosPainel, incluirConcluidos: true, rotinaVencidosOntem: false, ano: 2026, mes: 10 }
  const aguardando = explicarPainelAguardando({ resumo: { totalValor: 1, qtd: 9, comWhatsapp: 4 }, filtros: comConcluidos, hoje: HOJE })
  assert.equal(aguardando.valor, '5')
  const [titulos, com, total] = aguardando.conta ?? []
  assert.equal((titulos?.numero ?? 0) - (com?.numero ?? 0), total?.numero)
  assert.equal(com?.operador, '−')
  assert.ok(aguardando.filtros?.some((f) => f.rotulo === 'Vencimento' && f.valor === 'Out/2026'))
})

// ---------------------------------------------------------------------------
// Cobrança › Indicadores
// ---------------------------------------------------------------------------

const kpi: CobrancaIndicadoresKpi = {
  titulos_vencidos: 40,
  titulos_cobrados: 30,
  titulos_fora_prazo: 6,
  titulos_sem_cobranca: 4,
  com_whatsapp: 36,
  valor_vencido: 100_000.1,
  valor_cobrado: 70_000.05,
  valor_fora_prazo: 20_000.03,
  valor_sem_cobranca: 10_000.02,
  efetividade_pct: 75,
}
const filtrosInd = { ano: null, mes: null, planos: [], grupos: [], status: null, faixa: null }

test('Indicadores: efetividade = no D+1 ÷ vencidos × 100, regras do D+1 e da base', () => {
  const exp = explicarIndicadorEfetividade({ kpi, filtros: filtrosInd })
  assert.equal(exp.valor, '75,00%')
  const [num, den, res] = exp.conta ?? []
  assert.equal(den?.operador, '÷')
  assert.equal(((num?.numero ?? 0) / (den?.numero ?? 1)) * 100, res?.numero)
  assert.ok(exp.regras?.some((r) => r.includes('01/05/2026')))
  assert.ok(exp.regras?.some((r) => r.includes('Título pago sai da base')))
  serializavel(exp)
})

test('Indicadores: sem títulos no filtro o indicador é 100%', () => {
  const vazio = { ...kpi, titulos_vencidos: 0, titulos_cobrados: 0, titulos_fora_prazo: 0, titulos_sem_cobranca: 0, efetividade_pct: 100 }
  const exp = explicarIndicadorEfetividade({ kpi: vazio, filtros: filtrosInd })
  assert.equal(totais(exp.conta)[0]?.numero, 100)
})

test('Indicadores: categorias somam os títulos vencidos e os valores somam o valor vencido', () => {
  const venc = explicarIndicadorVencidos({ kpi, filtros: filtrosInd })
  assert.equal(soma(parcelas(venc.conta)), kpi.titulos_vencidos)

  const valor = explicarIndicadorValorD1({ kpi, filtros: filtrosInd })
  assert.equal(cent(soma(parcelas(valor.conta))), cent(kpi.valor_vencido))
  assert.equal(totais(valor.conta)[0]?.numero, kpi.valor_vencido)
})

// ---------------------------------------------------------------------------
// Inadimplência Pontual
// ---------------------------------------------------------------------------

function grupo(nome: string, valor: number, maxDias: number, media = maxDias): CobrancaSeguimentoGrupo {
  return {
    grupo_chave: nome,
    qtd_titulos: 2,
    valor_total: valor,
    max_dias_atraso: maxDias,
    media_dias_atraso: media,
    qtd_razoes: 1,
    cobranca_d1_realizada: true,
    ultima_cobranca_d1_at: null,
    ultima_cobranca_d1_canal: null,
    ultima_acao_seguimento_at: null,
    ultima_acao_seguimento_tipo: null,
    proximo_follow_up: null,
    departamentos: [],
  }
}

const gruposPontual = Array.from({ length: 10 }, (_, i) => grupo(`Grupo ${i + 1}`, 1000.1 * (i + 1), i < 6 ? 20 : 45))
const ctxPontual: PontualFenixContexto = {
  tela: 'Inadimplência Pontual',
  grupos: gruposPontual,
  filtros: filtrosPontualPagina({ busca: '', faixa: 'todos', statusD1: 'todos', comite: 'fora_comite' }),
  comite: 'fora_comite',
}

test('Pontual: valor em aberto lista os maiores grupos + demais e fecha com o card', () => {
  const total = gruposPontual.reduce((s, g) => s + g.valor_total, 0)
  const exp = explicarPontualValorEmAberto(ctxPontual, total)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 9) // 8 maiores + "Demais 2 grupos"
  assert.equal(p[8]?.rotulo, 'Demais 2 grupos')
  assert.equal(cent(soma(p)), cent(total))
  assert.ok(exp.regras?.some((r) => r.includes('1 a 60 dias')))
  assert.ok(exp.regras?.some((r) => r.includes('sem card ativo no Comitê')))
  serializavel(exp)
})

test('Pontual: faixa 31–60 soma só grupos com título mais atrasado acima de 30 dias', () => {
  const faixa = gruposPontual.filter((g) => g.max_dias_atraso > 30).reduce((s, g) => s + g.valor_total, 0)
  const exp = explicarPontualFaixa31a60(ctxPontual, faixa, 30)
  assert.equal(cent(soma(parcelas(exp.conta))), cent(faixa))
  assert.equal(parcelas(exp.conta).length, 4)
  assert.ok(exp.regras?.some((r) => r.includes('grupo inteiro entra na faixa')))

  const grupos = explicarPontualGrupos(ctxPontual, 10)
  assert.deepEqual(parcelas(grupos.conta).map((l) => l.numero), [6, 4])
})

test('Pontual: pizza por departamento avisa quando difere do valor em aberto', () => {
  const slices = [
    { departamento: 'Cível', valor: 600, pct: 60 },
    { departamento: 'Trabalhista', valor: 400, pct: 40 },
  ]
  const exp = explicarPontualDepartamentos(ctxPontual, slices, 1_050)
  assert.equal(soma(parcelas(exp.conta)), 1_000)
  assert.ok((exp.conta ?? []).some((l) => l.tipo === 'info' && l.numero === 1_050))
})

test('Pontual: aviso acima de 60 dias fecha com o valor e conta os títulos', () => {
  const exp = explicarPontualAcima60({
    grupos: [
      { grupo_chave: 'Alfa', qtd_titulos: 3, valor_total: 300, max_dias_atraso: 90, qtd_razoes: 1, pessoa_id_principal: null, titulos: [] },
      { grupo_chave: 'Beta', qtd_titulos: 1, valor_total: 50.5, max_dias_atraso: 70, qtd_razoes: 1, pessoa_id_principal: null, titulos: [] },
    ],
    valorTotal: 350.5,
    qtdTitulos: 4,
  })
  assert.equal(soma(parcelas(exp.conta)), 350.5)
  assert.match(exp.resumo, /2 grupos têm/)
})

// ---------------------------------------------------------------------------
// Inadimplência Judicializada
// ---------------------------------------------------------------------------

function caso(p: Partial<InadimplenciaJudicializadaRow> & { id: string; grupo: string }): InadimplenciaJudicializadaRow {
  return {
    grupo_cliente: p.grupo,
    grupo_chave: p.grupo.toUpperCase(),
    processo_id: `proc-${p.id}`,
    valor_em_aberto_auto: 0,
    valor_em_aberto_ajuste: null,
    valor_em_aberto_nominal: 0,
    valor_em_aberto: 0,
    valor_correcao_inpc: 0,
    valor_juros_mora: 0,
    meses_atualizacao: 0,
    data_judicializacao: null,
    encerrado_at: null,
    nro_cnj: null,
    area: null,
    valor_causa: null,
    ...p,
  } as InadimplenciaJudicializadaRow
}

const casos = [
  caso({ id: '1', grupo: 'Alfa', valor_em_aberto_auto: 1_000, valor_em_aberto_nominal: 1_000, valor_correcao_inpc: 50.01, valor_juros_mora: 100, valor_em_aberto: 1_150.01, meses_atualizacao: 10, data_judicializacao: '2026-01-15', valor_causa: 900 }),
  caso({ id: '2', grupo: 'Alfa', valor_em_aberto_auto: 1_000, valor_em_aberto_nominal: 1_000, valor_correcao_inpc: 50.01, valor_juros_mora: 100, valor_em_aberto: 1_150.02, meses_atualizacao: 10, data_judicializacao: '2026-01-15' }),
  caso({ id: '3', grupo: 'Beta', valor_em_aberto_auto: 500, valor_em_aberto_ajuste: 800, valor_em_aberto_nominal: 800, valor_em_aberto: 800, valor_causa: 800 }),
  caso({ id: '4', grupo: 'Gama', valor_em_aberto_auto: 999, valor_em_aberto_nominal: 999, valor_em_aberto: 999, encerrado_at: '2026-10-01T00:00:00Z', valor_causa: 999 }),
]

test('Judicializada: valor corrigido = nominal + INPC + juros dos ativos, com nota de centavos', () => {
  const total = 1_150.01 + 1_150.02 + 800
  const exp = explicarJudicializadaValorCorrigido({ tela: 'Inadimplência Judicializada', rows: casos, total })
  const p = parcelas(exp.conta)
  assert.deepEqual(p.map((l) => cent(l.numero ?? 0)), [280_000, 10_002, 20_000])
  const nota = (exp.conta ?? []).find((l) => l.rotulo === 'Arredondamento de centavos')
  assert.equal(cent(soma(p) + (nota?.numero ?? 0)), cent(total))
  assert.ok(exp.regras?.some((r) => r.includes('Alfa (2 processos)')))
  assert.ok(exp.regras?.some((r) => r.includes('INPC') && r.includes('composta')))
  serializavel(exp)
})

test('Judicializada: ajuizamento ignora encerrados e casos sem valor da causa; lançamento soma o auto', () => {
  const causa = explicarJudicializadaValorCausa({ tela: 'X', rows: casos, total: 1_700 })
  assert.equal(soma(parcelas(causa.conta)), 1_700)
  assert.ok((causa.conta ?? []).some((l) => l.rotulo === 'Processos sem valor da causa' && l.numero === 1))

  const vios = explicarJudicializadaLancamentoVios({ tela: 'X', rows: casos, total: 2_500 })
  assert.equal(soma(parcelas(vios.conta)), 2_500)

  const proc = explicarJudicializadaProcessos({ tela: 'X', rows: casos, qtdProcessos: 3, qtdGrupos: 2 })
  assert.equal(soma(parcelas(proc.conta)), 3)
})

// ---------------------------------------------------------------------------
// Comitê Inadimplência e Painel de Inadimplência
// ---------------------------------------------------------------------------

function dashboard(): DashboardData {
  const recorrente = { valorEmAberto: 600_000, qtdClientes: 12, classeA: 100_000, classeB: 200_000, classeC: 300_000 }
  const pontual = {
    valorEmAberto: 150_000.5,
    qtdGrupos: 5,
    valorFaixa1_30: 100_000.5,
    valorFaixa31_60: 50_000,
    mediaDiasAtraso: 22,
    classeA: 100_000.5,
    classeB: 50_000,
    grupos: [],
  }
  const judicializada = { valorEmAberto: 80_000, totalValorCausa: 0, totalLancamentoVios: 0, qtdProcessos: 0, qtdGrupos: 0, porArea: [], rows: [] }
  const recuperadoMes = 30_000 + 19_999.5
  const operacional = recorrente.valorEmAberto + pontual.valorEmAberto
  const recuperadoComite = 40_000 + 60_000
  return {
    totais: {
      totalEmAberto: operacional + judicializada.valorEmAberto,
      totalEmAbertoOperacional: operacional,
      totalClasseA: recorrente.classeA + pontual.classeA,
      totalClasseB: recorrente.classeB + pontual.classeB,
      totalClasseC: recorrente.classeC,
      comiteClasseA: recorrente.classeA,
      comiteClasseB: recorrente.classeB,
      comiteClasseC: recorrente.classeC,
      pontualClasseA: pontual.classeA,
      pontualClasseB: pontual.classeB,
      totalRecuperadoMes: recuperadoMes,
      percentualRecuperacao: (recuperadoMes / (operacional + recuperadoMes)) * 100,
    },
    carteiras: { pontual, recorrente, judicializada },
    taxaRecuperacaoComite: {
      totalRecuperadoDesdeComite: recuperadoComite,
      valorTotalEmAbertoInicioComite: 700_000 + recuperadoComite,
      percentualRecuperacaoComite: (recuperadoComite / (700_000 + recuperadoComite)) * 100,
      recuperadoPorGestor: [],
      recuperadoPorArea: [],
      recuperadoManual: 40_000,
      recuperadoVios: 60_000,
      emAbertoAtual: 700_000,
      qtdClientes: 20,
      qtdResolvidos: 8,
    },
    rankingGestores: [],
    rankingAreas: [],
    valorEmAbertoPorGestor: [],
    valorEmAbertoPorArea: [],
    tempoMedioRecuperacaoDias: 46,
    tempoMedioRecuperacaoBase: { qtd: 8, somaDias: 365 },
    recuperacaoMes: { manual: 30_000, vios: 19_999.5, ano: 2026, mes: 11 },
    followUpAlerts: { vencidos: 0, aVencerEm7Dias: 0 },
  }
}

test('Comitê: total em aberto = Recorrente + Pontual; Judicializada só como informação', () => {
  const d = dashboard()
  const exp = explicarTotalEmAbertoOperacional(d)
  assert.equal(exp.tela, TELA_COMITE)
  assert.equal(soma(parcelas(exp.conta)), d.totais.totalEmAbertoOperacional)
  assert.ok((exp.conta ?? []).some((l) => l.tipo === 'info' && l.numero === 80_000))
  assert.ok(exp.regras?.some((r) => r.includes('não mudam com os filtros')))

  const tres = explicarTotalEmAbertoCarteiras(d)
  assert.equal(soma(parcelas(tres.conta)), d.totais.totalEmAberto)
  serializavel(exp)
})

test('Comitê: Classe A = grau A do Comitê + Pontual até 30 dias; Classe C só Comitê', () => {
  const d = dashboard()
  const a = explicarClasse(d, 'A')
  assert.equal(soma(parcelas(a.conta)), d.totais.totalClasseA)
  assert.ok(a.regras?.some((r) => r.includes('bom pagador')))
  const c = explicarClasse(d, 'C')
  assert.equal(parcelas(c.conta).length, 1)
  assert.equal(totais(c.conta)[0]?.numero, d.totais.totalClasseC)
})

test('Recuperação do Comitê: recuperado ÷ (em aberto hoje + recuperado) × 100', () => {
  const d = dashboard()
  const exp = explicarRecuperacaoComite(d)
  const t = totais(exp.conta)
  const [inicio, recuperado, percentual] = t
  assert.equal(inicio?.numero, d.taxaRecuperacaoComite.valorTotalEmAbertoInicioComite)
  assert.equal(recuperado?.numero, 40_000 + 60_000)
  assert.equal(((recuperado?.numero ?? 0) / (inicio?.numero ?? 1)) * 100, percentual?.numero)
  assert.equal(exp.valor, '12,50%')
  assert.ok(exp.regras?.some((r) => r.includes('05/02/2026')))
  assert.ok(exp.regras?.some((r) => r.includes('inclusive os resolvidos')))
})

test('Recuperação do mês: manual + VIOS = recuperado; base = em aberto + recuperado', () => {
  const d = dashboard()
  const exp = explicarRecuperacaoMes(d)
  const [recuperado, base, percentual] = totais(exp.conta)
  assert.equal(recuperado?.numero, d.totais.totalRecuperadoMes)
  assert.equal(base?.numero, d.totais.totalEmAbertoOperacional + d.totais.totalRecuperadoMes)
  assert.equal(percentual?.numero, d.totais.percentualRecuperacao)
  assert.ok(exp.regras?.some((r) => r.includes('qualquer cliente')))
  assert.equal(exp.filtros?.[0]?.valor, 'Nov/2026')
})

test('Tempo médio e clientes ativos fecham com os cards', () => {
  const d = dashboard()
  const tempo = explicarTempoMedioRecuperacao(d)
  assert.equal(tempo.valor, '46 dias')
  assert.equal(Math.round(365 / 8), totais(tempo.conta)[0]?.numero)

  const ativos = explicarRecorrenteClientes(d)
  const [todos, resolvidos, total] = ativos.conta ?? []
  assert.equal((todos?.numero ?? 0) - (resolvidos?.numero ?? 0), total?.numero)
})

// ---------------------------------------------------------------------------
// Evolução do saldo devedor
// ---------------------------------------------------------------------------

function cliente(nome: string, saldoAnterior: number, geradoAno: number, acumulado: number): ClienteSaldoDevedor {
  return { grupoNorm: nome.toUpperCase(), nome, carteira: 'recorrente', classificacao: 'sem_perspectiva', saldoAnterior, geradoAno, acumulado }
}

test('Saldo devedor: acumulado = anos anteriores em aberto + gerado; dívida nova soma as subidas', () => {
  const clientes = [
    cliente('Alfa', 1_000, 500, 1_200), // cresceu 200
    cliente('Beta', 2_000, 0, 1_500), // reduziu 500
    cliente('Gama', 0, 300.25, 300.25), // cresceu 300,25
  ]
  const data: EvolucaoSaldoDevedorData = {
    ano: 2026,
    anoAnterior: 2025,
    mesInicio: 1,
    mesFim: 11,
    clientes,
    totais: {
      acumulado: 3_000.25,
      saldoAnterior: 3_000,
      geradoAno: 800.25,
      qtd: 3,
      qtdCresceram: 2,
      qtdReduziram: 1,
      dividaNova: 500.25,
      amortizado: 500,
    },
  }
  const input = { data, cresceram: [clientes[0]!, clientes[2]!], reduziram: [clientes[1]!], periodoAbrev: 'JAN-NOV' }

  const acum = explicarSaldoAcumulado(input)
  assert.equal(cent(soma(parcelas(acum.conta))), cent(3_000.25))
  assert.ok(acum.regras?.some((r) => r.includes('não é a soma')))

  const estoque = explicarSaldoEstoqueAnterior(input)
  assert.equal(soma(parcelas(estoque.conta)), 3_000)
  assert.ok(estoque.regras?.some((r) => r.includes('Quem quitou tudo sai da lista')))

  const cres = explicarSaldoCresceram(input)
  assert.equal(cres.valor, '2 de 3')
  const qtd = parcelas(cres.conta).slice(0, 3)
  assert.equal(soma(qtd), 3)
  const valores = parcelas(cres.conta).slice(3)
  assert.equal(cent(soma(valores)), cent(500.25))
  serializavel(cres)
})
