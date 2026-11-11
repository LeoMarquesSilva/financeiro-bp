/**
 * Fênix no Timesheet: memória de cálculo dos cards do topo.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (vindos do mesmo
 * `timesheet_visao`), então a explicação sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatTimesheetHoras } from '../utils/formatTimesheetHoras.ts'

export const MESES_TIMESHEET = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

export function rotuloMesTimesheet(ano: number, mes: number): string {
  return `${MESES_TIMESHEET[mes - 1] ?? String(mes)}/${String(ano).slice(-2)}`
}

function inteiro(v: number): string {
  return v.toLocaleString('pt-BR')
}

export type TimesheetFenixRecorte = {
  ano: number
  /** Rótulo do recorte de área como aparece no cabeçalho (ex.: "Todas as áreas", "Cível"). */
  areaLabel: string | null
  /** Áreas do VIOS consultadas. */
  areas: readonly string[] | null
  /** A pessoa pode trocar a área (sócio/admin); senão vê só a própria área. */
  podeFiltrarAreas: boolean
  /** Meses escolhidos; null = ano inteiro. */
  meses: readonly number[] | null
  responsavel: string | null
}

const TELA = 'Timesheet'

export function filtrosTimesheet(r: TimesheetFenixRecorte): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(r.ano) },
    { rotulo: 'Área', valor: r.areaLabel ?? 'Todas as áreas' },
    ...(r.areas && r.areas.length > 0 ? [{ rotulo: 'Áreas no VIOS', valor: r.areas.join(', ') }] : []),
    {
      rotulo: 'Meses',
      valor: r.meses && r.meses.length > 0 ? r.meses.map((m) => rotuloMesTimesheet(r.ano, m)).join(', ') : 'ano inteiro',
    },
    { rotulo: 'Responsável', valor: r.responsavel ?? 'todos' },
  ]
}

export function regrasRecorteTimesheet(r: TimesheetFenixRecorte): string[] {
  const regras: string[] = []
  if (r.podeFiltrarAreas && (r.areaLabel == null || r.areaLabel === 'Todas as áreas')) {
    regras.push(
      '"Todas as áreas" soma só as áreas jurídicas do VIOS: Cível, Contratos, Reestruturação (Insolvência e Cível | Insolvência), Recuperação de Crédito e Trabalhista. Lançamentos de outras áreas não entram.',
    )
  } else if (!r.podeFiltrarAreas) {
    regras.push('Você vê só as horas da sua área; o banco aplica essa restrição pelo seu cadastro de colaborador.')
  }
  regras.push('Conta pela data do lançamento.')
  if (r.responsavel) regras.push(`Só lançamentos de ${r.responsavel}.`)
  return regras
}

export const FONTE_TIMESHEET = 'Relatório TimeSheets do VIOS (horas apontadas), sincronizado no SIOE.'
const FONTE_TECNICA = 'timesheet_visao (timesheet_minutos_linha) sobre a tabela timesheets'

function linhasMensais(
  ano: number,
  porMes: readonly { mes: number; valor: number }[],
  formatar: (v: number) => string,
): FenixLinha[] {
  return porMes
    .filter((m) => m.valor !== 0)
    .map((m, i) => ({
      rotulo: rotuloMesTimesheet(ano, m.mes),
      valor: formatar(m.valor),
      numero: m.valor,
      operador: i === 0 ? undefined : '+',
    }))
}

/** Avisa quando a soma dos meses não bate com o total (não deveria acontecer). */
function notaSoma(parcelas: readonly FenixLinha[], total: number, formatar: (v: number) => string): FenixLinha[] {
  const soma = parcelas.reduce((s, l) => s + (l.numero ?? 0), 0)
  if (soma === total) return []
  return [
    {
      rotulo: 'Diferença',
      valor: formatar(Math.abs(total - soma)),
      numero: total - soma,
      tipo: 'info',
      detalhe: `os meses somam ${formatar(soma)}; recarregue a página se persistir`,
    },
  ]
}

