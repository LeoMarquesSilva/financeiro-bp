/**
 * Fênix na Cobrança: Painel de cobrança, Indicadores (D+1) e Inadimplência Pontual.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (nada é recalculado
 * por outro caminho), então a explicação sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import type { PainelFiltros, PainelResumo } from '../services/cobrancaService.ts'
import type {
  CobrancaSeguimentoGrupo,
  CobrancaSeguimentoGrupoAcima60,
} from '../types/cobrancaSeguimento.types.ts'
import {
  FONTE_ENVIOS_COBRANCA,
  FONTE_FINANCEIRO_VIOS,
  dataBr,
  info,
  inteiro,
  isoLocal,
  linhasMaioresMoeda,
  linhasPercentual,
  mesAno,
  moeda,
  nomeMes,
  notaCentavos,
  parcelaInteiro,
  pct,
  plural,
  totalInteiro,
  totalMoeda,
} from './fenixComum.ts'

// ---------------------------------------------------------------------------
// Regras comuns
// ---------------------------------------------------------------------------

const REGRA_D1 =
  'A data de cobrança (D+1) é um dia útil depois do vencimento. Vencimento em sábado, domingo ou feriado passa antes para o próximo dia útil (ex.: venc. 31/05 → efetivo 01/06 → cobrança 02/06).'
const REGRA_FERIADOS =
  'Feriados da lista de feriados do escritório não contam como dia útil, exceto o Dia do Servidor Público (28/10) e o Dia da Bandeira (19/11), em que a cobrança trabalha.'
const REGRA_VALOR_TITULO =
  'O valor de cada título é o saldo ainda em aberto no VIOS, sem os itens de Outras Receitas.'
const REGRA_SALDO_PARCIAL =
  'Títulos que são saldo de pagamento parcial no VIOS (número no formato 12385-1(12448/1)) ficam fora.'
const REGRA_ARQUIVADOS = 'Títulos removidos do painel de cobrança (arquivados) não entram.'
const REGRA_SO_ABERTOS = 'Só títulos a receber em aberto no VIOS. Quando o cliente paga, o título sai.'

const FONTE_COBRANCA = `${FONTE_FINANCEIRO_VIOS} ${FONTE_ENVIOS_COBRANCA}`

// ---------------------------------------------------------------------------
// Cobrança › Painel de cobrança
// ---------------------------------------------------------------------------

export type CobrancaPainelFenixFiltros = Pick<
  PainelFiltros,
  | 'busca'
  | 'incluirConcluidos'
  | 'rotinaVencidosOntem'
  | 'mes'
  | 'ano'
  | 'planoContas'
  | 'statusCobranca'
  | 'faixaAtraso'
>

export type CobrancaPainelFenixInput = {
  /** O mesmo resumo que alimenta os cards. */
  resumo: PainelResumo
  filtros: CobrancaPainelFenixFiltros
  hoje?: Date
}

/** Limite de linhas que o resumo do painel soma (cobrancaService.getPainelResumo). */
const RESUMO_MAX_ROWS = 5000

const TELA_PAINEL = 'Cobrança › Painel de cobrança'

const STATUS_PAINEL: Record<string, string> = {
  falta_whatsapp: 'Falta WhatsApp',
  concluido: 'Cobrado (WhatsApp)',
}

const FAIXA_PAINEL: Record<string, string> = {
  '1-7': '1 a 7 dias',
  '8-30': '8 a 30 dias',
  '31+': '31 dias ou mais',
}

function concluidosOcultos(f: CobrancaPainelFenixFiltros): boolean {
  return !f.incluirConcluidos && f.statusCobranca !== 'concluido'
}

/** Mesmo critério de cobrancaService.buildVencimentoRange: só o mês usa o ano atual. */
function vencimentoPainel(f: CobrancaPainelFenixFiltros, hoje: Date): string | null {
  const ano = f.ano ?? (f.mes ? hoje.getFullYear() : null)
  if (!ano) return null
  return f.mes ? mesAno(f.mes, ano) : String(ano)
}

