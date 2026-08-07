/**
 * Regras de negócio dos indicadores de Eficiência Operacional, replicadas das
 * colunas calculadas DAX do BI "DASHBOARD - EFICIÊNCIA OPERACIONAL - GERAL".
 * Usadas pelo sync (scripts/sharepoint/sync-sharepoint.mjs) para materializar
 * as flags nas tabelas sp_* do Supabase.
 */

/** De-Para de "Escritório responsável" -> área do painel (coluna Área_DePara do BI). */
export const AREA_DEPARA = {
  'CÍVEL': 'Cível',
  'CÍVEL | INSOLVÊNCIA': 'Reestruturação',
  'CONTRATOS': 'Contratos',
  'INSOLVÊNCIA': 'Reestruturação',
  'OPERAÇÕES LEGAIS': 'Operações Legais',
  'RECUPERAÇÃO DE CRÉDITO': 'Recuperação de Crédito',
  'SPECIAL SITUATIONS': 'Distressd Deals',
  'TRABALHISTA': 'Trabalhista',
  'TRIBUTÁRIO': 'Tributário',
}

/** Justificativas que tornam um FATAL "Excludente" (coluna Excludente do BI). */
export const JUSTIFICATIVAS_EXCLUDENTES = [
  'Prazo De 24/48Hrs',
  'Agendado Em 5 Dias Corridos - Quarta/Quinta',
  'Agendado Pelo Sistema Em Dia Anterior',
  'Atraso No Envio De Documentação Pelo Cliente',
  'EXCLUDENTE DE FATAL - VALIDADO POR OPS. LEGAIS',
  'Atraso No Pagamento De Guia Pelo Cliente',
]

/** Match case-insensitive — SharePoint costuma gravar a justificativa em UPPERCASE. */
const JUSTIFICATIVAS_EXCLUDENTES_UPPER = new Set(
  JUSTIFICATIVAS_EXCLUDENTES.map((j) => j.trim().toLocaleUpperCase('pt-BR')),
)

export function mapAreaDePara(escritorioResponsavel) {
  if (!escritorioResponsavel) return null
  return AREA_DEPARA[escritorioResponsavel.trim().toUpperCase()] ?? null
}

export function computeExcludente(justificativaFatal) {
  const key = (justificativaFatal ?? '').trim().toLocaleUpperCase('pt-BR')
  return key && JUSTIFICATIVAS_EXCLUDENTES_UPPER.has(key) ? 'Excludente' : 'Não'
}

/** Colunas "Fatal apos 18" / "Fatal sem 18" (tabela Nova): Fatal|Fatal Quebra -> FATAL; Pendente mantém; senão D-1. */
export function mapFatalHistorico(adesao) {
  const a = (adesao ?? '').trim()
  if (a === 'Fatal' || a === 'Fatal Quebra') return 'FATAL'
  if (a === 'Pendente') return 'Pendente'
  return 'D-1'
}

/**
 * Coluna "Fatal sem 18 D+1" (tabela Tarefas): normaliza a adesão para os rótulos do painel.
 * Nota: o BI usa "Dentro do prazo" com "p" minúsculo (mas "Fora do Prazo" com "P" maiúsculo) —
 * mantido literal aqui para bater com os dados históricos já carregados via seed.
 */
export function mapFatalTarefas(adesao) {
  const a = (adesao ?? '').trim().toLowerCase()
  const mapa = {
    'fora do prazo': 'Fora do Prazo',
    'dentro do prazo': 'Dentro do prazo',
    pendente: 'Pendente',
    cancelado: 'Cancelado',
    iniciado: 'Iniciado',
  }
  return mapa[a] ?? null
}

