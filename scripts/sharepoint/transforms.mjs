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
export const JUSTIFICATIVAS_EXCLUDENTES = new Set([
  'Prazo De 24/48Hrs',
  'Agendado Em 5 Dias Corridos - Quarta/Quinta',
  'Agendado Pelo Sistema Em Dia Anterior',
  'Atraso No Envio De Documentação Pelo Cliente',
  'EXCLUDENTE DE FATAL - VALIDADO POR OPS. LEGAIS',
  'Atraso No Pagamento De Guia Pelo Cliente',
])

export function mapAreaDePara(escritorioResponsavel) {
  if (!escritorioResponsavel) return null
  return AREA_DEPARA[escritorioResponsavel.trim().toUpperCase()] ?? null
}

export function computeExcludente(justificativaFatal) {
  return JUSTIFICATIVAS_EXCLUDENTES.has((justificativaFatal ?? '').trim()) ? 'Excludente' : 'Não'
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

/** Meta de SLA de protocolo vigente na data de conclusão (coluna "Meta D-1 Por Linha"). */
export function metaD1PorData(data) {
  if (!data) return null
  const d = data instanceof Date ? data : new Date(data)
  const ano = d.getFullYear()
  const mes = d.getMonth() + 1
  if (ano >= 2026) return 90
  if (ano === 2025) {
    if (mes <= 3) return 70
    if (mes <= 6) return 80
    return 90
  }
  return null
}

/**
 * Flag "Vistado em D+1": vistado até o próximo dia útil após a disponibilização + 12h
 * (considera sábados, domingos e feriados). Retorna 'Sim' | 'Não' | null (não vistado).
 * @param {Date|null} disponibilizado  timestamp de disponibilização para vistagem
 * @param {Date|null} vistadoEm        timestamp da vistagem
 * @param {Set<string>} feriados       datas 'YYYY-MM-DD'
 */
export function computeVistadoD1(disponibilizado, vistadoEm, feriados) {
  if (!vistadoEm || !disponibilizado) return null
  const base = new Date(disponibilizado)
  base.setHours(0, 0, 0, 0)
  let proximo = null
  for (let i = 1; i <= 15; i++) {
    const teste = new Date(base)
    teste.setDate(teste.getDate() + i)
    const dow = teste.getDay() // 0=dom ... 6=sáb
    const iso = toIsoDate(teste)
    if (dow >= 1 && dow <= 5 && !feriados.has(iso)) {
      proximo = teste
      break
    }
  }
  if (!proximo) return null
  const limite = new Date(proximo)
  limite.setHours(12, 0, 0, 0)
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

/**
 * "Conclusão Completa" (tabela Nova): combina as colunas cruas "Data da Conclusão" (data)
 * e "Hora da Conclusão" (hora) do Historico/*.csv num único datetime.
 * @param {Date|null} dataConclusao  data pura (meia-noite)
 * @param {string|null} horaConclusaoStr  "HH:mm" ou "HH:mm:ss"
 */
export function computeConclusaoCompleta(dataConclusao, horaConclusaoStr) {
  if (!dataConclusao) return null
  const m = (horaConclusaoStr ?? '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  const resultado = new Date(dataConclusao)
  if (m) {
    resultado.setHours(Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0)
  } else {
    resultado.setHours(0, 0, 0, 0)
  }
  return resultado
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

  const diaPrazo = toIsoDate(dataPrazo)
  const diaConclusao = toIsoDate(conclusaoCompleta)
  if (diaConclusao > diaPrazo) return 'Fatal Quebra'
  if (diaConclusao < diaPrazo) return 'D-1'
  const segundos =
    conclusaoCompleta.getHours() * 3600 +
    conclusaoCompleta.getMinutes() * 60 +
    conclusaoCompleta.getSeconds()
  // Até 18:00:00 inclusive = D-1; 18:00:01+ = Fatal (BI considera segundos após o corte).
  return segundos <= 18 * 3600 ? 'D-1' : 'Fatal'
}

/** Nomes abreviados no CSV/VIOS → nome canônico no turnover. */
const NOME_ALIASES_CHAVE = {
  'WAGNER ARMANI': 'WAGNER JOSE PENEREIRO ARMANI',
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
 * Área do usuário na data de conclusão (colunas "Área (na conclusão)"): busca em sp_turnover
 * o registro do usuário vigente na data (admissão <= data <= desligamento, ou sem desligamento);
 * fallback: registro ativo sem desligamento. Regra fixa do BI: "CAROLINE ABDALLA" -> Trabalhista.
 * @param {string} nome
 * @param {Date|null} dataConclusao
 * @param {Array<{nome:string, area:string|null, admissao:string|null, desligamento:string|null}>} turnover
 */
export function areaNaConclusao(nome, dataConclusao, turnover) {
  let alvo = normalizeNomeChave(nome)
  if (!alvo) return null
  if (NOME_ALIASES_CHAVE[alvo]) alvo = NOME_ALIASES_CHAVE[alvo]
  if (alvo === normalizeNomeChave('CAROLINE ABDALLA')) return 'Trabalhista'
  const doUsuario = turnover.filter((t) => normalizeNomeChave(t.nome) === alvo)
  if (dataConclusao) {
    const iso = toIsoDate(dataConclusao)
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
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Converte valores vindos do SharePoint/CSV em ISO datetime ou null. */
export function toIsoDateTime(v) {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