function filtrosPainel(f: CobrancaPainelFenixFiltros, hoje: Date): FenixFiltro[] {
  const filtros: FenixFiltro[] = [
    {
      rotulo: 'Fila',
      valor: f.rotinaVencidosOntem
        ? `Rotina D+1: cobrança prevista para hoje (${dataBr(isoLocal(hoje))})`
        : 'Backlog: todos os títulos com cobrança já devida',
    },
  ]
  if (!f.rotinaVencidosOntem) {
    filtros.push({ rotulo: 'Vencimento', valor: vencimentoPainel(f, hoje) ?? 'qualquer data' })
  }
  filtros.push({ rotulo: 'Plano de contas', valor: f.planoContas || 'todos' })
  filtros.push({
    rotulo: 'Status da cobrança',
    valor: f.statusCobranca ? STATUS_PAINEL[f.statusCobranca] ?? f.statusCobranca : 'todos',
  })
  filtros.push({
    rotulo: 'Dias em atraso',
    valor: f.faixaAtraso ? FAIXA_PAINEL[f.faixaAtraso] ?? f.faixaAtraso : 'qualquer',
  })
  filtros.push({
    rotulo: 'Concluídos',
    valor: concluidosOcultos(f) ? 'fora (só quem ainda não recebeu WhatsApp)' : 'incluídos',
  })
  const busca = f.busca?.trim()
  if (busca) filtros.push({ rotulo: 'Busca', valor: busca })
  return filtros
}

function regrasPainel(f: CobrancaPainelFenixFiltros, hoje: Date): string[] {
  const venc = vencimentoPainel(f, hoje)
  const regras = [
    f.rotinaVencidosOntem
      ? 'Rotina D+1 ligada: só títulos cuja data de cobrança é hoje.'
      : `Rotina D+1 desligada (backlog): todos os títulos cuja data de cobrança já chegou${venc ? `, com vencimento em ${venc}` : ''}.`,
  ]
  if (concluidosOcultos(f)) {
    regras.push('"Ver concluídos" desligado: títulos que já receberam WhatsApp ficam fora.')
  }
  regras.push(REGRA_SO_ABERTOS, REGRA_VALOR_TITULO, REGRA_SALDO_PARCIAL, REGRA_ARQUIVADOS, REGRA_D1, REGRA_FERIADOS)
  if (f.faixaAtraso) {
    regras.push('Os dias em atraso contam a partir da data de cobrança D+1, não do vencimento.')
  }
  regras.push('Os cards somam todos os títulos do filtro, não só a página da tabela.')
  return regras
}

function basePainel(i: CobrancaPainelFenixInput) {
  const hoje = i.hoje ?? new Date()
  return {
    tela: TELA_PAINEL,
    filtros: filtrosPainel(i.filtros, hoje),
    regras: regrasPainel(i.filtros, hoje),
    fonte: FONTE_COBRANCA,
    fonteTecnica:
      'Supabase › view cobranca_painel (financeiro_parcelas + cobranca_eventos) · cobrancaService.getPainelResumo',
    detalhe: 'A tabela logo abaixo dos filtros lista título a título, com os mesmos filtros.',
  }
}

function avisoLimiteResumo(qtd: number): FenixLinha[] {
  return qtd >= RESUMO_MAX_ROWS
    ? [
        info(
          'Limite do resumo',
          inteiro(RESUMO_MAX_ROWS),
          'o resumo soma no máximo 5.000 títulos; acima disso os cards ficam abaixo do real',
        ),
      ]
    : []
}

export function explicarPainelValorPendente(i: CobrancaPainelFenixInput): FenixExplicacao {
  const { totalValor, qtd } = i.resumo
  const hoje = i.hoje ?? new Date()
  const conta: FenixLinha[] = [
    info('Títulos somados', inteiro(qtd), undefined, qtd),
    totalMoeda('Valor pendente', totalValor),
    ...(qtd > 0 ? [info('Média por título', moeda(totalValor / qtd))] : []),
    ...avisoLimiteResumo(qtd),
  ]
  return {
    ...basePainel(i),
    titulo: 'Valor pendente',
    valor: moeda(totalValor),
    resumo: `${
      i.filtros.rotinaVencidosOntem
        ? `Saldo em aberto dos títulos que estão na fila de cobrança de hoje (${dataBr(isoLocal(hoje))})`
        : 'Saldo em aberto dos títulos vencidos listados no painel (backlog)'
    }${concluidosOcultos(i.filtros) ? ', só os que ainda não receberam WhatsApp' : ''}.`,
    formula: 'Valor pendente = soma do saldo em aberto de cada título do painel',
    conta,
  }
}

export function explicarPainelTitulos(i: CobrancaPainelFenixInput): FenixExplicacao {
  const { qtd, comWhatsapp } = i.resumo
  const sem = Math.max(0, qtd - comWhatsapp)
  return {
    ...basePainel(i),
    titulo: 'Títulos no painel',
    valor: String(qtd),
    resumo: 'Quantos títulos estão no painel com os filtros atuais.',
    formula: 'Títulos no painel = títulos com WhatsApp enviado + títulos ainda sem WhatsApp',
    conta: [
      parcelaInteiro('Com WhatsApp enviado', comWhatsapp, true),
      parcelaInteiro('Ainda sem WhatsApp', sem, false),
      totalInteiro('Títulos no painel', qtd),
      ...avisoLimiteResumo(qtd),
    ],
  }
}

