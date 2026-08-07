/** Fuso dos CSVs SharePoint / BI — datas e corte das 18h são horário de Brasília. */
export const EFICIENCIA_TZ = 'America/Sao_Paulo'

/** Áreas do escritório (mesmo De-Para usado no sync SharePoint, scripts/sharepoint/transforms.mjs). */
export const AREAS_EFICIENCIA = [
  'Cível',
  'Contratos',
  'Operações Legais',
  'Recuperação de Crédito',
  'Reestruturação',
  'Trabalhista',
] as const

/** Trabalhista não possui SLA Vistagem Normal (somente demanda de risco). */
export const EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL = 'Trabalhista' as const

/**
 * Slicer Operações Legais: Ciência Agendamentos e SLAs de Vistagem ficam sem dado (`-`),
 * como Trabalhista em Vistagem Normal — não há KPI por área nesses indicadores.
 * A aba **Ops Legais (RG)** espelha o PBIX e, por ora, **não filtra por área**.
 */
export const EFICIENCIA_AREA_SEM_FILTRO_AGENDAMENTO_VISTAGEM = 'Operações Legais' as const

/** Label da aba / PBIX — a RG não usa isso como filtro de população. */
export const EFICIENCIA_AREA_OPS_LEGAIS = 'Operações Legais' as const

export function isAgendamentoVistagemIndisponivelPorArea(area: string | null): boolean {
  return area === EFICIENCIA_AREA_SEM_FILTRO_AGENDAMENTO_VISTAGEM
}

const INDICADORES_INDISPONIVEIS_OPS_LEGAIS = new Set([
  'sla_ciencia_agendamentos',
  'sla_vistagem_risco',
  'sla_vistagem_normal',
])

/** Área efetiva por indicador (Overview, abas e Racional). Ops Legais → sem série nesses KPIs. */
export function areaFiltroParaIndicador(indicador: string, area: string | null): string | null {
  if (INDICADORES_INDISPONIVEIS_OPS_LEGAIS.has(indicador) && isAgendamentoVistagemIndisponivelPorArea(area)) {
    return null
  }
  return area
}

/** Meta D-1 do SLA Protocolo (Overview / Indicadores / sync meta_d1). */
export const EFICIENCIA_META_SLA_PROTOCOLO = 85

/**
 * Aliases de colaborador (chave normalizada → nome canônico no turnover).
 * Contas AD incompletas do SharePoint ("Membros de email@...") e abreviações.
 */
export const EFICIENCIA_NOME_ALIASES_CHAVE: Record<string, string> = {
  'MEMBROS DE CRISTIANA.COSTA@BISMARCHIPIRES.COM.BR': 'CRISTIANE PEREIRA DA COSTA',
}

/** Cargos excluídos do KPI Desenvolvimento Equipe (Overview BI). Match trim + case-insensitive. */
export const EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO = [
  'Coordenador Ops. Legais',
  'Gerente',
  'Sócio de Área',
  'Supervisor Ops. Legais',
] as const

const EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO_UPPER = new Set(
  EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO.map((c) => c.trim().toLocaleUpperCase('pt-BR')),
)

/** true se o cargo é de gestão excluído do headcount de treinamentos. */
export function isCargoExcluidoDesenvolvimento(cargo: string | null | undefined): boolean {
  if (cargo == null || !String(cargo).trim()) return false
  return EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO_UPPER.has(
    String(cargo).trim().toLocaleUpperCase('pt-BR'),
  )
}

/** Áreas excluídas da população base de Retenção no Overview (slicer BI). */
export const EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO = ['Distressd Deals', 'Tributário'] as const

