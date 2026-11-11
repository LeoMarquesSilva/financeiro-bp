/**
 * Fênix no Escritório: memória de cálculo dos cards do Levantamento e da Rentabilidade.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (o resumo e a rentabilidade que
 * vieram do banco), então a conta sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatHorasDuracao } from '../../../shared/utils/format.ts'
import type { LevantamentoFiltros, LevantamentoResumo } from '../services/escritorioLevantamentoService.ts'
import type { RentabilidadeContratoLinha, RentabilidadeContratos } from '../services/escritorioRentabilidadeService.ts'
import { formatHorasTimesheetHHMM } from '../utils/timesheetHorasExcel.ts'

const moeda = formatCurrency
const int = (n: number) => n.toLocaleString('pt-BR')

function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Mesmo formato de rentabilidadeFormat.formatValorHoraRecebido. */
export function valorHora(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${moeda(v).replace(/\s/g, ' ')}/h`
}

/** Mesmo formato de rentabilidadeFormat.formatResultadoHora. */
function deltaHora(v: number): string {
  const prefix = v >= 0 ? '+' : '−'
  return `${prefix}${moeda(Math.abs(v)).replace(/\s/g, ' ')}/h`
}

/** Mesmo formato de rentabilidadeFormat.formatMediaHorasMes (HH:MM). */
export function horasHHMM(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos <= 0) return '—'
  return formatHorasTimesheetHHMM(Math.round(minutos))
}

function horasDecimais(minutos: number): string {
  return `${(minutos / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`
}

function linhaTotal(rotulo: string, v: number, valor: string): FenixLinha {
  return { rotulo, valor, numero: v, operador: '=', tipo: 'total' }
}

// ---------------------------------------------------------------------------
// Filtros e regras comuns
// ---------------------------------------------------------------------------

function filtroPeriodo(f: Pick<LevantamentoFiltros, 'dataInicio' | 'dataFim'>): FenixFiltro {
  return { rotulo: 'Período', valor: `${dataBr(f.dataInicio)} a ${dataBr(f.dataFim)}` }
}

function filtrosLevantamento(f: LevantamentoFiltros, comPeriodo = true): FenixFiltro[] {
  const out: FenixFiltro[] = []
  if (comPeriodo) out.push(filtroPeriodo(f))
  out.push({
    rotulo: 'Grupos',
    valor: f.grupos.length === 0 ? 'todos' : f.grupos.length === 1 ? f.grupos[0]! : `${f.grupos.length} grupos`,
  })
  out.push({ rotulo: 'Área', valor: f.area ?? 'todas' })
  return out
}

function regraArea(area: string | null, campo: string): string[] {
  if (!area) return []
  const r = [`Área: só entra o que tem ${campo} = ${area}.`]
  const k = area.trim().toLocaleLowerCase('pt-BR')
  if (k === 'reestruturação' || k === 'reestruturacao') {
    r.push('Reestruturação junta também o que está como Insolvência e Cível | Insolvência.')
  }
  return r
}

function regraGrupo(grupos: readonly string[], campo: string): string[] {
  if (grupos.length === 0) return []
  return [`Grupos: só entra o que tem ${campo} entre os grupos escolhidos (sem diferenciar maiúsculas).`]
}

const TELA_LEVANTAMENTO = 'Escritório › Levantamento'
const TELA_RENTABILIDADE = 'Escritório › Rentabilidade'
const DETALHE_RACIONAL = 'Para ver item a item, feche o Fênix e clique em "Racional" no card.'

// ---------------------------------------------------------------------------
// Levantamento
// ---------------------------------------------------------------------------

export function explicarEscritorioPublicacoes(r: LevantamentoResumo, f: LevantamentoFiltros): FenixExplicacao {
  return {
    tela: TELA_LEVANTAMENTO,
    titulo: 'Publicações',
    valor: int(r.publicacoes_total),
    resumo: `Quantidade de publicações que chegaram para vistagem entre ${dataBr(f.dataInicio)} e ${dataBr(f.dataFim)}.`,
    formula: 'Publicações = contagem dos registros da lista de vistagem criados no período',
    conta: [linhaTotal('Publicações no período', r.publicacoes_total, int(r.publicacoes_total))],
    filtros: filtrosLevantamento(f),
    regras: [
      'Conta pela data de criação do registro na lista de vistagem (campo Criado, no horário de Brasília), não pela data da publicação no diário.',
      ...regraGrupo(f.grupos, 'o grupo da publicação'),
      ...regraArea(f.area, 'a área da publicação'),
      'Desde nov/2026 a lista também recebe as publicações gravadas pelo Orquestra (Central de Vistagem), além das que vêm do SharePoint.',
    ],
    fonte: 'Lista BKP de vistagem de publicações (SharePoint e Orquestra), sincronizada no SIOE.',
    fonteTecnica: 'Supabase › escritorio_levantamento_resumo_v2 › sp_publicacoes (criado, grupo, area)',
    detalhe: DETALHE_RACIONAL,
  }
}

export function explicarEscritorioTimesheet(r: LevantamentoResumo, f: LevantamentoFiltros): FenixExplicacao {
  const minutos = Math.round(r.timesheet_horas * 60)
  const valor = formatHorasDuracao(r.timesheet_horas)
  return {
    tela: TELA_LEVANTAMENTO,
    titulo: 'Timesheet',
    valor,
    resumo: `Horas lançadas no timesheet entre ${dataBr(f.dataInicio)} e ${dataBr(f.dataFim)}, em ${int(r.timesheet_apontamentos)} apontamentos.`,
    formula: 'Horas = soma dos minutos de cada apontamento ÷ 60',
    conta: [
      { rotulo: 'Apontamentos no período', valor: int(r.timesheet_apontamentos), numero: r.timesheet_apontamentos, tipo: 'info' },
      {
        rotulo: 'Minutos somados',
        valor: `${int(minutos)} min`,
        numero: minutos,
        detalhe: 'cada apontamento arredondado ao minuto antes de somar',
      },
      { rotulo: 'Minutos por hora', valor: '60', numero: 60, operador: '÷' },
      linhaTotal('Horas no período', r.timesheet_horas, valor),
    ],
    filtros: filtrosLevantamento(f),
    regras: [
      'Conta pela data do apontamento.',
      'Cada apontamento vira minutos inteiros (horas cheias × 60 + fração arredondada) e só depois soma, igual à planilha e ao BI.',
      ...regraGrupo(f.grupos, 'o grupo do cliente do apontamento'),
      ...regraArea(f.area, 'a área do apontamento'),
      ...(r.timesheet_data_max ? [`A base do timesheet vai até ${dataBr(r.timesheet_data_max)}: dias depois disso ainda não foram sincronizados.`] : []),
    ],
    fonte: 'Relatório de horas (TimeSheets) do VIOS, sincronizado no SIOE.',
    fonteTecnica: 'Supabase › escritorio_levantamento_resumo_v2 › timesheets (escritorio_timesheet_minutos_linha)',
    detalhe: DETALHE_RACIONAL,
  }
}

export function explicarEscritorioProcessos(r: LevantamentoResumo, f: LevantamentoFiltros): FenixExplicacao {
  const tipos = r.processos_por_tipo
  const conta: FenixLinha[] = [
    ...tipos.map((t, i) => ({
      rotulo: t.tipo || 'Sem classificação',
      valor: int(t.qtd),
      numero: t.qtd,
      operador: i === 0 ? undefined : ('+' as const),
    })),
    linhaTotal('Processos ativos', r.processos_total, int(r.processos_total)),
  ]
  return {
    tela: TELA_LEVANTAMENTO,
    titulo: 'Processos',
    valor: int(r.processos_total),
    resumo: 'Estoque de processos ativos hoje, separado em principais, recursos e incidentes.',
    formula: 'Processos = contagem das pastas com situação Ativo',
    conta,
    filtros: filtrosLevantamento(f, false),
    regras: [
      'Só entram pastas com situação Ativo: encerradas, arquivadas e suspensas ficam fora.',
      'Não usa o período: é a foto do estoque na última sincronização.',
      'Principal, recurso e incidente são classificados pelo vínculo, pela ação e pelas etiquetas da pasta.',
      ...regraGrupo(f.grupos, 'o grupo do cliente da pasta'),
      ...regraArea(f.area, 'a área da pasta (ou o departamento, quando a área está vazia)'),
    ],
    fonte: 'Relatório de processos (ProcessoCompleto) do VIOS, sincronizado no SIOE.',
    fonteTecnica: 'Supabase › escritorio_levantamento_resumo_v2 › processos_completo (situacao_processo = Ativo, escritorio_processo_tipo_vinculo)',
    detalhe: 'A quebra por situação e departamento está abaixo dos cards; "Racional" lista pasta a pasta.',
  }
}

export function explicarEscritorioTarefas(r: LevantamentoResumo, f: LevantamentoFiltros): FenixExplicacao {
  const noCard = r.tarefas_prazos + r.tarefas_providencias
  const outras = r.tarefas_total - noCard
  const conta: FenixLinha[] = [
    { rotulo: 'Prazos', valor: int(r.tarefas_prazos), numero: r.tarefas_prazos, detalhe: 'etiqueta ENVIAR' },
    { rotulo: 'Providências', valor: int(r.tarefas_providencias), numero: r.tarefas_providencias, operador: '+', detalhe: 'etiqueta PROVIDÊNCIA' },
    linhaTotal('Tarefas no card', noCard, int(noCard)),
  ]
  if (outras > 0) {
    conta.push({
      rotulo: 'Outras tarefas concluídas',
      valor: int(outras),
      numero: outras,
      tipo: 'info',
      detalhe: 'com outras etiquetas; não aparecem no card',
    })
  }
  return {
    tela: TELA_LEVANTAMENTO,
    titulo: 'Tarefas VIOS',
    valor: `${int(r.tarefas_prazos)} prazos · ${int(r.tarefas_providencias)} providências`,
    resumo: `Tarefas concluídas entre ${dataBr(f.dataInicio)} e ${dataBr(f.dataFim)}: prazos entregues e providências.`,
    formula: 'Prazos = tarefas Enviar concluídas · Providências = tarefas de providência concluídas',
    conta,
    filtros: filtrosLevantamento(f),
    regras: [
      'Conta pela data de conclusão da tarefa.',
      'Prazo = tarefa com etiqueta ENVIAR (a entrega do prazo). Revisar, protocolar e validar protocolo são passos do mesmo prazo e não contam.',
      'Providência = tarefa com etiqueta PROVIDÊNCIA.',
      'A base só tem tarefas concluídas: prazos em aberto não aparecem aqui.',
      ...regraGrupo(f.grupos, 'o grupo do cliente da tarefa'),
      ...regraArea(f.area, 'a área de conclusão da tarefa (ou a do processo, quando vazia)'),
    ],
    fonte: 'Tarefas concluídas do VIOS, sincronizadas no SIOE pela lista do SharePoint.',
    fonteTecnica: 'Supabase › escritorio_levantamento_resumo_v2 › sp_tarefas (data_conclusao, escritorio_tarefa_classe)',
    detalhe: DETALHE_RACIONAL,
  }
}

// ---------------------------------------------------------------------------
// Rentabilidade
// ---------------------------------------------------------------------------

function filtrosRentabilidade(f: LevantamentoFiltros): FenixFiltro[] {
  return [
    filtroPeriodo(f),
    { rotulo: 'Área', valor: f.area ?? 'todas' },
    { rotulo: 'Grupos', valor: 'todos (a rentabilidade ignora o filtro de grupo)' },
  ]
}

const REGRA_MES_FECHADO =
  'Usa só meses fechados: se o filtro de datas chega ao mês corrente, o fim é recortado no último dia do mês anterior.'
const REGRA_HORAS_MINUTO =
  'Cada apontamento do timesheet vira minutos inteiros e só depois soma (igual à planilha e ao BI).'
const REGRA_RECEBIDO =
  'Recebido = honorários da cota (mesmos planos de contas da Receita) pagos no período, pela data de pagamento, sem encargos de boleto e juros. Clientes ativos e inativos.'
const REGRA_PREVISTO =
  'Previsto/faturado = valor dos títulos de honorários da cota com vencimento no período, pagos ou não. Não desconta inadimplência.'

function regraAreaRentabilidade(area: string | null): string[] {
  if (!area) return []
  return [
    `Área ${area}: o recebido e o previsto contam pelo departamento do título; as horas, pela área do apontamento.`,
    ...regraArea(area, 'essa área').slice(1),
  ]
}

const FONTE_RENTABILIDADE = 'Financeiro do VIOS (títulos a receber) e relatório de horas (TimeSheets), sincronizados no SIOE.'
const FONTE_TECNICA_RENTABILIDADE =
  'Supabase › escritorio_rentabilidade_contratos (receita_itens_inadimplencia_base, receita_item_recebido_liquido, timesheets)'

export function explicarRentabilidadeHoras(d: RentabilidadeContratos, f: LevantamentoFiltros): FenixExplicacao {
  return {
    tela: TELA_RENTABILIDADE,
    titulo: 'Horas do timesheet',
    valor: horasHHMM(d.horas_minutos),
    resumo: 'Todas as horas lançadas no timesheet no período, de todos os clientes. É o divisor das médias de valor da hora.',
    formula: 'Horas = soma dos minutos de cada apontamento ÷ 60',
    conta: [
      { rotulo: 'Minutos somados', valor: `${int(d.horas_minutos)} min`, numero: d.horas_minutos },
      { rotulo: 'Minutos por hora', valor: '60', numero: 60, operador: '÷' },
      linhaTotal('Horas no período', d.horas_minutos / 60, horasHHMM(d.horas_minutos)),
      { rotulo: 'Em horas decimais', valor: horasDecimais(d.horas_minutos), numero: d.horas_minutos / 60, tipo: 'info' },
    ],
    filtros: filtrosRentabilidade(f),
    regras: [
      'Entram todas as horas do período, inclusive de clientes sem grupo.',
      REGRA_HORAS_MINUTO,
      REGRA_MES_FECHADO,
      ...(f.area ? [`Área ${f.area}: só as horas com essa área no apontamento.`] : []),
    ],
    fonte: 'Relatório de horas (TimeSheets) do VIOS, sincronizado no SIOE.',
    fonteTecnica: 'Supabase › escritorio_rentabilidade_contratos › timesheets (escritorio_timesheet_minutos_linha)',
  }
}

function explicarHoraEscritorio(
  d: RentabilidadeContratos,
  f: LevantamentoFiltros,
  tipo: 'efetivo' | 'previsto',
): FenixExplicacao {
  const efetivo = tipo === 'efetivo'
  const base = efetivo ? d.recebido_escritorio : d.previsto_escritorio
  const v = efetivo ? d.valor_hora_efetivo_escritorio : d.valor_hora_previsto_escritorio
  const rotuloBase = efetivo ? 'Recebido no período' : 'Previsto/faturado no período'
  return {
    tela: TELA_RENTABILIDADE,
    titulo: efetivo ? 'Valor efetivo médio da hora' : 'Valor médio previsto/faturado',
    valor: valorHora(v),
    resumo: efetivo
      ? 'Quanto entrou no caixa, em média, por hora trabalhada no escritório.'
      : 'Quanto foi faturado (vencimentos do período), em média, por hora trabalhada no escritório, sem descontar o que não foi pago.',
    formula: efetivo ? 'Valor efetivo da hora = Recebido ÷ horas do timesheet' : 'Valor médio da hora = Previsto/faturado ÷ horas do timesheet',
    conta:
      d.horas_minutos > 0
        ? [
            { rotulo: rotuloBase, valor: moeda(base), numero: base },
            {
              rotulo: 'Horas do timesheet',
              valor: horasDecimais(d.horas_minutos),
              numero: d.horas_minutos / 60,
              operador: '÷',
              detalhe: `${horasHHMM(d.horas_minutos)} em horas:minutos`,
            },
            linhaTotal(efetivo ? 'Valor efetivo da hora' : 'Valor médio da hora', v ?? 0, valorHora(v)),
          ]
        : [
            { rotulo: rotuloBase, valor: moeda(base), numero: base },
            { rotulo: 'Horas do timesheet', valor: '0 h', numero: 0, operador: '÷', detalhe: 'sem horas no período: não há média' },
          ],
    filtros: filtrosRentabilidade(f),
    regras: [
      efetivo ? REGRA_RECEBIDO : REGRA_PREVISTO,
      'O divisor são todas as horas do timesheet no período (card Horas do timesheet).',
      REGRA_HORAS_MINUTO,
      REGRA_MES_FECHADO,
      ...regraAreaRentabilidade(f.area),
    ],
    fonte: FONTE_RENTABILIDADE,
    fonteTecnica: FONTE_TECNICA_RENTABILIDADE,
    detalhe: 'O ranking abaixo abre por grupo cliente.',
  }
}

export function explicarRentabilidadeHoraEfetiva(d: RentabilidadeContratos, f: LevantamentoFiltros): FenixExplicacao {
  return explicarHoraEscritorio(d, f, 'efetivo')
}

export function explicarRentabilidadeHoraPrevista(d: RentabilidadeContratos, f: LevantamentoFiltros): FenixExplicacao {
  return explicarHoraEscritorio(d, f, 'previsto')
}

/** Linha do ranking: valor efetivo da hora do grupo, comparado com a média do escritório. */
export function explicarRentabilidadeGrupo(
  l: RentabilidadeContratoLinha,
  d: RentabilidadeContratos,
  f: LevantamentoFiltros,
  posicao: number,
): FenixExplicacao {
  const conta: FenixLinha[] = []
  if (l.horas_minutos > 0) {
    conta.push(
      { rotulo: 'Recebido do grupo', valor: moeda(l.recebido_periodo), numero: l.recebido_periodo },
      {
        rotulo: 'Horas do grupo',
        valor: horasDecimais(l.horas_minutos),
        numero: l.horas_minutos / 60,
        operador: '÷',
        detalhe: `${horasHHMM(l.horas_minutos)} em horas:minutos`,
      },
      linhaTotal('Valor efetivo da hora', l.valor_hora_efetivo ?? 0, valorHora(l.valor_hora_efetivo)),
    )
  } else {
    conta.push(
      { rotulo: 'Recebido do grupo', valor: moeda(l.recebido_periodo), numero: l.recebido_periodo },
      { rotulo: 'Horas do grupo', valor: '0 h', numero: 0, operador: '÷', detalhe: 'sem horas no período: taxa em branco' },
    )
  }
  if (l.valor_hora_efetivo != null && d.valor_hora_efetivo_escritorio != null) {
    conta.push({
      rotulo: 'Média do escritório',
      valor: valorHora(d.valor_hora_efetivo_escritorio),
      numero: d.valor_hora_efetivo_escritorio,
      tipo: 'info',
      detalhe: `${deltaHora(l.valor_hora_efetivo - d.valor_hora_efetivo_escritorio)} vs média`,
    })
  }
  if (l.valor_hora_previsto != null) {
    conta.push({
      rotulo: 'Valor médio da hora (previsto/faturado)',
      valor: valorHora(l.valor_hora_previsto),
      numero: l.valor_hora_previsto,
      tipo: 'info',
      detalhe: `${moeda(l.previsto_periodo)} previstos ÷ as mesmas horas${
        d.valor_hora_previsto_escritorio != null
          ? ` · ${deltaHora(l.valor_hora_previsto - d.valor_hora_previsto_escritorio)} vs média`
          : ''
      }`,
    })
  }
  return {
    tela: `${TELA_RENTABILIDADE} › Ranking por grupo cliente`,
    titulo: `${l.cliente} (${posicao}º)`,
    valor: valorHora(l.valor_hora_efetivo),
    resumo: `Quanto o grupo ${l.cliente} pagou, em média, por hora trabalhada para ele no período, comparado com a média do escritório.`,
    formula: 'Valor efetivo da hora do grupo = Recebido do grupo ÷ horas do grupo',
    conta,
    filtros: [
      ...filtrosRentabilidade(f),
      ...(l.razoes_sociais.length > 1 ? [{ rotulo: 'Razões sociais', valor: String(l.razoes_sociais.length) }] : []),
    ],
    regras: [
      'Grupo = grupo cliente do cadastro (o mesmo da inadimplência); cliente sem grupo aparece pela razão social.',
      'Horas do grupo = apontamentos do timesheet dos clientes do grupo.',
      REGRA_RECEBIDO,
      REGRA_PREVISTO,
      'Sem horas no período, a taxa fica em branco e a linha vai para o fim do ranking.',
      REGRA_MES_FECHADO,
      ...regraAreaRentabilidade(f.area),
    ],
    fonte: FONTE_RENTABILIDADE,
    fonteTecnica: `${FONTE_TECNICA_RENTABILIDADE} (receita_inadimplencia_chave_grupo)`,
  }
}