export function explicarPainelCobrados(i: CobrancaPainelFenixInput): FenixExplicacao {
  const { qtd, comWhatsapp } = i.resumo
  const base = basePainel(i)
  const ocultos = concluidosOcultos(i.filtros)
  const percentual = qtd > 0 ? (comWhatsapp / qtd) * 100 : 0
  return {
    ...base,
    titulo: 'Cobrados (WhatsApp)',
    valor: `${comWhatsapp}/${qtd}`,
    resumo: 'Dos títulos no painel, quantos já receberam pelo menos uma cobrança por WhatsApp.',
    formula: 'Cobrados = títulos com WhatsApp enviado / títulos no painel',
    conta: [
      { rotulo: 'Títulos com WhatsApp enviado', valor: inteiro(comWhatsapp), numero: comWhatsapp },
      { rotulo: 'Títulos no painel', valor: inteiro(qtd), numero: qtd, operador: '÷' },
      {
        rotulo: 'Cobrados',
        valor: `${comWhatsapp}/${qtd}`,
        numero: percentual,
        operador: '=',
        tipo: 'total',
        detalhe: qtd > 0 ? `${pct(percentual)} dos títulos` : undefined,
      },
    ],
    regras: [
      ...(ocultos
        ? [
            'Com "Ver concluídos" desligado, o painel esconde quem já recebeu WhatsApp, então este card fica em 0/N. Ligue "Ver concluídos" para ver quantos já foram cobrados.',
          ]
        : []),
      'Conta como cobrado o título com pelo menos um WhatsApp enviado pelo SIOE, em qualquer data. E-mail não conta.',
      ...base.regras.filter((r) => !r.startsWith('"Ver concluídos"')),
    ],
  }
}

export function explicarPainelAguardando(i: CobrancaPainelFenixInput): FenixExplicacao {
  const { qtd, comWhatsapp } = i.resumo
  const falta = Math.max(0, qtd - comWhatsapp)
  return {
    ...basePainel(i),
    titulo: 'Aguardando WhatsApp',
    valor: String(falta),
    resumo: 'Títulos do painel que ainda não receberam nenhuma cobrança por WhatsApp.',
    formula: 'Aguardando = títulos no painel − títulos com WhatsApp enviado',
    conta: [
      parcelaInteiro('Títulos no painel', qtd, true),
      { rotulo: 'Com WhatsApp enviado', valor: inteiro(comWhatsapp), numero: comWhatsapp, operador: '−' },
      totalInteiro('Aguardando WhatsApp', falta),
    ],
  }
}

// ---------------------------------------------------------------------------
// Cobrança › Indicadores (efetividade D+1)
// ---------------------------------------------------------------------------

/** Mesmo formato do agregado de CobrancaDashboard. */
export type CobrancaIndicadoresKpi = {
  titulos_vencidos: number
  titulos_cobrados: number
  titulos_fora_prazo: number
  titulos_sem_cobranca: number
  com_whatsapp: number
  valor_vencido: number
  valor_cobrado: number
  valor_fora_prazo: number
  valor_sem_cobranca: number
  efetividade_pct: number
}

export type CobrancaIndicadoresFiltros = {
  /** "2026" ou null (todos). */
  ano: string | null
  /** "05" ou null (todos). */
  mes: string | null
  planos: readonly string[]
  grupos: readonly string[]
  status: 'cobrado' | 'fora_prazo' | 'pendente' | null
  faixa: '1-7' | '8-30' | '31+' | null
}

export type CobrancaIndicadoresFenixInput = {
  kpi: CobrancaIndicadoresKpi
  filtros: CobrancaIndicadoresFiltros
}

/** Início do indicador: cobrancaService.listPainelKpi lê vencimentos a partir desta data. */
export const INDICADOR_D1_INICIO = '2026-05-01'

const TELA_INDICADORES = 'Cobrança › Indicadores (D+1)'

const STATUS_INDICADOR: Record<string, string> = {
  cobrado: 'No D+1 (indicador)',
  fora_prazo: 'Fora do prazo D+1',
  pendente: 'Sem cobrança',
}

function listaFiltro(itens: readonly string[], todos: string): string {
  if (itens.length === 0) return todos
  if (itens.length <= 3) return itens.join(', ')
  return `${itens.length} selecionados`
}