/** Rótulos curtos dos meses (1 = Jan … 12 = Dez). */
export const MESES_EFICIENCIA = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** Nomes completos (UPPER) para arquivo Indicadores Resultado (ex.: JUNHO-26). */
export const MESES_EFICIENCIA_ARQUIVO = [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const

/**
 * Evidência a solicitar por justificativa excludente (aba Metodologia do Excel gerencial).
 * Chave = justificativa normalizada (trim + UPPER pt-BR).
 */
export const EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA: Record<string, string> = {
  'ATRASO NO ENVIO DE DOCUMENTAÇÃO PELO CLIENTE':
    'Fornecer a solicitação dos documentos ao cliente e a data do efetivo recebimento: e-mails/mensagens com a data do pedido, follow-ups e a data de envio pelo cliente.',
  'ATRASO NO PAGAMENTO DE GUIA PELO CLIENTE':
    'Fornecer a emissão e o envio da guia ao cliente e o pagamento em atraso: guia emitida, data de envio ao cliente e comprovante/data do pagamento.',
  'AGENDADO PELO SISTEMA EM DIA ANTERIOR':
    'Fornecer o agendamento automático: print/registro do sistema com data e hora de geração da tarefa e do prazo.',
  'AGENDADO EM 5 DIAS CORRIDOS - QUARTA/QUINTA':
    'Fornecer a regra de agendamento (5 dias corridos): registro do sistema com a data de abertura e o cálculo do prazo.',
  'PRAZO DE 24/48HRS':
    'Fornecer a contagem do prazo de 24/48h: registro do recebimento da demanda e o marco inicial da contagem.',
  'EXCLUDENTE DE FATAL - VALIDADO POR OPS. LEGAIS':
    'Fornecer a validação de Ops. Legais: registro/aprovação que fundamentou a exclusão do FATAL.',
}

/** Fração da amostra por estrato (Área × Justificativa). */
export const EFICIENCIA_AMOSTRA_FRACAO = 0.3

/**
 * Filtro de mês do Overview.
 * - `null` — ano inteiro
 * - `number[]` — um ou mais meses (1..12), ordenados
 * - `'resultado'` — jun+ fechados (mês corrente fora; jan–mai em branco)
 * - `'semana_passada'` / `'semana_retrasada'` — semana civil seg–dom (BRT)
 */
export type MesFiltroEficiencia =
  | number[]
  | null
  | 'resultado'
  | 'semana_passada'
  | 'semana_retrasada'

/** Primeiro mês do período "Resultado" (junho). */
export const MES_INICIO_RESULTADO = 6

export function isMesesFiltro(filtro: MesFiltroEficiencia): filtro is number[] {
  return Array.isArray(filtro)
}

export function isSemanaFiltro(
  filtro: MesFiltroEficiencia,
): filtro is 'semana_passada' | 'semana_retrasada' {
  return filtro === 'semana_passada' || filtro === 'semana_retrasada'
}

function civilPartsBrt(ref: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EFICIENCIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(ref).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday ?? 'Mon'] ?? 1,
  }
}

function addCivilDays(year: number, month: number, day: number, delta: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta))
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  }
}

