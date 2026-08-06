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
 */
export type MesFiltroEficiencia = number[] | null | 'resultado'

/** Primeiro mês do período "Resultado" (junho). */
export const MES_INICIO_RESULTADO = 6

export function isMesesFiltro(filtro: MesFiltroEficiencia): filtro is number[] {
  return Array.isArray(filtro)
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
  return filtro.includes(mes)
}

/** Alterna um mês no filtro (multi-seleção). Desmarcar o último volta para ano inteiro. */
export function toggleMesFiltro(current: MesFiltroEficiencia, mes: number): MesFiltroEficiencia {
  if (current == null || current === 'resultado') return [mes]
  if (current.includes(mes)) {
    const next = current.filter((m) => m !== mes)
    return next.length === 0 ? null : next
  }
  return [...current, mes].sort((a, b) => a - b)
}