function filtrosIndicadores(f: CobrancaIndicadoresFiltros): FenixFiltro[] {
  const venc =
    f.ano && f.mes
      ? mesAno(Number(f.mes), Number(f.ano))
      : f.ano
        ? f.ano
        : f.mes
          ? `${nomeMes(Number(f.mes))} de qualquer ano`
          : `desde ${dataBr(INDICADOR_D1_INICIO)}`
  return [
    { rotulo: 'Vencimento', valor: venc },
    { rotulo: 'Plano de contas', valor: listaFiltro(f.planos, 'todos') },
    { rotulo: 'Grupo de cliente', valor: listaFiltro(f.grupos, 'todos') },
    { rotulo: 'Status', valor: f.status ? STATUS_INDICADOR[f.status] : 'todos' },
    { rotulo: 'Dias em atraso (após o D+1)', valor: f.faixa ? FAIXA_PAINEL[f.faixa] ?? f.faixa : 'qualquer' },
  ]
}

function regrasIndicadores(f: CobrancaIndicadoresFiltros): string[] {
  return [
    `Base: títulos do painel de cobrança com vencimento a partir de ${dataBr(INDICADOR_D1_INICIO)}, início do indicador.`,
    'Só entram títulos ainda em aberto no VIOS e cuja data de cobrança (D+1) já chegou. Título pago sai da base: deixa de contar no total e, se tinha sido cobrado, também no D+1.',
    'No D+1: WhatsApp enviado entre o dia do vencimento e a data de cobrança D+1. Fora do prazo: recebeu WhatsApp, mas fora dessa janela (em geral, depois do D+1). Sem cobrança: nenhum WhatsApp enviado. E-mail não conta.',
    'Cada título cai em uma só categoria: no D+1 + fora do prazo + sem cobrança = títulos vencidos.',
    REGRA_D1,
    REGRA_FERIADOS,
    REGRA_VALOR_TITULO,
    REGRA_SALDO_PARCIAL,
    REGRA_ARQUIVADOS,
    ...(f.status
      ? ['Com filtro de status, todos os cards mostram só os títulos daquele status, e o indicador muda junto.']
      : []),
  ]
}

function baseIndicadores(i: CobrancaIndicadoresFenixInput) {
  return {
    tela: TELA_INDICADORES,
    filtros: filtrosIndicadores(i.filtros),
    regras: regrasIndicadores(i.filtros),
    fonte: FONTE_COBRANCA,
    fonteTecnica:
      'Supabase › view cobranca_painel (tem_whatsapp, tem_whatsapp_d1, data_prazo_d1) · cobrancaService.listPainelKpi · agregar() em CobrancaDashboard',
  }
}

function contaCategorias(k: CobrancaIndicadoresKpi): FenixLinha[] {
  return [
    parcelaInteiro('No D+1 (indicador)', k.titulos_cobrados, true, moeda(k.valor_cobrado)),
    parcelaInteiro('Fora do prazo D+1', k.titulos_fora_prazo, false, moeda(k.valor_fora_prazo)),
    parcelaInteiro('Sem cobrança', k.titulos_sem_cobranca, false, moeda(k.valor_sem_cobranca)),
    totalInteiro('Títulos vencidos', k.titulos_vencidos, moeda(k.valor_vencido)),
  ]
}

export function explicarIndicadorEfetividade(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  const exibido = Math.max(0, Math.min(100, k.efetividade_pct))
  const conta: FenixLinha[] =
    k.titulos_vencidos > 0
      ? [
          ...linhasPercentual({
            numerador: { rotulo: 'Títulos cobrados no D+1', valor: inteiro(k.titulos_cobrados), numero: k.titulos_cobrados },
            denominador: { rotulo: 'Títulos vencidos', valor: inteiro(k.titulos_vencidos), numero: k.titulos_vencidos },
            resultado: { rotulo: 'Efetividade D+1', pct: exibido },
          }),
          info('Fora do prazo (não conta)', inteiro(k.titulos_fora_prazo), 'cobrados depois do D+1', k.titulos_fora_prazo),
          info('Sem cobrança (não conta)', inteiro(k.titulos_sem_cobranca), 'nenhum WhatsApp enviado', k.titulos_sem_cobranca),
          info('Meta', pct(100)),
        ]
      : [
          info('Títulos vencidos', '0', undefined, 0),
          { rotulo: 'Efetividade D+1', valor: pct(exibido), numero: exibido, operador: '=', tipo: 'total', detalhe: 'sem títulos no filtro, o indicador fica em 100%' },
        ]
  return {
    ...baseIndicadores(i),
    titulo: 'Efetividade na Cobrança Inicial (D+1)',
    valor: pct(exibido),
    resumo: 'Percentual dos títulos vencidos que foram cobrados por WhatsApp até o D+1 útil. A meta é 100%.',
    formula: 'Efetividade = títulos cobrados no D+1 ÷ títulos vencidos × 100',
    conta,
    detalhe: 'Para ver título a título, feche o Fênix e clique nos cards abaixo do indicador.',
  }
}