/**
 * Coluna "EFICIÊNCIA" do BI Ops Legais (Power Query em BASE-PROTOCOLOS /
 * CONTROLE DE PROTOCOLOS) — renomeada de "Status do SLA Final".
 *
 * Regras (mesma ordem do M):
 * 1) DATA DO FATAL ou PROTOCOLADO EM nulos → "Dados Incompletos"
 * 2) Criado no dia anterior ao FATAL após 18h BRT → "ENVIADO NO FATAL"
 * 3) Criado >= DATA DO FATAL → "ENVIADO NO FATAL"
 * 4) DATA DO FATAL <= PROTOCOLADO EM (date = meia-noite BRT) → "PROTOCOLADO NO FATAL"
 * 5) Criado e PROTOCOLADO EM antes do FATAL → "D1"
 * 6) senão → "D1"
 *
 * % D1 do BI = COUNTROWS(EFICIÊNCIA="D1") / COUNTROWS(BASE-PROTOCOLOS)
 *
 * @param {Date|null} criado
 * @param {Date|null} dataDoFatal
 * @param {Date|null} protocoladoEm  data pura (meia-noite BRT) ou datetime
 */
export function computeEficienciaSlaProtocolo(criado, dataDoFatal, protocoladoEm) {
  if (!dataDoFatal || !protocoladoEm || !criado) return 'Dados Incompletos'
  if (
    Number.isNaN(criado.getTime()) ||
    Number.isNaN(dataDoFatal.getTime()) ||
    Number.isNaN(protocoladoEm.getTime())
  ) {
    return 'Dados Incompletos'
  }

  const criadoP = getDatePartsBrt(criado)
  const fatalP = getDatePartsBrt(dataDoFatal)
  const protP = getDatePartsBrt(protocoladoEm)

  const fatalDayStart = dateFromCivilBrt(fatalP.year, fatalP.month, fatalP.day, 0, 0, 0)
  const dayBeforeFatal = new Date(fatalDayStart.getTime() - 24 * 60 * 60 * 1000)
  const beforeP = getDatePartsBrt(dayBeforeFatal)
  const criadoNoDiaAnterior =
    criadoP.year === beforeP.year &&
    criadoP.month === beforeP.month &&
    criadoP.day === beforeP.day

  if (criadoNoDiaAnterior && criadoP.hour >= 18) return 'ENVIADO NO FATAL'
  if (criado.getTime() >= dataDoFatal.getTime()) return 'ENVIADO NO FATAL'

  // PROTOCOLADO EM no PQ é Date → meia-noite do dia civil (BRT).
  const protocoladoStart = dateFromCivilBrt(protP.year, protP.month, protP.day, 0, 0, 0)
  if (dataDoFatal.getTime() <= protocoladoStart.getTime()) return 'PROTOCOLADO NO FATAL'

  if (
    criado.getTime() < dataDoFatal.getTime() &&
    protocoladoStart.getTime() < dataDoFatal.getTime()
  ) {
    return 'D1'
  }
  return 'D1'
}

/**
 * Coluna "EFICIÊNCIA" do BI Ops Legais (BASE-PUBLICAÇÕES-BKP).
 * Sem INCONSISTÊNCIAS - TIPO e sem INCONSISTÊNCIA - SUBTIPO → "EFICIÊNCIA DE PUBLICAÇÃO";
 * caso contrário → "DESVIO".
 *
 * @param {string|null|undefined} inconsistenciasTipo
 * @param {string|null|undefined} inconsistenciaSubtipo
 */
export function computeEficienciaPublicacao(inconsistenciasTipo, inconsistenciaSubtipo) {
  const tipo = (inconsistenciasTipo ?? '').trim()
  const subtipo = (inconsistenciaSubtipo ?? '').trim()
  if (!tipo && !subtipo) return 'EFICIÊNCIA DE PUBLICAÇÃO'
  return 'DESVIO'
}

/** Meta de SLA de protocolo vigente na data de conclusão (coluna "Meta D-1 Por Linha"). */
export function metaD1PorData(data) {
  if (!data) return null
  const d = data instanceof Date ? data : new Date(data)
  if (Number.isNaN(d.getTime())) return null
  const { year: ano, month: mes } = getDatePartsBrt(d)
  if (ano >= 2026) return 85
  if (ano === 2025) {
    if (mes <= 3) return 70
    if (mes <= 6) return 80
    return 85
  }
  return null
}