export function explicarTimesheetHoras(
  r: TimesheetFenixRecorte,
  i: { minutos: number; porMes: readonly { mes: number; minutos: number }[] },
): FenixExplicacao {
  const parcelas = linhasMensais(
    r.ano,
    i.porMes.map((m) => ({ mes: m.mes, valor: m.minutos })),
    formatTimesheetHoras,
  )
  return {
    tela: TELA,
    titulo: 'Horas',
    valor: formatTimesheetHoras(i.minutos),
    resumo: `Horas apontadas no VIOS em ${r.ano} no recorte escolhido, em horas:minutos.`,
    formula: 'Horas = soma dos minutos de cada lançamento',
    conta: [
      ...parcelas,
      {
        rotulo: 'Horas no recorte',
        valor: formatTimesheetHoras(i.minutos),
        numero: i.minutos,
        operador: '=',
        tipo: 'total',
        detalhe: `${inteiro(i.minutos)} minutos`,
      },
      ...notaSoma(parcelas, i.minutos, formatTimesheetHoras),
    ],
    filtros: filtrosTimesheet(r),
    regras: [
      'Cada lançamento vira minutos inteiros (a fração de hora é arredondada para o minuto mais próximo) e os minutos são somados. O card mostra horas:minutos, não horas decimais.',
      'Lançamento sem horas ou com horas negativas conta zero.',
      ...regrasRecorteTimesheet(r),
    ],
    fonte: FONTE_TIMESHEET,
    fonteTecnica: FONTE_TECNICA,
    detalhe: 'O botão Racional (Excel) baixa os lançamentos deste recorte, um por linha.',
  }
}

export function explicarTimesheetLancamentos(
  r: TimesheetFenixRecorte,
  i: { lancamentos: number; porMes: readonly { mes: number; lancamentos: number }[] },
): FenixExplicacao {
  const parcelas = linhasMensais(
    r.ano,
    i.porMes.map((m) => ({ mes: m.mes, valor: m.lancamentos })),
    inteiro,
  )
  return {
    tela: TELA,
    titulo: 'Lançamentos',
    valor: inteiro(i.lancamentos),
    resumo: `Quantidade de apontamentos de horas feitos no VIOS em ${r.ano} no recorte escolhido.`,
    formula: 'Lançamentos = número de linhas do timesheet no recorte',
    conta: [
      ...parcelas,
      {
        rotulo: 'Lançamentos no recorte',
        valor: inteiro(i.lancamentos),
        numero: i.lancamentos,
        operador: '=',
        tipo: 'total',
      },
      ...notaSoma(parcelas, i.lancamentos, inteiro),
    ],
    filtros: filtrosTimesheet(r),
    regras: [
      'Cada linha do relatório TimeSheets conta uma vez, inclusive as que têm zero minutos.',
      ...regrasRecorteTimesheet(r),
    ],
    fonte: FONTE_TIMESHEET,
    fonteTecnica: 'timesheet_visao (count) sobre a tabela timesheets',
    detalhe: 'O botão Racional (Excel) baixa os lançamentos deste recorte.',
  }
}

export function explicarTimesheetResponsaveis(r: TimesheetFenixRecorte, i: { valor: number }): FenixExplicacao {
  return {
    tela: TELA,
    titulo: 'Responsáveis',
    valor: inteiro(i.valor),
    resumo: 'Quantas pessoas diferentes lançaram horas no recorte escolhido.',
    formula: 'Responsáveis = nomes diferentes de colaborador com ao menos um lançamento',
    conta: [
      {
        rotulo: 'Pessoas com hora lançada',
        valor: inteiro(i.valor),
        numero: i.valor,
        operador: '=',
        tipo: 'total',
      },
    ],
    filtros: filtrosTimesheet(r),
    regras: [
      'Cada nome conta uma vez, mesmo com lançamentos em vários meses ou áreas.',
      'Lançamento sem responsável não entra na contagem.',
      'Usa o nome do colaborador como está no VIOS: grafias diferentes do mesmo nome contam como pessoas diferentes.',
      ...regrasRecorteTimesheet(r),
    ],
    fonte: FONTE_TIMESHEET,
    fonteTecnica: 'timesheet_visao (count distinct colaborador) sobre a tabela timesheets',
    detalhe: 'O ranking Por responsável, abaixo, lista as pessoas (até 40) com as horas de cada uma.',
  }
}

export function explicarTimesheetGrupos(r: TimesheetFenixRecorte, i: { valor: number }): FenixExplicacao {
  return {
    tela: TELA,
    titulo: 'Grupos',
    valor: inteiro(i.valor),
    resumo: 'Quantos grupos de cliente diferentes receberam horas no recorte escolhido.',
    formula: 'Grupos = grupos de cliente diferentes com ao menos um lançamento',
    conta: [
      {
        rotulo: 'Grupos de cliente com hora',
        valor: inteiro(i.valor),
        numero: i.valor,
        operador: '=',
        tipo: 'total',
      },
    ],
    filtros: filtrosTimesheet(r),
    regras: [
      'Cada grupo de cliente conta uma vez.',
      'Lançamento sem grupo de cliente não entra na contagem.',
      ...regrasRecorteTimesheet(r),
    ],
    fonte: FONTE_TIMESHEET,
    fonteTecnica: 'timesheet_visao (count distinct grupo_cliente) sobre a tabela timesheets',
    detalhe: 'O ranking Por grupo, abaixo, mostra as horas de cada grupo (até 40).',
  }
}