export function explicarIndicadorVencidos(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  return {
    ...baseIndicadores(i),
    titulo: 'Títulos vencidos',
    valor: String(k.titulos_vencidos),
    resumo: `Títulos em aberto cuja data de cobrança D+1 já chegou: ${moeda(k.valor_vencido)} no total. É a base do indicador.`,
    formula: 'Títulos vencidos = no D+1 + fora do prazo + sem cobrança',
    conta: [
      ...contaCategorias(k),
      info('Valor dos títulos vencidos', moeda(k.valor_vencido), undefined, k.valor_vencido),
    ],
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Títulos vencidos.',
  }
}

export function explicarIndicadorNoD1(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  const pctD1 = k.titulos_vencidos > 0 ? (k.titulos_cobrados / k.titulos_vencidos) * 100 : 0
  return {
    ...baseIndicadores(i),
    titulo: 'No D+1 (indicador)',
    valor: String(k.titulos_cobrados),
    resumo: `Títulos cobrados por WhatsApp entre o vencimento e a data de cobrança D+1: ${moeda(k.valor_cobrado)}. São os que contam para a meta.`,
    formula: 'No D+1 = títulos com WhatsApp enviado entre o vencimento e o D+1',
    conta: [
      ...linhasPercentual({
        numerador: { rotulo: 'No D+1', valor: inteiro(k.titulos_cobrados), numero: k.titulos_cobrados },
        denominador: { rotulo: 'Títulos vencidos', valor: inteiro(k.titulos_vencidos), numero: k.titulos_vencidos },
        resultado: { rotulo: 'Parte do total', pct: pctD1 },
      }),
      info('Valor no D+1', moeda(k.valor_cobrado), undefined, k.valor_cobrado),
    ],
    detalhe: 'Para ver título a título, feche o Fênix e clique no card No D+1.',
  }
}

export function explicarIndicadorForaPrazo(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  return {
    ...baseIndicadores(i),
    titulo: 'Fora do prazo D+1',
    valor: String(k.titulos_fora_prazo),
    resumo: `Títulos que receberam WhatsApp, mas fora da janela entre o vencimento e o D+1 (em geral, depois do D+1): ${moeda(k.valor_fora_prazo)}. Não contam para a meta, mas também não estão pendentes.`,
    formula: 'Fora do prazo = títulos com WhatsApp enviado − títulos cobrados no D+1',
    conta: [
      parcelaInteiro('Com WhatsApp (total)', k.com_whatsapp, true),
      { rotulo: 'No D+1', valor: inteiro(k.titulos_cobrados), numero: k.titulos_cobrados, operador: '−' },
      totalInteiro('Fora do prazo D+1', k.titulos_fora_prazo),
      info('Valor fora do prazo', moeda(k.valor_fora_prazo), undefined, k.valor_fora_prazo),
    ],
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Fora do prazo D+1.',
  }
}

export function explicarIndicadorSemCobranca(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  return {
    ...baseIndicadores(i),
    titulo: 'Sem cobrança',
    valor: String(k.titulos_sem_cobranca),
    resumo: `Títulos vencidos que ainda não receberam nenhum WhatsApp: ${moeda(k.valor_sem_cobranca)}. Eles derrubam o indicador.`,
    formula: 'Sem cobrança = títulos vencidos − títulos com WhatsApp enviado',
    conta: [
      parcelaInteiro('Títulos vencidos', k.titulos_vencidos, true),
      { rotulo: 'Com WhatsApp (total)', valor: inteiro(k.com_whatsapp), numero: k.com_whatsapp, operador: '−' },
      totalInteiro('Sem cobrança', k.titulos_sem_cobranca),
      info('Valor sem cobrança', moeda(k.valor_sem_cobranca), undefined, k.valor_sem_cobranca),
    ],
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Sem cobrança.',
  }
}

export function explicarIndicadorComWhatsapp(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  return {
    ...baseIndicadores(i),
    titulo: 'Com WhatsApp (total)',
    valor: String(k.com_whatsapp),
    resumo: `Títulos que receberam pelo menos um WhatsApp, no prazo ou depois, de ${k.titulos_vencidos} títulos vencidos.`,
    formula: 'Com WhatsApp = no D+1 + fora do prazo',
    conta: [
      parcelaInteiro('No D+1', k.titulos_cobrados, true),
      parcelaInteiro('Fora do prazo D+1', k.titulos_fora_prazo, false),
      totalInteiro('Com WhatsApp (total)', k.com_whatsapp),
      info('Títulos vencidos', inteiro(k.titulos_vencidos), 'base do indicador', k.titulos_vencidos),
    ],
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Com WhatsApp.',
  }
}