/** Hora-limite no dia útil D+1 (horário de Brasília), alinhada ao BI. */
const VISTADO_D1_LIMITE_HORA_BRT = 12

/** Dia da semana (0=dom … 6=sáb) do dia civil em America/Sao_Paulo. */
function weekdayBrt(year, month, day) {
  const instant = dateFromCivilBrt(year, month, day, 12, 0, 0)
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: EFICIENCIA_TZ,
    weekday: 'short',
  }).format(instant)
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[label] ?? 0
}

/**
 * Flag "Vistado em D+1": vistado até 12h do próximo dia útil após a disponibilização
 * (considera sábados, domingos e feriados). Retorna 'Sim' | 'Não' | null (não vistado).
 * Sempre interpreta dias/horas em America/Sao_Paulo (sync no GitHub Actions roda em UTC).
 * @param {Date|null} disponibilizado  timestamp de disponibilização para vistagem
 * @param {Date|null} vistadoEm        timestamp da vistagem
 * @param {Set<string>} feriados       datas 'YYYY-MM-DD'
 */
export function computeVistadoD1(disponibilizado, vistadoEm, feriados) {
  if (!vistadoEm || !disponibilizado) return null

  const baseIso = toIsoDateBrt(disponibilizado)
  if (!baseIso) return null
  const [by, bm, bd] = baseIso.split('-').map(Number)
  const baseNoon = dateFromCivilBrt(by, bm, bd, 12, 0, 0)

  let proximoIso = null
  for (let i = 1; i <= 15; i++) {
    const testInstant = new Date(baseNoon.getTime() + i * 86_400_000)
    const iso = toIsoDateBrt(testInstant)
    if (!iso) continue
    const [y, m, d] = iso.split('-').map(Number)
    const dow = weekdayBrt(y, m, d)
    if (dow >= 1 && dow <= 5 && !feriados.has(iso)) {
      proximoIso = iso
      break
    }
  }

  if (!proximoIso) return null
  const [py, pm, pd] = proximoIso.split('-').map(Number)
  const limite = dateFromCivilBrt(py, pm, pd, VISTADO_D1_LIMITE_HORA_BRT, 0, 0)
  return vistadoEm <= limite ? 'Sim' : 'Não'
}

/**
 * Coluna "Adesão sem 18" (tabela Tarefas): não existe crua no Tarefas.csv, é calculada no BI.
 * Regras (coluna calculada "Adesão sem 18"):
 *   Status Cancelada -> "Cancelado"; Iniciado -> "Iniciado"; Aberta -> "Pendente";
 *   sem data prazo/conclusão -> null;
 *   senão: dentro/fora do prazo comparando a conclusão com o próximo dia útil após o prazo
 *   (janela de até 10 dias, pulando fins de semana e feriados).
 * @param {string} status
 * @param {Date|null} dataPrazo
 * @param {Date|null} dataConclusao
 * @param {Set<string>} feriados datas 'YYYY-MM-DD'
 */
export function computeAdesaoSem18(status, dataPrazo, dataConclusao, feriados) {
  if (status === 'Cancelada') return 'Cancelado'
  if (status === 'Iniciado') return 'Iniciado'
  if (status === 'Aberta') return 'Pendente'
  if (!dataPrazo || !dataConclusao) return null

  const base = new Date(dataPrazo)
  base.setHours(0, 0, 0, 0)
  let proximo = null
  for (let i = 1; i <= 10; i++) {
    const teste = new Date(base)
    teste.setDate(teste.getDate() + i)
    const dow = teste.getDay()
    const iso = toIsoDate(teste)
    if (dow >= 1 && dow <= 5 && !feriados.has(iso)) {
      proximo = teste
      break
    }
  }
  if (!proximo) return null
  const conclusaoData = new Date(dataConclusao)
  conclusaoData.setHours(0, 0, 0, 0)
  return conclusaoData <= proximo ? 'Dentro do prazo' : 'Fora do prazo'
}