function toIsoCivil(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Intervalo [inicio, fimExclusivo) da semana civil (segunda–domingo) em BRT.
 * Semana passada = semana completa anterior à atual; retrasada = a anterior a essa.
 */
export function rangeSemanaFiltro(
  filtro: 'semana_passada' | 'semana_retrasada',
  ref = new Date(),
): { inicio: string; fimExclusivo: string; label: string } {
  const p = civilPartsBrt(ref)
  const daysFromMonday = p.weekday === 0 ? 6 : p.weekday - 1
  const thisMonday = addCivilDays(p.year, p.month, p.day, -daysFromMonday)
  const weeksBack = filtro === 'semana_passada' ? 1 : 2
  const start = addCivilDays(thisMonday.year, thisMonday.month, thisMonday.day, -7 * weeksBack)
  const end = addCivilDays(start.year, start.month, start.day, 7)
  const inicio = toIsoCivil(start.year, start.month, start.day)
  const fimExclusivo = toIsoCivil(end.year, end.month, end.day)
  const fimInclusivo = addCivilDays(end.year, end.month, end.day, -1)
  const fmt = (m: number, d: number) =>
    `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  const titulo = filtro === 'semana_passada' ? 'Semana passada' : 'Semana retrasada'
  return {
    inicio,
    fimExclusivo,
    label: `${titulo} (${fmt(start.month, start.day)}–${fmt(fimInclusivo.month, fimInclusivo.day)})`,
  }
}

/**
 * Último mês incluso no filtro Resultado.
 * Ano corrente: mês anterior ao atual (mês em aberto não entra).
 * Anos passados: dezembro. Ano futuro: nenhum mês (retorna 5).
 */
export function mesFimResultado(ano: number, ref = new Date()): number {
  const anoRef = ref.getFullYear()
  const mesCorrente = ref.getMonth() + 1
  if (ano < anoRef) return 12
  if (ano > anoRef) return MES_INICIO_RESULTADO - 1
  return Math.min(12, Math.max(MES_INICIO_RESULTADO - 1, mesCorrente - 1))
}

/** true se o mês entra no escopo do filtro (Acum. / racional / cards). */
export function mesNoFiltro(
  mes: number,
  filtro: MesFiltroEficiencia,
  ano?: number,
  ref = new Date(),
): boolean {
  if (filtro == null) return true
  if (filtro === 'resultado') {
    if (mes < MES_INICIO_RESULTADO) return false
    const fim = mesFimResultado(ano ?? ref.getFullYear(), ref)
    return mes <= fim
  }
  if (isSemanaFiltro(filtro)) {
    const meses = mesesEfetivosFiltro(filtro, ano ?? civilPartsBrt(ref).year, ref) ?? []
    return meses.includes(mes)
  }
  return filtro.includes(mes)
}

/** Alterna um mês no filtro (multi-seleção). Desmarcar o último volta para ano inteiro. */
export function toggleMesFiltro(current: MesFiltroEficiencia, mes: number): MesFiltroEficiencia {
  if (current == null || current === 'resultado' || isSemanaFiltro(current)) return [mes]
  if (current.includes(mes)) {
    const next = current.filter((m) => m !== mes)
    return next.length === 0 ? null : next
  }
  return [...current, mes].sort((a, b) => a - b)
}

/**
 * Lista efetiva de meses para RPCs/ranking (`null` = ano inteiro).
 * Resultado → jun…último mês fechado; array vazio = período sem mês elegível.
 */
export function mesesEfetivosFiltro(
  filtro: MesFiltroEficiencia,
  ano: number,
  ref = new Date(),
): number[] | null {
  if (filtro == null) return null
  if (filtro === 'resultado') {
    const fim = mesFimResultado(ano, ref)
    if (fim < MES_INICIO_RESULTADO) return []
    return Array.from(
      { length: fim - MES_INICIO_RESULTADO + 1 },
      (_, i) => MES_INICIO_RESULTADO + i,
    )
  }
  if (isSemanaFiltro(filtro)) {
    const { inicio, fimExclusivo } = rangeSemanaFiltro(filtro, ref)
    const start = {
      y: Number(inicio.slice(0, 4)),
      m: Number(inicio.slice(5, 7)),
    }
    const endIncl = addCivilDays(
      Number(fimExclusivo.slice(0, 4)),
      Number(fimExclusivo.slice(5, 7)),
      Number(fimExclusivo.slice(8, 10)),
      -1,
    )
    const months = new Set<number>()
    let y = start.y
    let m = start.m
    while (y < endIncl.year || (y === endIncl.year && m <= endIncl.month)) {
      if (y === ano) months.add(m)
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
    return [...months].sort((a, b) => a - b)
  }
  return filtro
}

/** Filtra série mensal pelo mesmo critério do Overview. */
export function filtrarMensalPorMesFiltro<T extends { mes: number }>(
  rows: T[],
  filtro: MesFiltroEficiencia,
  ano: number,
): T[] {
  return rows.filter((r) => mesNoFiltro(r.mes, filtro, ano))
}

/**
 * Intervalo [inicio, fimExclusivo) YYYY-MM-DD para RPCs/edge (mês, resultado, semana ou ano).
 */
export function rangePeriodoFiltro(
  ano: number,
  filtro: MesFiltroEficiencia,
  ref = new Date(),
): { inicio: string; fimExclusivo: string } {
  if (isSemanaFiltro(filtro)) {
    const r = rangeSemanaFiltro(filtro, ref)
    return { inicio: r.inicio, fimExclusivo: r.fimExclusivo }
  }
  if (filtro === 'resultado') {
    const fimMes = mesFimResultado(ano, ref)
    const inicio = `${ano}-${String(MES_INICIO_RESULTADO).padStart(2, '0')}-01`
    if (fimMes < MES_INICIO_RESULTADO) return { inicio, fimExclusivo: inicio }
    const fimExclusivo =
      fimMes === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(fimMes + 1).padStart(2, '0')}-01`
    return { inicio, fimExclusivo }
  }
  if (isMesesFiltro(filtro) && filtro.length > 0) {
    const min = Math.min(...filtro)
    const max = Math.max(...filtro)
    const inicio = `${ano}-${String(min).padStart(2, '0')}-01`
    const fimExclusivo =
      max === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(max + 1).padStart(2, '0')}-01`
    return { inicio, fimExclusivo }
  }
  return { inicio: `${ano}-01-01`, fimExclusivo: `${ano + 1}-01-01` }
}