export function explicarIndicadorValorD1(i: CobrancaIndicadoresFenixInput): FenixExplicacao {
  const k = i.kpi
  const pctValor = k.valor_vencido > 0 ? Math.min(100, (k.valor_cobrado / k.valor_vencido) * 100) : 0
  const parcelas = [k.valor_cobrado, k.valor_fora_prazo, k.valor_sem_cobranca]
  return {
    ...baseIndicadores(i),
    titulo: 'Valor no indicador (D+1)',
    valor: `${moeda(k.valor_cobrado)} de ${moeda(k.valor_vencido)}`,
    resumo: 'Quanto, em reais, dos títulos vencidos foi cobrado no D+1. A barra mostra essa proporção.',
    formula: 'Proporção = valor cobrado no D+1 ÷ valor dos títulos vencidos × 100',
    conta: [
      { rotulo: 'No D+1', valor: moeda(k.valor_cobrado), numero: k.valor_cobrado },
      { rotulo: 'Fora do prazo D+1', valor: moeda(k.valor_fora_prazo), numero: k.valor_fora_prazo, operador: '+' },
      { rotulo: 'Sem cobrança', valor: moeda(k.valor_sem_cobranca), numero: k.valor_sem_cobranca, operador: '+' },
      totalMoeda('Valor dos títulos vencidos', k.valor_vencido),
      ...notaCentavos(parcelas, k.valor_vencido),
      info('Parte cobrada no D+1', pct(pctValor), `${moeda(k.valor_cobrado)} ÷ ${moeda(k.valor_vencido)} × 100`, pctValor),
    ],
  }
}

// ---------------------------------------------------------------------------
// Inadimplência Pontual (seguimento pós-D+1)
// ---------------------------------------------------------------------------

export type FiltroComitePontual = 'todos' | 'comite' | 'fora_comite'

export type PontualFenixContexto = {
  /** Ex.: "Inadimplência Pontual" ou "Painel de Inadimplência › Carteiras". */
  tela: string
  /** Os grupos que entraram na conta (os mesmos que geraram o card). */
  grupos: readonly CobrancaSeguimentoGrupo[]
  filtros: FenixFiltro[]
  comite: FiltroComitePontual
  /** Onde ver item a item. */
  detalhe?: string
}

export const TELA_PONTUAL = 'Inadimplência Pontual'

const COMITE_LABEL: Record<FiltroComitePontual, string> = {
  todos: 'todos os grupos',
  comite: 'só grupos no Comitê',
  fora_comite: 'só grupos fora do Comitê',
}

/** Filtros da tela Inadimplência Pontual, no formato do Fênix. */
export function filtrosPontualPagina(f: {
  busca: string
  faixa: 'todos' | '1-30' | '31-60'
  statusD1: 'todos' | 'com_d1' | 'sem_d1'
  comite: FiltroComitePontual
}): FenixFiltro[] {
  const filtros: FenixFiltro[] = [
    { rotulo: 'Comitê de Inadimplência', valor: COMITE_LABEL[f.comite] },
    {
      rotulo: 'Faixa (título mais atrasado do grupo)',
      valor: f.faixa === '1-30' ? '1 a 30 dias' : f.faixa === '31-60' ? '31 a 60 dias' : 'todas',
    },
    {
      rotulo: 'Cobrança D+1',
      valor:
        f.statusD1 === 'com_d1'
          ? 'grupos com cobrança enviada'
          : f.statusD1 === 'sem_d1'
            ? 'grupos sem cobrança enviada'
            : 'todos',
    },
  ]
  const busca = f.busca.trim()
  if (busca) filtros.push({ rotulo: 'Busca', valor: busca })
  return filtros
}

function regrasPontual(c: PontualFenixContexto): string[] {
  const comite =
    c.comite === 'fora_comite'
      ? 'Só grupos sem card ativo no Comitê de Inadimplência. Card resolvido não tira o grupo daqui.'
      : c.comite === 'comite'
        ? 'Só grupos com card ativo no Comitê de Inadimplência.'
        : 'Inclui grupos que estão e que não estão no Comitê de Inadimplência.'
  const regras = [
    'Entram títulos a receber em aberto no VIOS vencidos há 1 a 60 dias (dias corridos desde o vencimento) e cuja data de cobrança D+1 já passou.',
    `${REGRA_VALOR_TITULO} ${REGRA_SALDO_PARCIAL}`,
    'Os títulos são somados por grupo de cliente (grupo do cadastro de pessoas; sem grupo, o próprio cliente).',
    comite,
    'Títulos arquivados no painel de cobrança continuam contando aqui.',
    'Com mais de 60 dias de atraso o título sai desta carteira; o grupo deve ir para o Comitê.',
  ]
  if (c.filtros.some((f) => f.rotulo === 'Cobrança D+1' && f.valor !== 'todos')) {
    regras.push(
      'Grupo "com cobrança" é o que tem pelo menos uma cobrança enviada (WhatsApp ou e-mail) em algum dos títulos listados, em qualquer data.',
    )
  }
  return regras
}