/** Fuso dos CSVs de eficiência (SharePoint / BI) — corte das 18h é horário de Brasília. */
export const EFICIENCIA_TZ = 'America/Sao_Paulo'

/** BRT = UTC−3 (sem horário de verão desde 2019). */
const BRT_UTC_OFFSET_HOURS = 3

/**
 * Instante UTC correspondente a uma data/hora civil em Brasília.
 * Ex.: 31/07/2026 18:02:09 BRT → 2026-07-31T21:02:09.000Z
 */
export function dateFromCivilBrt(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour + BRT_UTC_OFFSET_HOURS, minute, second))
}

/** Partes de calendário/relógio em America/Sao_Paulo. */
export function getDatePartsBrt(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EFICIENCIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Dia civil YYYY-MM-DD em horário de Brasília. */
export function toIsoDateBrt(d) {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return null
  const p = getDatePartsBrt(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * Data pura dd/MM/yyyy (ou Date do Excel) interpretada como dia civil em Brasília.
 * Evita deslocamento quando o sync roda em UTC (GitHub Actions).
 */
export function parseDateOnlyBrt(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    const iso = toIsoDate(v)
    if (!iso) return null
    const [y, m, d] = iso.split('-').map(Number)
    return dateFromCivilBrt(y, m, d, 0, 0, 0)
  }
  const s = String(v).trim()
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return dateFromCivilBrt(+br[3], +br[2], +br[1], 0, 0, 0)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * "Conclusão Completa" (tabela Nova): combina as colunas cruas "Data da Conclusão" (data)
 * e "Hora da Conclusão" (hora) do Historico/*.csv num único datetime.
 * @param {Date|null} dataConclusao  data pura (meia-noite BRT)
 * @param {string|null} horaConclusaoStr  "HH:mm" ou "HH:mm:ss" (horário de Brasília)
 */
export function computeConclusaoCompleta(dataConclusao, horaConclusaoStr) {
  if (!dataConclusao) return null
  const isoDay = toIsoDateBrt(dataConclusao)
  if (!isoDay) return null
  const [y, m, d] = isoDay.split('-').map(Number)
  const hm = (horaConclusaoStr ?? '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (hm) {
    return dateFromCivilBrt(y, m, d, Number(hm[1]), Number(hm[2]), Number(hm[3] ?? 0))
  }
  return dateFromCivilBrt(y, m, d, 0, 0, 0)
}

/**
 * Coluna "Adesão Apos 18" (tabela Nova): compara o DIA da conclusão com o dia do prazo,
 * e a hora da conclusão com o corte das 18h quando concluído no mesmo dia do prazo.
 *   - Concluiu depois do dia do prazo -> "Fatal Quebra"
 *   - Concluiu no mesmo dia do prazo, até 18h -> "D-1"; após 18h -> "Fatal"
 *   - Concluiu antes do dia do prazo -> "D-1"
 * @param {string} status
 * @param {Date|null} dataPrazo
 * @param {Date|null} conclusaoCompleta  data+hora (ver computeConclusaoCompleta)
 */
export function computeAdesaoApos18(status, dataPrazo, conclusaoCompleta) {
  if (status === 'Cancelada') return 'Cancelado'
  if (status === 'Iniciado') return 'Iniciado'
  if (status === 'Aberta') return 'Pendente'
  if (!dataPrazo || !conclusaoCompleta) return null

  const diaPrazo = toIsoDateBrt(dataPrazo)
  const diaConclusao = toIsoDateBrt(conclusaoCompleta)
  if (diaConclusao > diaPrazo) return 'Fatal Quebra'
  if (diaConclusao < diaPrazo) return 'D-1'
  const { hour, minute, second } = getDatePartsBrt(conclusaoCompleta)
  const segundos = hour * 3600 + minute * 60 + second
  // Até 18:00:00 inclusive = D-1; 18:00:01+ = Fatal (BI considera segundos após o corte).
  return segundos <= 18 * 3600 ? 'D-1' : 'Fatal'
}

/**
 * Aliases de nome (chave normalizada → nome canônico no turnover).
 * Inclui contas AD incompletas do SharePoint no formato "Membros de email@...".
 */
export const NOME_ALIASES_CHAVE = {
  'WAGNER ARMANI': 'WAGNER JOSE PENEREIRO ARMANI',
  // Conta AD incompleta — lista de presença usa o e-mail do grupo, não o display name.
  'MEMBROS DE CRISTIANA.COSTA@BISMARCHIPIRES.COM.BR': 'CRISTIANE PEREIRA DA COSTA',
}

/** Chave de match turnover: sem acento, caixa alta, espaços colapsados. */
export function normalizeNomeChave(nome) {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

/**
 * Remove prefixo de conta desativada no SharePoint ("Ex Func Nome" → "Nome").
 * Contas desligadas não casam com o turnover se o prefixo permanecer.
 */
export function stripExFuncPrefix(nome) {
  if (nome == null) return null
  const trimmed = String(nome).trim()
  if (!trimmed) return null
  const stripped = trimmed.replace(/^ex\s+func\.?\s+/i, '').trim()
  return stripped || null
}

/**
 * Resolve alias → nome canônico (para gravar em sp_* e casar com turnover).
 * Sem alias, devolve o nome trimado original.
 */
export function resolveNomeCanonico(nome) {
  if (nome == null) return null
  const original = String(nome).trim()
  if (!original) return null
  const alias = NOME_ALIASES_CHAVE[normalizeNomeChave(original)]
  return alias ?? original
}

/**
 * Área do usuário na data de conclusão (colunas "Área (na conclusão)"): busca em sp_turnover
 * o registro do usuário vigente na data (admissão <= data <= desligamento, ou sem desligamento);
 * fallback: registro ativo sem desligamento. Regra fixa do BI: "CAROLINE ABDALLA" -> Trabalhista.
 * @param {string} nome
 * @param {Date|null} dataConclusao
 * @param {Array<{nome:string, area:string|null, admissao:string|null, desligamento:string|null}>} turnover
 */
export function areaNaConclusao(nome, dataConclusao, turnover) {
  const nomeLookup = stripExFuncPrefix(nome) ?? nome
  let alvo = normalizeNomeChave(resolveNomeCanonico(nomeLookup) ?? nomeLookup)
  if (!alvo) return null
  if (alvo === normalizeNomeChave('CAROLINE ABDALLA')) return 'Trabalhista'
  const doUsuario = turnover.filter((t) => normalizeNomeChave(t.nome) === alvo)
  if (dataConclusao) {
    const iso = toIsoDateBrt(dataConclusao)
    const vigente = doUsuario.find(
      (t) => t.admissao && t.admissao <= iso && (!t.desligamento || t.desligamento >= iso),
    )
    if (vigente?.area) return vigente.area
  }
  const ativo = doUsuario.find((t) => !t.desligamento)
  return ativo?.area ?? null
}

export function toIsoDate(d) {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return null
  // UTC: datas do Excel/SheetJS vêm como meia-noite UTC do dia civil;
  // getDate() local (BRT) atrasava 1 dia (ex.: 19/10 → 18/10).
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Converte valores vindos do SharePoint/CSV em ISO datetime ou null. */
export function toIsoDateTime(v) {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Coluna "Número" de Processos Lista.csv (VIOS).
 * Exemplos: "CNJ: 0000000-00.0000.0.00.0000", "Outros: 1670653/2026", "ADI: …".
 * Devolve o valor limpo (após o prefixo) para exibir no lugar do Nro CNJ quando este vier vazio.
 */
export function parseNumeroProcessoLista(valor) {
  if (valor == null) return null
  const raw = String(valor).trim()
  if (!raw) return null
  const m = raw.match(/^([^:]+):\s*(.+)$/)
  if (m) {
    const numero = m[2].trim()
    if (!numero) return null
    return { tipo: m[1].trim(), numero, raw }
  }
  return { tipo: null, numero: raw, raw }
}