function basePontual(c: PontualFenixContexto) {
  return {
    tela: c.tela,
    filtros: c.filtros,
    regras: regrasPontual(c),
    fonte: FONTE_FINANCEIRO_VIOS,
    fonteTecnica:
      'Supabase › cobranca_seguimento_dashboard (cobranca_seguimento_titulos_base) · índice do Comitê (clients_inadimplencia) · calcularKpisFromGrupos',
    detalhe: c.detalhe ?? 'A tabela de grupos logo abaixo mostra grupo a grupo; clique no grupo para ver os títulos.',
  }
}

function contaGrupos(grupos: readonly CobrancaSeguimentoGrupo[], total: number, rotuloTotal: string): FenixLinha[] {
  const { linhas, parcelas } = linhasMaioresMoeda(grupos, {
    valor: (g) => g.valor_total,
    rotulo: (g) => g.grupo_chave,
    detalhe: (g) => `${plural(g.qtd_titulos, 'título', 'títulos')} · até ${g.max_dias_atraso} dias`,
    rotuloDemais: (n) => `Demais ${n} grupos`,
  })
  return [...linhas, totalMoeda(rotuloTotal, total), ...notaCentavos(parcelas, total)]
}

export function explicarPontualValorEmAberto(c: PontualFenixContexto, valorTotal: number): FenixExplicacao {
  const titulos = c.grupos.reduce((s, g) => s + g.qtd_titulos, 0)
  return {
    ...basePontual(c),
    titulo: 'Valor em aberto',
    valor: moeda(valorTotal),
    resumo: `Saldo em aberto dos títulos vencidos de 1 a 60 dias após a cobrança D+1, somado em ${plural(c.grupos.length, 'grupo', 'grupos')} (${plural(titulos, 'título', 'títulos')}).`,
    formula: 'Valor em aberto = soma do saldo em aberto dos títulos de cada grupo',
    conta: contaGrupos(c.grupos, valorTotal, 'Valor em aberto'),
  }
}

export function explicarPontualGrupos(c: PontualFenixContexto, qtdGrupos: number): FenixExplicacao {
  const ate30 = c.grupos.filter((g) => g.max_dias_atraso <= 30).length
  const de31 = c.grupos.length - ate30
  return {
    ...basePontual(c),
    titulo: 'Grupos devedores',
    valor: String(qtdGrupos),
    resumo: 'Quantos grupos de cliente têm pelo menos um título vencido de 1 a 60 dias após a cobrança D+1.',
    formula: 'Grupos devedores = grupos com título mais atrasado até 30 dias + de 31 a 60 dias',
    conta: [
      parcelaInteiro('Título mais atrasado com até 30 dias', ate30, true),
      parcelaInteiro('Título mais atrasado com 31 a 60 dias', de31, false),
      totalInteiro('Grupos devedores', qtdGrupos),
    ],
  }
}

export function explicarPontualFaixa31a60(
  c: PontualFenixContexto,
  valor: number,
  mediaDiasAtraso: number,
): FenixExplicacao {
  const grupos = c.grupos.filter((g) => g.max_dias_atraso > 30)
  return {
    ...basePontual(c),
    titulo: 'Faixa 31–60 dias',
    valor: moeda(valor),
    resumo: `Valor em aberto dos grupos cujo título mais atrasado tem de 31 a 60 dias (${plural(grupos.length, 'grupo', 'grupos')}).`,
    formula: 'Faixa 31–60 = soma do valor em aberto dos grupos com título mais atrasado acima de 30 dias',
    conta: [
      ...contaGrupos(grupos, valor, 'Faixa 31–60 dias'),
      info(
        'Média de dias (abaixo do valor)',
        `${mediaDiasAtraso} dias`,
        `média de atraso de cada grupo, depois a média entre os ${c.grupos.length} grupos listados, arredondada`,
        mediaDiasAtraso,
      ),
    ],
    regras: [
      'O grupo inteiro entra na faixa pelo título mais atrasado: se o título mais antigo tem mais de 30 dias, todo o valor do grupo conta aqui, inclusive títulos mais novos.',
      'A média de dias embaixo do valor considera todos os grupos listados, das duas faixas, e não só os de 31 a 60 dias.',
      ...regrasPontual(c),
    ],
  }
}

export type PontualDepartamentoSlice = { departamento: string; valor: number; pct: number }

export function explicarPontualDepartamentos(
  c: PontualFenixContexto,
  slices: readonly PontualDepartamentoSlice[],
  valorEmAberto: number,
): FenixExplicacao {
  const somaPizza = slices.reduce((s, x) => s + x.valor, 0)
  const conta: FenixLinha[] = slices.map((s, i) => ({
    rotulo: s.departamento,
    valor: moeda(s.valor),
    numero: s.valor,
    operador: i === 0 ? undefined : '+',
    detalhe: pct(s.pct),
  }))
  conta.push(totalMoeda('Total da pizza', somaPizza), ...notaCentavos(slices.map((s) => s.valor), somaPizza))
  if (Math.abs(somaPizza - valorEmAberto) >= 0.005) {
    conta.push(
      info(
        'Valor em aberto (card ao lado)',
        moeda(valorEmAberto),
        `diferença de ${moeda(Math.abs(somaPizza - valorEmAberto))}: a pizza usa valor do item menos o pago, sem as regras de baixa parcial e desconto do saldo do título`,
        valorEmAberto,
      ),
    )
  }
  const principal = slices[0]
  return {
    ...basePontual(c),
    titulo: 'Por departamento',
    valor: principal ? `${principal.departamento} ${pct(principal.pct)}` : 'Sem alocação',
    resumo: 'Como o valor em aberto da Pontual se divide entre os departamentos dos itens dos títulos.',
    formula: 'Participação = valor do departamento ÷ total da pizza × 100',
    conta,
    regras: [
      'Cada título é dividido pelo departamento de cada item no VIOS. Item sem departamento entra como "Sem departamento"; título sem itens também.',
      'O valor por item é o valor do item menos o que já foi pago dele, sem os itens de Outras Receitas. Departamento sem valor positivo não aparece.',
      'Por usar a conta por item, o total da pizza pode diferir um pouco do Valor em aberto, que usa o saldo do título (baixa parcial e desconto concedido).',
      ...regrasPontual(c),
    ],
  }
}

export function explicarPontualAcima60(i: {
  grupos: readonly CobrancaSeguimentoGrupoAcima60[]
  valorTotal: number
  qtdTitulos: number
}): FenixExplicacao {
  const { linhas, parcelas } = linhasMaioresMoeda(i.grupos, {
    valor: (g) => g.valor_total,
    rotulo: (g) => g.grupo_chave,
    detalhe: (g) => `${plural(g.qtd_titulos, 'título', 'títulos')} · até ${g.max_dias_atraso} dias`,
    rotuloDemais: (n) => `Demais ${n} grupos`,
  })
  return {
    tela: TELA_PONTUAL,
    titulo: 'Grupos acima de 60 dias fora do Comitê',
    valor: moeda(i.valorTotal),
    resumo: `${plural(i.grupos.length, 'grupo tem', 'grupos têm')} títulos vencidos há mais de 60 dias e não ${i.grupos.length === 1 ? 'está' : 'estão'} no Comitê de Inadimplência: ${plural(i.qtdTitulos, 'título', 'títulos')}, ${moeda(i.valorTotal)} em aberto.`,
    formula: 'Valor = soma do saldo em aberto dos títulos com mais de 60 dias, por grupo fora do Comitê',
    conta: [
      ...linhas,
      totalMoeda('Valor em aberto acima de 60 dias', i.valorTotal),
      ...notaCentavos(parcelas, i.valorTotal),
      info('Títulos', inteiro(i.qtdTitulos), undefined, i.qtdTitulos),
    ],
    filtros: [
      { rotulo: 'Atraso', valor: 'mais de 60 dias desde o vencimento' },
      { rotulo: 'Comitê de Inadimplência', valor: 'só grupos fora do Comitê' },
    ],
    regras: [
      'Entram títulos a receber em aberto no VIOS vencidos há mais de 60 dias (dias corridos), sem limite de idade.',
      `${REGRA_VALOR_TITULO} ${REGRA_SALDO_PARCIAL}`,
      'Só grupos sem card ativo no Comitê de Inadimplência. Quando o grupo entra no Comitê, sai deste aviso.',
      'Este aviso não muda com os filtros da página.',
    ],
    fonte: FONTE_FINANCEIRO_VIOS,
    fonteTecnica:
      'Supabase › cobranca_seguimento_grupos_acima_60 (cobranca_seguimento_titulos_acima_60_base) · índice do Comitê (clients_inadimplencia)',
    detalhe: 'Com o Fênix fechado, clique em "Revisar no Comitê" para ver título a título.',
  }
}
