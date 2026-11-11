/**
 * Fênix na Eficiência Operacional (abas operacionais e Overview) e nas telas de
 * Operações Legais que usam os mesmos componentes (Overview, SLA Protocolo,
 * Eficiência Publicações, Eficiência no Cadastro, Retenção de Talentos).
 *
 * Funções puras. Recebem as mesmas quantidades que o card ou a célula usou para
 * chegar ao número (nada é recalculado por outro caminho), então a memória de
 * cálculo sempre fecha com a tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatPercent } from '../../../shared/utils/format.ts'
import {
  EFICIENCIA_META_AGENDAMENTO,
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_NPS,
  EFICIENCIA_META_OPS_CADASTRO,
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_INICIATIVAS,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  EFICIENCIA_META_PDI,
  EFICIENCIA_META_SLA_PROTOCOLO,
  EFICIENCIA_META_VISTAGEM,
  EFICIENCIA_NPS_MES_INICIO,
  MESES_EFICIENCIA,
  MES_INICIO_RESULTADO,
  OPS_LEGAIS_CADASTRO_CONTROLADORIA,
  OPS_LEGAIS_CADASTRO_TIPOS_ABERTURA,
  filtroEfetivoGestaoAVista,
  isDiaFiltro,
  isMesesFiltro,
  isSemanaFiltro,
  mesesEfetivosFiltro,
  rangeDiaFiltro,
  rangeSemanaFiltro,
  type MesFiltroEficiencia,
} from '../constants.ts'

// ---------------------------------------------------------------------------
// Formatação e período
// ---------------------------------------------------------------------------

const pct = (v: number) => formatPercent(v)

function int(n: number): string {
  return n.toLocaleString('pt-BR')
}

/** Minutos → "h:mm" (mesmo formato das células de Desenvolvimento). */
export function horasMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function nomeMes(mes: number): string {
  return MESES_EFICIENCIA[mes - 1] ?? String(mes)
}

/** Ex.: "Out/26". */
export function rotuloMesAno(ano: number, mes: number): string {
  return `${nomeMes(mes)}/${String(ano).slice(-2)}`
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/** Ex.: "Jun–Out/2026", "Mar/2026" ou "Mar, Mai e Jul/2026". */
export function periodoMesesTexto(ano: number, meses: readonly number[]): string {
  const s = [...new Set(meses)].sort((a, b) => a - b)
  if (s.length === 0) return `nenhum mês de ${ano}`
  if (s.length === 1) return `${nomeMes(s[0])}/${ano}`
  const contiguo = s.every((m, i) => i === 0 || m === s[i - 1] + 1)
  if (contiguo) return `${nomeMes(s[0])}–${nomeMes(s[s.length - 1])}/${ano}`
  return `${listaComE(s.map(nomeMes))}/${ano}`
}

/** Texto do filtro de meses como a pessoa escolheu na tela. */
export function descreverFiltroMes(
  ano: number,
  filtro: MesFiltroEficiencia,
  hoje: Date = new Date(),
): string {
  if (filtro == null) return `ano inteiro (${ano})`
  if (filtro === 'resultado') {
    const meses = mesesEfetivosFiltro(filtro, ano, hoje) ?? []
    return meses.length > 0
      ? `Resultado: ${periodoMesesTexto(ano, meses)} (meses fechados desde junho)`
      : 'Resultado (nenhum mês fechado desde junho)'
  }
  if (filtro === 'resultado_ytd') {
    const meses = mesesEfetivosFiltro(filtro, ano, hoje) ?? []
    return meses.length > 0
      ? `Resultado do ano: ${periodoMesesTexto(ano, meses)} (meses fechados)`
      : 'Resultado do ano (nenhum mês fechado)'
  }
  if (isSemanaFiltro(filtro)) return rangeSemanaFiltro(hoje).label
  if (isDiaFiltro(filtro)) return `dias ${rangeDiaFiltro(filtro).label}`
  return periodoMesesTexto(ano, filtro)
}

const REGRA_ONBOARDING =
  'Clientes em onboarding (cadastrados nas exclusões de onboarding do painel) ficam fora durante o período de vigência da exclusão.'

const REGRA_SOMA_NAO_MEDIA =
  'Soma as quantidades de todos os meses do período e divide no fim: não é a média dos percentuais de cada mês.'

const REGRA_PERIODO_CURTO =
  'Filtro por semana ou por dias: a conta é feita item a item na mesma base do Racional, só com as datas do intervalo.'

const FONTE_HISTORICO_VIOS =
  'Histórico de tarefas concluídas exportado do VIOS (pasta Bases Atualizacoes do Núcleo de Cadastro, no SharePoint da Controladoria), sincronizado no SIOE.'

const FONTE_TAREFAS_VIOS =
  'Tarefas concluídas exportadas do VIOS (arquivo Tarefas.csv na pasta Bases Atualizacoes do Núcleo de Cadastro, no SharePoint da Controladoria), sincronizadas no SIOE.'

const FONTE_PROTOCOLOS = 'Lista de protocolos do SharePoint, sincronizada no SIOE.'

const FONTE_PUBLICACOES =
  'Lista de vistagem de publicações (BKP) do SharePoint e, desde nov/2026, a Central de Vistagem do Orquestra, gravadas na base de publicações do SIOE.'

const FONTE_TURNOVER =
  'Base de colaboradores (planilha Turnover BP, em Gestão/Indicadores Jurídico no SharePoint da Controladoria), sincronizada no SIOE.'

// ---------------------------------------------------------------------------
// Indicadores de razão (X de Y): Jurídico e Operações Legais
// ---------------------------------------------------------------------------

export type IndicadorRazao =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'ops_legais_sla_protocolo'
  | 'ops_legais_eficiencia_protocolo'
  | 'ops_legais_pub_analise'
  | 'ops_legais_pub_agendamento'
  | 'ops_legais_cadastro'

type SpecRazao = {
  nome: string
  /** Tela da aba própria do indicador. */
  tela: string
  /** Começo do resumo: "Percentual de …". */
  oQueE: string
  ok: string
  nok: string
  total: string
  formula: string
  meta: number
  /** Texto da meta, quando não é um número fixo. */
  regraMeta?: string
  regras: readonly string[]
  /** Coluna de pessoa do filtro de responsável. */
  pessoa?: string
  /** false = indicador sem filtro de área (Operações Legais). */
  temArea: boolean
  fonte: string
  fonteTecnica: string
  /** Onde ver item a item na aba própria. */
  detalhe: string
}

const DETALHE_RACIONAL_ABA =
  'Para ver item a item, feche o Fênix e clique em "Racional" no gráfico de evolução desta aba.'
const DETALHE_RACIONAL_OVERVIEW =
  'Para ver item a item, feche o Fênix e clique em "Racional" ao lado da linha.'
const DETALHE_RACIONAL_OPS =
  'Para ver item a item, feche o Fênix e clique em "Racional" acima do card ou no gráfico.'

const VISTAGEM_REGRAS_COMUNS = [
  'Conta cada publicação pela data em que foi disponibilizada para vistagem. Só entram publicações já vistadas (com "Vistado por" e data da vistagem preenchidos).',
  'No prazo (D+1): vistada até 12h do próximo dia útil depois da disponibilização, no horário de Brasília. Sábados, domingos e feriados não contam como dia útil.',
  'Área = escritório responsável da publicação, pelo De-Para do painel (Cível | Insolvência e Insolvência viram Reestruturação; Special Situations vira Distressed Deals).',
] as const

const SPECS: Record<IndicadorRazao, SpecRazao> = {
  sla_protocolo: {
    nome: 'SLA de Protocolo',
    tela: 'Eficiência › SLA Protocolo',
    oQueE: 'Percentual dos prazos de protocolo concluídos no prazo D-1',
    ok: 'No prazo (D-1)',
    nok: 'FATAL',
    total: 'Prazos na conta (D-1 + FATAL)',
    formula: 'SLA de Protocolo = prazos concluídos no D-1 ÷ (D-1 + FATAL) × 100',
    meta: EFICIENCIA_META_SLA_PROTOCOLO,
    regraMeta:
      'Meta D-1 vigente na data da conclusão: 85% em 2026 (em 2025 foi 70% de jan a mar, 80% de abr a jun e 85% de jul em diante).',
    regras: [
      'Entram os prazos de protocolo concluídos no VIOS (tarefas com etiqueta PROTOCOLO), pela data e hora da conclusão. Cada prazo (CI) conta uma vez.',
      'D-1 (no prazo): concluído antes do dia do prazo, ou no próprio dia até 18h05 (horário de Brasília). FATAL: concluído no dia do prazo depois de 18h05, ou depois do dia do prazo.',
      'Prazo com justificativa de fatal excludente sai da conta (não é D-1 nem FATAL): prazo de 24/48h, agendado em 5 dias corridos (quarta/quinta), agendado pelo sistema em dia anterior, atraso do cliente no envio de documentos ou no pagamento de guia, excludente validado por Ops. Legais e prazo não peremptório.',
      'Área = área de quem concluiu a tarefa na data da conclusão (base de colaboradores). Operações Legais e Tributário ficam fora.',
      'Ficam fora as tarefas de material de marketing e de due diligence de prospect.',
      REGRA_ONBOARDING,
    ],
    pessoa: 'quem concluiu a tarefa',
    temArea: true,
    fonte: FONTE_HISTORICO_VIOS,
    fonteTecnica:
      'Supabase › eficiencia_sla_protocolo_mensal sobre sp_tarefas_historico (fatal_apos18, excludente e meta_d1 calculados no sync: scripts/sharepoint/transforms.mjs)',
    detalhe: DETALHE_RACIONAL_ABA,
  },
  eficiencia_protocolo: {
    nome: 'Eficiência de Protocolo',
    tela: 'Eficiência › Eficiência Protocolo',
    oQueE: 'Percentual dos pedidos de protocolo enviados sem inconsistência jurídica',
    ok: 'Sem inconsistência',
    nok: 'Com inconsistência',
    total: 'Pedidos de protocolo',
    formula: 'Eficiência de Protocolo = pedidos sem inconsistência ÷ pedidos de protocolo × 100',
    meta: EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
    regras: [
      'Entram os pedidos de protocolo da lista do SharePoint, pela data em que o pedido foi criado.',
      'Sem inconsistência: o campo "Inconsistência - Jurídico" está vazio. Qualquer valor nesse campo conta como inconsistência.',
      'Área = área de quem criou o pedido (coluna de área da lista ou, se vazia, a área da pessoa na data, pela base de colaboradores). Operações Legais e Tributário ficam fora.',
      REGRA_ONBOARDING,
    ],
    pessoa: 'quem criou o pedido de protocolo',
    temArea: true,
    fonte: FONTE_PROTOCOLOS,
    fonteTecnica:
      'Supabase › eficiencia_protocolo_mensal sobre sp_protocolos (status_inconsistencia calculado no sync a partir de INCONSISTÊNCIA - JURÍDICO)',
    detalhe: DETALHE_RACIONAL_ABA,
  },
  sla_ciencia_agendamentos: {
    nome: 'SLA Ciência Agendamentos',
    tela: 'Eficiência › SLA Ciência Agendamentos',
    oQueE: 'Percentual das tarefas de ciência dos agendamentos concluídas no prazo (D+1 útil)',
    ok: 'Ciência no prazo (D+1)',
    nok: 'Fora do prazo',
    total: 'Tarefas de ciência concluídas',
    formula: 'SLA Ciência = tarefas concluídas no prazo ÷ tarefas concluídas × 100',
    meta: EFICIENCIA_META_AGENDAMENTO,
    regras: [
      'Entram as tarefas "1. CIÊNCIA DOS AGENDAMENTOS" concluídas no VIOS, pela data de conclusão. Cada tarefa (CI) conta uma vez.',
      'No prazo: concluída até o próximo dia útil depois da data do prazo (sábados, domingos e feriados não contam). Depois disso, fora do prazo.',
      'Área = área de quem concluiu a tarefa na data da conclusão (base de colaboradores). Tributário fica fora; para Operações Legais o indicador não se aplica.',
      'Só tarefas concluídas estão na base: prazo ainda aberto não entra na conta.',
      REGRA_ONBOARDING,
    ],
    pessoa: 'quem concluiu a tarefa',
    temArea: true,
    fonte: FONTE_TAREFAS_VIOS,
    fonteTecnica:
      'Supabase › eficiencia_agendamento_mensal sobre sp_tarefas (fatal_sem18_d1 calculado no sync: computeAdesaoSem18 em scripts/sharepoint/transforms.mjs)',
    detalhe: DETALHE_RACIONAL_ABA,
  },
  sla_vistagem_risco: {
    nome: 'SLA Vistagem Risco',
    tela: 'Eficiência › SLA Vistagem Risco',
    oQueE: 'Percentual das publicações de demanda de risco vistadas até o D+1',
    ok: 'Vistadas até o D+1',
    nok: 'Vistadas depois do D+1',
    total: 'Publicações vistadas',
    formula: 'SLA Vistagem Risco = publicações vistadas até o D+1 ÷ publicações vistadas × 100',
    meta: EFICIENCIA_META_VISTAGEM,
    regras: [
      ...VISTAGEM_REGRAS_COMUNS,
      'Demanda de risco: publicações com "Demanda de Risco" diferente de "Não" (inclui as sem marcação). Operações Legais fica fora.',
      'Contratos sem nenhuma publicação de risco no período aparece com 100%: o indicador vale para a área e não houve caso.',
      REGRA_ONBOARDING,
    ],
    pessoa: 'quem vistou a publicação',
    temArea: true,
    fonte: FONTE_PUBLICACOES,
    fonteTecnica:
      'Supabase › eficiencia_sla_vistagem_mensal (p_risco = true) sobre sp_publicacoes (vistado_d1 calculado no sync: computeVistadoD1 em scripts/sharepoint/transforms.mjs)',
    detalhe: DETALHE_RACIONAL_ABA,
  },
  sla_vistagem_normal: {
    nome: 'SLA Vistagem Normal',
    tela: 'Eficiência › SLA Vistagem Normal',
    oQueE: 'Percentual das publicações de demanda comum vistadas até o D+1',
    ok: 'Vistadas até o D+1',
    nok: 'Vistadas depois do D+1',
    total: 'Publicações vistadas',
    formula: 'SLA Vistagem Normal = publicações vistadas até o D+1 ÷ publicações vistadas × 100',
    meta: EFICIENCIA_META_VISTAGEM,
    regras: [
      ...VISTAGEM_REGRAS_COMUNS,
      'Demanda comum: só publicações com "Demanda de Risco" = "Não". Trabalhista (que só tem demanda de risco), Distressed Deals, Operações Legais e Tributário ficam fora.',
      REGRA_ONBOARDING,
    ],
    pessoa: 'quem vistou a publicação',
    temArea: true,
    fonte: FONTE_PUBLICACOES,
    fonteTecnica:
      'Supabase › eficiencia_sla_vistagem_mensal (p_risco = false) sobre sp_publicacoes (vistado_d1 calculado no sync: computeVistadoD1 em scripts/sharepoint/transforms.mjs)',
    detalhe: DETALHE_RACIONAL_ABA,
  },
  ops_legais_sla_protocolo: {
    nome: 'SLA Protocolo',
    tela: 'Operações Legais › SLA Protocolo',
    oQueE: 'Percentual dos protocolos feitos antes do dia do fatal (D1)',
    ok: 'D1 (antes do dia do fatal)',
    nok: 'Protocolado no fatal',
    total: 'Protocolos na régua (D1 + no fatal)',
    formula: 'SLA Protocolo = protocolos D1 ÷ (D1 + protocolados no fatal) × 100',
    meta: EFICIENCIA_META_OPS_SLA_PROTOCOLO,
    regras: [
      'Conta cada protocolo da lista de protocolos pela data em que foi protocolado (PROTOCOLADO EM). Cancelados ficam fora.',
      'Só entram protocolos com EFICIÊNCIA OPERACIONAL = SIM.',
      'D1: protocolado antes do dia do fatal. Protocolado no fatal: protocolado no próprio dia do fatal ou depois.',
      'Ficam fora da régua os pedidos que chegaram à equipe já no dia do fatal (ou depois das 18h da véspera) e os pedidos sem data do fatal ou sem data de protocolo.',
      'Conta os protocolos de todas as áreas: este indicador não tem filtro de área.',
      'Na visão por mês, clientes em onboarding ficam fora durante a vigência da exclusão.',
    ],
    temArea: false,
    fonte: FONTE_PROTOCOLOS,
    fonteTecnica:
      'Supabase › eficiencia_ops_legais_protocolo_mensal (bloco sla) sobre sp_protocolos (eficiencia_sla calculada no sync: computeEficienciaSlaProtocolo em scripts/sharepoint/transforms.mjs)',
    detalhe: DETALHE_RACIONAL_OPS,
  },
  ops_legais_eficiencia_protocolo: {
    nome: 'Eficiência Protocolo',
    tela: 'Operações Legais › SLA Protocolo',
    oQueE: 'Percentual dos protocolos sem inconsistência apontada pela controladoria',
    ok: 'Sem inconsistência',
    nok: 'Com inconsistência',
    total: 'Protocolos feitos',
    formula: 'Eficiência Protocolo = protocolos sem inconsistência da controladoria ÷ protocolos feitos × 100',
    meta: EFICIENCIA_META_OPS_EFICIENCIA,
    regras: [
      'Conta cada protocolo da lista de protocolos pela data em que foi protocolado (PROTOCOLADO EM). Cancelados ficam fora.',
      'Sem inconsistência: o campo "Inconsistência - Controladoria" está vazio. Só o motivo preenchido, sem a inconsistência, não conta.',
      'Entram todos os protocolos feitos, com ou sem EFICIÊNCIA OPERACIONAL marcada.',
      'Conta os protocolos de todas as áreas: este indicador não tem filtro de área.',
      'Na visão por mês, clientes em onboarding ficam fora durante a vigência da exclusão.',
    ],
    temArea: false,
    fonte: FONTE_PROTOCOLOS,
    fonteTecnica: 'Supabase › eficiencia_ops_legais_protocolo_mensal (bloco efi) sobre sp_protocolos',
    detalhe: DETALHE_RACIONAL_OPS,
  },
  ops_legais_pub_analise: {
    nome: 'Eficiência Análise de Publicação',
    tela: 'Operações Legais › Eficiência Publicações',
    oQueE: 'Percentual das publicações analisadas sem desvio',
    ok: 'Eficiência de publicação',
    nok: 'Desvio',
    total: 'Publicações na conta',
    formula: 'Análise de Publicação = publicações sem desvio ÷ publicações na conta × 100',
    meta: EFICIENCIA_META_OPS_PUBLICACOES,
    regras: [
      'Conta cada publicação pela data de recebimento no Kurier.',
      'Entram as publicações sem inconsistência e as com inconsistência do tipo Análise (as de Agendamento ficam no outro indicador).',
      'Fica fora Trabalhista com Demanda de Risco = Sim.',
      'Eficiência de publicação: sem tipo e sem subtipo de inconsistência. Qualquer um dos dois preenchido conta como desvio.',
      'Conta todas as áreas: este indicador não tem filtro de área.',
    ],
    temArea: false,
    fonte: FONTE_PUBLICACOES,
    fonteTecnica:
      "Supabase › eficiencia_ops_legais_publicacoes_efic_mensal (p_escopo = 'analise') sobre sp_publicacoes",
    detalhe: DETALHE_RACIONAL_OPS,
  },
  ops_legais_pub_agendamento: {
    nome: 'Eficiência Agendamento',
    tela: 'Operações Legais › Eficiência Publicações',
    oQueE: 'Percentual das publicações agendadas sem desvio',
    ok: 'Eficiência de publicação',
    nok: 'Desvio',
    total: 'Publicações na conta',
    formula: 'Agendamento de Publicação = publicações sem desvio ÷ publicações na conta × 100',
    meta: EFICIENCIA_META_OPS_PUBLICACOES,
    regras: [
      'Conta cada publicação pela data de recebimento no Kurier.',
      'Entram as publicações sem inconsistência e as com inconsistência do tipo Agendamento (as de Análise ficam no outro indicador).',
      'Eficiência de publicação: sem tipo e sem subtipo de inconsistência. Qualquer um dos dois preenchido conta como desvio.',
      'Conta todas as áreas: este indicador não tem filtro de área.',
    ],
    temArea: false,
    fonte: FONTE_PUBLICACOES,
    fonteTecnica:
      "Supabase › eficiencia_ops_legais_publicacoes_efic_mensal (p_escopo = 'agendamento') sobre sp_publicacoes",
    detalhe: DETALHE_RACIONAL_OPS,
  },
  ops_legais_cadastro: {
    nome: 'Eficiência no Cadastro',
    tela: 'Operações Legais › Eficiência no Cadastro',
    oQueE: 'Percentual dos cadastros da controladoria em conformidade',
    ok: 'Em conformidade',
    nok: 'Inconsistências',
    total: 'Cadastros da controladoria',
    formula: 'Eficiência no Cadastro = cadastros em conformidade ÷ cadastros da controladoria × 100',
    meta: EFICIENCIA_META_OPS_CADASTRO,
    regras: [
      'Conta cada solicitação da lista de agendamentos pela data da solicitação.',
      `Só os tipos ${listaComE([...OPS_LEGAIS_CADASTRO_TIPOS_ABERTURA])}.`,
      `Só os cadastros feitos pela controladoria da operação (${listaComE(
        OPS_LEGAIS_CADASTRO_CONTROLADORIA.map((n) => n.split(' ')[0]!),
      )}), pelo nome em "Agendado por".`,
      'Em conformidade: "Adesão ao Indicador" vazio ou "SEM ADESÃO". Qualquer outro valor é inconsistência.',
    ],
    temArea: false,
    fonte: 'Lista de agendamentos (cadastro de pastas) do SharePoint, sincronizada no SIOE.',
    fonteTecnica:
      'Supabase › eficiencia_ops_legais_cadastro_mensal sobre sp_agendamento (eficiencia_ops_legais_cadastro_depara_ok)',
    detalhe: DETALHE_RACIONAL_OPS,
  },
}

/** Textos do indicador (para o gráfico inteiro e os rankings). */
export function infoIndicador(indicador: IndicadorRazao): {
  nome: string
  tela: string
  ok: string
  nok: string
  total: string
  formula: string
  meta: number
  regras: readonly string[]
  pessoa?: string
  temArea: boolean
  fonte: string
  fonteTecnica: string
} {
  const s = SPECS[indicador]
  return {
    nome: s.nome,
    tela: s.tela,
    ok: s.ok,
    nok: s.nok,
    total: s.total,
    formula: s.formula,
    meta: s.meta,
    regras: s.regras,
    pessoa: s.pessoa,
    temArea: s.temArea,
    fonte: s.fonte,
    fonteTecnica: s.fonteTecnica,
  }
}

export type FenixMesContagem = { mes: number; ok: number; total: number }

/** Como o número do período foi apurado. */
export type FenixOrigemPeriodo = 'mensal' | 'periodo_curto' | 'responsavel'

export type FenixEscopoRazao = 'gestao_a_vista' | 'periodo' | 'overview' | 'mes'

export type RazaoInput = {
  indicador: IndicadorRazao
  ano: number
  /**
   * gestao_a_vista: card fixo jun→mês atual; periodo: card do período selecionado;
   * overview: coluna Acum.; mes: célula de um mês.
   */
  escopo: FenixEscopoRazao
  /** Tela onde o número está (padrão: a aba do indicador). */
  tela?: string
  /** Título do card (padrão: nome do indicador + escopo). */
  titulo?: string
  area?: string | null
  mesFiltro?: MesFiltroEficiencia
  /** Só no escopo `mes`. */
  mes?: number
  origem?: FenixOrigemPeriodo
  responsavel?: string | null
  /** Numerador (no prazo / sem inconsistência). */
  ok: number
  /** Denominador. */
  total: number
  /** Percentual exibido (null quando o card mostra "—"). */
  pct: number | null
  /** Texto exatamente como na tela (padrão: formatPercent). */
  valor?: string
  /** Quantidades por mês que somam ok e total (só quando o número vem da série mensal). */
  meses?: readonly FenixMesContagem[]
  meta?: number | null
  /** Motivo de o indicador não existir no filtro (ex.: Operações Legais). */
  indisponivel?: string | null
  /** Contratos sem publicação de risco: regra de 100%. */
  contratosSemCasos?: boolean
  /** Regras próprias da tela (entram depois das do indicador). */
  regrasExtras?: readonly string[]
  /** Escopo `mes` num ponto diário (drill-down do gráfico): dia do mês `mes`. */
  dia?: number
  /**
   * O percentual chegou pronto, sem as quantidades (ex.: ponto do gráfico com filtro de
   * responsável). O texto explica por quê; a conta mostra só o percentual.
   */
  semContagem?: string
  /** Só o denominador é conhecido (apuração diária traz total e %). */
  semNumerador?: boolean
  detalhe?: string
  hoje?: Date
}

/** Ex.: "05/11/2026". */
export function rotuloDia(ano: number, mes: number, dia: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

function periodoDoEscopo(
  escopo: FenixEscopoRazao,
  ano: number,
  mesFiltro: MesFiltroEficiencia | undefined,
  mes: number | undefined,
  hoje: Date,
): string {
  if (escopo === 'gestao_a_vista') return periodoMesesTexto(ano, filtroEfetivoGestaoAVista(ano, hoje))
  if (escopo === 'mes') return `${nomeMes(mes ?? 1)}/${ano}`
  return descreverFiltroMes(ano, mesFiltro ?? null, hoje)
}

function tituloRazao(s: SpecRazao, escopo: FenixEscopoRazao, mes?: number, ano?: number): string {
  if (escopo === 'gestao_a_vista') return `${s.nome} · Gestão a Vista`
  if (escopo === 'overview') return `${s.nome} · Acum.`
  if (escopo === 'mes') return `${s.nome} · ${rotuloMesAno(ano ?? 0, mes ?? 1)}`
  return `${s.nome} no período selecionado`
}

function filtrosBase(
  ano: number,
  periodoRotulo: string,
  periodo: string,
  temArea: boolean,
  area: string | null | undefined,
): FenixFiltro[] {
  const f: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(ano) },
    { rotulo: periodoRotulo, valor: periodo },
  ]
  if (temArea) f.push({ rotulo: 'Área', valor: area ?? 'Todas' })
  return f
}

function linhasPorMes(ano: number, meses: readonly FenixMesContagem[], ok: number, total: number): FenixLinha[] {
  const comCaso = meses.filter((m) => m.total > 0).sort((a, b) => a.mes - b.mes)
  if (comCaso.length < 2) return []
  const somaOk = comCaso.reduce((s, m) => s + m.ok, 0)
  const somaTotal = comCaso.reduce((s, m) => s + m.total, 0)
  // Só mostra a abertura quando ela fecha com o total do card.
  if (somaOk !== ok || somaTotal !== total) return []
  return comCaso.map((m) => {
    const v = (m.ok / m.total) * 100
    return {
      rotulo: rotuloMesAno(ano, m.mes),
      valor: pct(v),
      numero: v,
      tipo: 'info' as const,
      detalhe: `${int(m.ok)} de ${int(m.total)}`,
    }
  })
}

/** Percentual "X de Y" de um indicador operacional (card, Acum. ou célula do mês). */
export function explicarRazao(i: RazaoInput): FenixExplicacao {
  const s = SPECS[i.indicador]
  const hoje = i.hoje ?? new Date()
  const valor = i.valor ?? (i.pct == null ? '—' : pct(i.pct))
  const ehDia = i.escopo === 'mes' && i.dia != null
  const periodo = ehDia
    ? rotuloDia(i.ano, i.mes ?? 1, i.dia!)
    : periodoDoEscopo(i.escopo, i.ano, i.mesFiltro, i.mes, hoje)
  const tela = i.tela ?? s.tela
  const titulo = i.titulo ?? (ehDia ? `${s.nome} · ${periodo}` : tituloRazao(s, i.escopo, i.mes, i.ano))
  const gav = i.escopo === 'gestao_a_vista'
  const responsavel = i.responsavel?.trim() || null

  const filtros = filtrosBase(
    i.ano,
    gav ? 'Período (fixo)' : ehDia ? 'Dia' : i.escopo === 'mes' ? 'Mês' : 'Período',
    periodo,
    s.temArea,
    i.area,
  )
  if (responsavel) {
    filtros.push({
      rotulo: 'Responsável',
      valor: gav ? `${responsavel} (não se aplica: card da equipe)` : responsavel,
    })
  }

  const areaTexto = s.temArea ? (i.area ? `, área ${i.area}` : ', todas as áreas') : ''
  const quem = responsavel && !gav ? `, só de ${responsavel}` : ''
  const quando = gav
    ? `de ${periodo} (junho até o mês atual)`
    : i.escopo === 'mes'
      ? `em ${periodo}`
      : `no período: ${periodo}`

  if (i.indisponivel) {
    return {
      tela,
      titulo,
      valor,
      resumo: i.indisponivel,
      formula: s.formula,
      filtros,
      regras: [...s.regras],
      fonte: s.fonte,
      fonteTecnica: s.fonteTecnica,
    }
  }

  const regras: string[] = [...s.regras]
  if (gav) {
    regras.push(
      'Período fixo: de junho até o mês atual (o mês em andamento entra com o que já aconteceu). O filtro de meses não muda este card.',
    )
    if (responsavel) {
      regras.push(
        'O filtro de responsável não muda este card: é sempre o número da equipe, para comparar com o card do período.',
      )
    }
    regras.push(REGRA_SOMA_NAO_MEDIA)
  } else if (i.escopo === 'periodo' || i.escopo === 'overview') {
    if (i.origem === 'periodo_curto') regras.push(REGRA_PERIODO_CURTO)
    else regras.push(REGRA_SOMA_NAO_MEDIA)
  }
  if (!gav && responsavel && s.pessoa) {
    regras.push(`Com filtro de responsável, entram só os itens em que ${s.pessoa} é ${responsavel}.`)
  }
  regras.push(...(i.regrasExtras ?? []))
  const meta = i.meta ?? s.meta
  if (s.regraMeta) {
    const qualMeta =
      i.escopo === 'overview'
        ? ' Na coluna Acum. vale a menor meta entre os meses do período.'
        : i.escopo === 'mes'
          ? ` ${ehDia ? 'O ponto usa a meta do mês' : 'A célula usa a meta do próprio mês'} (${pct(meta)}).`
          : ` O card usa a meta do último mês do período (${pct(meta)}).`
    regras.push(`${s.regraMeta}${qualMeta}`)
  } else {
    regras.push(`Meta: ${pct(meta)}.`)
  }

  let conta: FenixLinha[]
  if (i.semContagem) {
    conta = [
      {
        rotulo: s.nome,
        valor,
        numero: i.pct ?? undefined,
        tipo: 'total',
        detalhe: i.semContagem,
      },
    ]
  } else if (i.semNumerador) {
    conta = [
      { rotulo: s.total, valor: int(i.total), numero: i.total, tipo: 'info', detalhe: 'quantidade do dia' },
      {
        rotulo: s.nome,
        valor,
        numero: i.pct ?? undefined,
        tipo: 'total',
        detalhe: `${s.ok.toLowerCase()} ÷ ${s.total.toLowerCase()} × 100, como vem da apuração diária`,
      },
    ]
  } else if (i.contratosSemCasos) {
    conta = [
      { rotulo: s.total, valor: '0', numero: 0 },
      {
        rotulo: s.nome,
        valor,
        numero: i.pct ?? 100,
        operador: '=',
        tipo: 'total',
        detalhe: 'Contratos sem publicação de risco no período: vale 100%',
      },
    ]
  } else if (i.total <= 0) {
    conta = [
      {
        rotulo: s.total,
        valor: '0',
        numero: 0,
        tipo: 'info',
        detalhe: 'sem casos no período: não há percentual para calcular',
      },
    ]
  } else {
    const nok = i.total - i.ok
    conta = [
      { rotulo: s.ok, valor: int(i.ok), numero: i.ok },
      { rotulo: s.total, valor: int(i.total), numero: i.total, operador: '÷' },
      {
        rotulo: s.nome,
        valor,
        numero: i.pct ?? (i.ok / i.total) * 100,
        operador: '=',
        tipo: 'total',
        detalhe: '× 100',
      },
      {
        rotulo: s.nok,
        valor: int(nok),
        numero: nok,
        tipo: 'info',
        detalhe: `${pct((nok / i.total) * 100)} do total`,
      },
      ...(i.escopo === 'mes' ? [] : linhasPorMes(i.ano, i.meses ?? [], i.ok, i.total)),
    ]
  }

  const detalhe =
    i.detalhe ?? (i.escopo === 'overview' || (i.escopo === 'mes' && !ehDia) ? DETALHE_RACIONAL_OVERVIEW : s.detalhe)

  return {
    tela,
    titulo,
    valor,
    resumo: `${s.oQueE}, ${quando}${areaTexto}${quem}.`,
    formula: s.formula,
    conta,
    filtros,
    regras,
    fonte: s.fonte,
    fonteTecnica: s.fonteTecnica,
    detalhe,
  }
}

export type ContagemInput = {
  indicador: IndicadorRazao
  ano: number
  titulo: string
  tela?: string
  area?: string | null
  mesFiltro?: MesFiltroEficiencia
  origem?: FenixOrigemPeriodo
  responsavel?: string | null
  /** O card mostra o total ou a parte fora (FATAL, fora do prazo). */
  mostra: 'total' | 'nok'
  ok: number
  total: number
  /** Texto do card (ex.: "128"). */
  valor?: string
  /** FATAL excludentes (SLA Protocolo): fora da conta. */
  excludentes?: number
  indisponivel?: string | null
  hoje?: Date
}

/** Cards de quantidade do período (FATAL, protocolos, fora do prazo, publicações). */
export function explicarContagem(i: ContagemInput): FenixExplicacao {
  const s = SPECS[i.indicador]
  const hoje = i.hoje ?? new Date()
  const nok = i.total - i.ok
  const numero = i.mostra === 'total' ? i.total : nok
  const valor = i.valor ?? String(numero)
  const periodo = descreverFiltroMes(i.ano, i.mesFiltro ?? null, hoje)
  const responsavel = i.responsavel?.trim() || null
  const filtros = filtrosBase(i.ano, 'Período', periodo, s.temArea, i.area)
  if (responsavel) filtros.push({ rotulo: 'Responsável', valor: responsavel })

  const rotulo = i.mostra === 'total' ? s.total : s.nok
  const areaTexto = s.temArea ? (i.area ? `, área ${i.area}` : ', todas as áreas') : ''
  const quem = responsavel ? `, só de ${responsavel}` : ''

  if (i.indisponivel) {
    return {
      tela: i.tela ?? s.tela,
      titulo: i.titulo,
      valor,
      resumo: i.indisponivel,
      filtros,
      regras: [...s.regras],
      fonte: s.fonte,
      fonteTecnica: s.fonteTecnica,
    }
  }

  const conta: FenixLinha[] =
    i.mostra === 'total'
      ? [
          { rotulo: s.ok, valor: int(i.ok), numero: i.ok },
          { rotulo: s.nok, valor: int(nok), numero: nok, operador: '+' },
          { rotulo, valor: int(i.total), numero: i.total, operador: '=', tipo: 'total' },
        ]
      : [
          { rotulo: s.total, valor: int(i.total), numero: i.total },
          { rotulo: s.ok, valor: int(i.ok), numero: i.ok, operador: '−' },
          { rotulo, valor: int(nok), numero: nok, operador: '=', tipo: 'total' },
        ]
  if (i.excludentes != null) {
    conta.push({
      rotulo: 'Excludentes (fora da conta)',
      valor: int(i.excludentes),
      numero: i.excludentes,
      tipo: 'info',
      detalhe: 'FATAL com justificativa excludente: não entram no total nem no FATAL',
    })
  }

  const regras = [...s.regras]
  if (i.origem === 'periodo_curto') regras.push(REGRA_PERIODO_CURTO)
  else regras.push('Soma as quantidades de todos os meses do período selecionado.')
  if (responsavel && s.pessoa) {
    regras.push(`Com filtro de responsável, entram só os itens em que ${s.pessoa} é ${responsavel}.`)
  }

  return {
    tela: i.tela ?? s.tela,
    titulo: i.titulo,
    valor,
    resumo: `${rotulo} no período: ${periodo}${areaTexto}${quem}.`,
    formula:
      i.mostra === 'total'
        ? `${rotulo} = ${s.ok} + ${s.nok}`
        : `${rotulo} = ${s.total} − ${s.ok}`,
    conta,
    filtros,
    regras,
    fonte: s.fonte,
    fonteTecnica: s.fonteTecnica,
    detalhe: s.detalhe,
  }
}

/** Card "Eficiência x Desvio" de Operações Legais (% em destaque + quantidades). */
export function explicarEficDesvio(i: {
  indicador: IndicadorRazao
  ano: number
  mesFiltro: MesFiltroEficiencia
  origem: FenixOrigemPeriodo
  ok: number
  nok: number
  meses?: readonly FenixMesContagem[]
  hoje?: Date
}): FenixExplicacao {
  const total = i.ok + i.nok
  const p = total > 0 ? (i.ok / total) * 100 : 0
  const s = SPECS[i.indicador]
  const exp = explicarRazao({
    indicador: i.indicador,
    ano: i.ano,
    escopo: 'periodo',
    mesFiltro: i.mesFiltro,
    origem: i.origem,
    ok: i.ok,
    total,
    pct: total > 0 ? p : null,
    valor: pct(p),
    meses: i.meses,
    titulo: `${s.nome} · Eficiência x Desvio`,
    hoje: i.hoje,
  })
  return {
    ...exp,
    regras: [
      ...(exp.regras ?? []),
      `O card mostra os dois lados: "${s.ok}" e "${s.nok}" somam 100% do total.`,
    ],
  }
}

// ---------------------------------------------------------------------------
// Desenvolvimento (treinamentos)
// ---------------------------------------------------------------------------

export type DesenvolvimentoInput = {
  tela: string
  titulo?: string
  ano: number
  area: string | null
  mesFiltro: MesFiltroEficiencia
  /** ano: total do ano; meses: soma dos meses do filtro; periodo_curto: treinamentos no intervalo. */
  modo: 'ano' | 'meses' | 'periodo_curto'
  minutos: number
  metaMinutos: number
  pessoas?: number | null
  pct: number | null
  valor: string
  /** Minutos por mês (modo `meses`). */
  meses?: readonly { mes: number; minutos: number }[]
  /** Eficiência › Overview: Resultado continua anual. */
  resultadoAnual?: boolean
  hoje?: Date
}

export function explicarDesenvolvimento(i: DesenvolvimentoInput): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const conta: FenixLinha[] = []
  const meses = (i.meses ?? []).filter((m) => m.minutos !== 0).sort((a, b) => a.mes - b.mes)
  if (i.modo === 'meses' && meses.length > 1) {
    meses.forEach((m, idx) =>
      conta.push({
        rotulo: rotuloMesAno(i.ano, m.mes),
        valor: horasMinutos(m.minutos),
        numero: m.minutos,
        operador: idx === 0 ? undefined : '+',
        detalhe: 'minutos lançados no mês',
      }),
    )
    conta.push({
      rotulo: 'Horas no período',
      valor: horasMinutos(i.minutos),
      numero: i.minutos,
      operador: '=',
      tipo: 'total',
    })
  } else {
    conta.push({
      rotulo: i.modo === 'ano' ? 'Horas lançadas no ano' : 'Horas lançadas no período',
      valor: horasMinutos(i.minutos),
      numero: i.minutos,
    })
  }
  if (i.metaMinutos > 0) {
    conta.push({
      rotulo: `Meta do ano${i.pessoas ? ` (${i.pessoas} pessoas)` : ''}`,
      valor: horasMinutos(i.metaMinutos),
      numero: i.metaMinutos,
      operador: '÷',
      detalhe: 'soma das metas individuais',
    })
    if (i.pct != null) {
      conta.push({
        rotulo: 'Atingimento',
        valor: pct(i.pct),
        numero: i.pct,
        operador: '=',
        tipo: 'total',
        detalhe: '× 100',
      })
    }
  }

  const regras = [
    'Soma as horas da lista de presença dos treinamentos de quem continua ativo no fim do ano (quem saiu no próprio ano fica fora, com as horas). Cargos de gestão ficam fora (Coordenador e Supervisor de Ops. Legais, Gerente e Sócio de Área).',
    'Meta: 14h por pessoa no ano, proporcional aos meses de casa (admissão depois do dia 15 conta a partir do mês seguinte). A meta do grupo é a soma das metas de cada pessoa.',
    'Mudança de área (transferência) não reinicia a contagem dos meses: vale a entrada no vínculo atual.',
    i.area
      ? `Área = área atual da pessoa na base de colaboradores (${i.area}).`
      : 'Área = área atual da pessoa na base de colaboradores. Sem filtro de área, Tributário fica fora.',
  ]
  if (i.modo === 'ano') {
    regras.push('Acum. do ano: horas do ano inteiro ÷ meta anual.')
    if (i.resultadoAnual && i.mesFiltro === 'resultado') {
      regras.push('No filtro Resultado este indicador continua anual: o Acum. não recorta meses.')
    }
  } else if (i.modo === 'meses') {
    regras.push(
      'Com meses selecionados, soma as horas desses meses e divide pela meta do ano inteiro. Por isso um mês sozinho fica baixo: a fatia mensal da meta é 8,33%.',
    )
  } else {
    regras.push(
      'Com filtro de semana ou de dias, soma só os treinamentos com data no intervalo e divide pela meta do ano inteiro.',
    )
  }

  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(i.ano) },
    { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
    { rotulo: 'Área', valor: i.area ?? 'Todas' },
  ]

  return {
    tela: i.tela,
    titulo: i.titulo ?? 'Desenvolvimento Equipe · Acum.',
    valor: i.valor,
    resumo: 'Horas de treinamento lançadas comparadas com a meta de 14h por pessoa no ano (proporcional ao tempo de casa).',
    formula: 'Atingimento = horas de treinamento lançadas ÷ meta do ano × 100',
    conta,
    filtros,
    regras,
    fonte:
      'Lista de presença dos treinamentos (SharePoint) e base de colaboradores (planilha Turnover BP), sincronizadas no SIOE.',
    fonteTecnica:
      'Supabase › eficiencia_treinamentos_anual e eficiencia_treinamentos_mensal sobre sp_treinamentos_presenca e sp_turnover (meta: eficiencia_treinamentos_meta_minutos_pessoa)',
    detalhe: DETALHE_RACIONAL_OVERVIEW,
  }
}

// ---------------------------------------------------------------------------
// Retenção / turnover
// ---------------------------------------------------------------------------

export type TurnoverInput = {
  tela: string
  ano: number
  area: string | null
  /** Número que o card mostra. */
  foco: 'retencao' | 'ativos' | 'saidas'
  titulo?: string
  ativos: number
  saidas: number
  pctRetencao: number
  meta: number
  valor?: string
  detalhe?: string
}

const REGRAS_TURNOVER = [
  'Ativos: pessoas da base de colaboradores admitidas até o ano e sem desligamento até o fim do ano. Quem saiu no próprio ano não entra nesse número.',
  'Saídas: desligamentos do tipo Voluntário no ano. Involuntários e transferências de área não contam.',
  'Indicador anual: o filtro de meses não muda o número.',
] as const

export function explicarTurnover(i: TurnoverInput): FenixExplicacao {
  const taxaSaida = 100 - i.pctRetencao
  const areaRegra = i.area
    ? `Área = área da pessoa na base de colaboradores (${i.area}).`
    : 'Sem filtro de área entram todas as áreas da base (inclusive Distressed Deals e Tributário).'
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(i.ano) },
    { rotulo: 'Área', valor: i.area ?? 'Todas' },
  ]
  const base = {
    tela: i.tela,
    filtros,
    fonte: FONTE_TURNOVER,
    fonteTecnica: 'Supabase › eficiencia_turnover_anual sobre sp_turnover',
    detalhe: i.detalhe,
  }

  if (i.foco === 'ativos') {
    return {
      ...base,
      titulo: i.titulo ?? 'Ativos',
      valor: i.valor ?? String(i.ativos),
      resumo: `Pessoas ativas na base de colaboradores no fim de ${i.ano}: o divisor da Retenção.`,
      formula: 'Ativos = admitidos até o ano e sem desligamento até o fim do ano',
      conta: [{ rotulo: 'Funcionários ativos', valor: int(i.ativos), numero: i.ativos, tipo: 'total' }],
      regras: [...REGRAS_TURNOVER, areaRegra],
    }
  }
  if (i.foco === 'saidas') {
    return {
      ...base,
      titulo: i.titulo ?? 'Saídas voluntárias',
      valor: i.valor ?? String(i.saidas),
      resumo: `Pedidos de desligamento (voluntários) registrados em ${i.ano}.`,
      formula: 'Saídas voluntárias = desligamentos do tipo Voluntário no ano',
      conta: [
        { rotulo: 'Saídas voluntárias', valor: int(i.saidas), numero: i.saidas, tipo: 'total' },
        {
          rotulo: 'Sobre os ativos',
          valor: i.ativos > 0 ? pct((i.saidas / i.ativos) * 100) : '—',
          numero: i.ativos > 0 ? (i.saidas / i.ativos) * 100 : undefined,
          tipo: 'info',
          detalhe: `${int(i.saidas)} ÷ ${int(i.ativos)} ativos`,
        },
      ],
      regras: [...REGRAS_TURNOVER, areaRegra],
    }
  }

  return {
    ...base,
    titulo: i.titulo ?? 'Retenção de Talentos',
    valor: i.valor ?? pct(i.pctRetencao),
    resumo: `Quanto da equipe ficou em ${i.ano}: 100% menos a taxa de saídas voluntárias.`,
    formula: 'Retenção = 100% − saídas voluntárias ÷ funcionários ativos × 100',
    conta: [
      { rotulo: 'Saídas voluntárias no ano', valor: int(i.saidas), numero: i.saidas },
      { rotulo: 'Funcionários ativos', valor: int(i.ativos), numero: i.ativos, operador: '÷' },
      {
        rotulo: 'Taxa de saída voluntária',
        valor: pct(taxaSaida),
        numero: taxaSaida,
        operador: '=',
        detalhe: '× 100',
      },
      {
        rotulo: 'Retenção',
        valor: i.valor ?? pct(i.pctRetencao),
        numero: i.pctRetencao,
        operador: '=',
        tipo: 'total',
        detalhe: '100% − taxa de saída',
      },
    ],
    regras: [...REGRAS_TURNOVER, areaRegra, `Meta: retenção mínima de ${pct(i.meta)}.`],
  }
}

// ---------------------------------------------------------------------------
// Gestão de PDI
// ---------------------------------------------------------------------------

export function explicarGestaoPdi(i: {
  tela: string
  ano: number
  area: string | null
  mesFiltro: MesFiltroEficiencia
  meses: readonly { mes: number; aptas: number; elegiveis: number }[]
  pct: number | null
  valor: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const meses = [...i.meses].filter((m) => m.elegiveis > 0).sort((a, b) => a.mes - b.mes)
  const aptas = meses.reduce((s, m) => s + m.aptas, 0)
  const elegiveis = meses.reduce((s, m) => s + m.elegiveis, 0)
  const conta: FenixLinha[] =
    elegiveis > 0
      ? [
          { rotulo: 'Pessoas aptas', valor: int(aptas), numero: aptas },
          { rotulo: 'Pessoas elegíveis', valor: int(elegiveis), numero: elegiveis, operador: '÷' },
          {
            rotulo: 'Gestão de PDI',
            valor: i.valor,
            numero: i.pct ?? (aptas / elegiveis) * 100,
            operador: '=',
            tipo: 'total',
            detalhe: '× 100',
          },
          ...meses.map((m) => ({
            rotulo: rotuloMesAno(i.ano, m.mes),
            valor: `${int(m.aptas)}/${int(m.elegiveis)}`,
            numero: m.aptas,
            tipo: 'info' as const,
            detalhe: m.mes === 6 ? 'junho: base, todos aptos' : 'aptas/elegíveis no mês',
          })),
        ]
      : [{ rotulo: 'Pessoas elegíveis', valor: '0', numero: 0, tipo: 'info', detalhe: 'sem avaliação no período' }]

  return {
    tela: i.tela,
    titulo: 'Gestão de PDI · Acum.',
    valor: i.valor,
    resumo: 'Percentual das pessoas com PDI em dia: aptas sobre elegíveis, somando os meses do período.',
    formula: 'Gestão de PDI = soma das pessoas aptas ÷ soma das pessoas elegíveis × 100',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
      { rotulo: 'Área', valor: i.area ?? 'Todas' },
    ],
    regras: [
      'Cada pessoa elegível ao PDI conta uma vez por mês, pela planilha de acompanhamento de PDI.',
      'Junho é a base do indicador: todos contam como aptos (100%).',
      'De julho em diante, apta = o progresso do PDI mudou em relação ao mês anterior, a evidência de execução é "Sim" e houve pelo menos um 1:1 no mês.',
      'Só entram no percentual as linhas com evidência, 1:1 e progresso preenchidos. Quem não ficou apta só conta como desvio quando o critério de apuração do desvio está preenchido.',
      'Uma colaboradora em licença-maternidade está fora do indicador desde set/2026.',
      REGRA_SOMA_NAO_MEDIA,
      `Meta: ${pct(EFICIENCIA_META_PDI)}.`,
    ],
    fonte: 'Planilha de acompanhamento de PDI (elegíveis e desvios) no SharePoint da Controladoria, sincronizada no SIOE.',
    fonteTecnica:
      'Supabase › eficiencia_gestao_pdi_mensal → eficiencia_gestao_pdi_avaliacao sobre sp_gestao_pdi_elegiveis e sp_gestao_pdi_desvios · acumuladoGestaoPdi (utils/gestaoPdiCalc.ts)',
    detalhe: DETALHE_RACIONAL_OVERVIEW,
  }
}

// ---------------------------------------------------------------------------
// Financeiro no Overview (Receita Bruta e Índice de Inadimplência)
// ---------------------------------------------------------------------------

/** Mesmo critério de buildOverviewReceitaBruta: um mês, vários meses/Resultado ou o ano. */
export function modoReceitaBruta(filtro: MesFiltroEficiencia): 'mes' | 'meses' | 'ano' {
  if (isMesesFiltro(filtro) && filtro.length === 1) return 'mes'
  if ((isMesesFiltro(filtro) && filtro.length > 1) || filtro === 'resultado') return 'meses'
  return 'ano'
}

export function explicarReceitaBruta(i: {
  ano: number
  mesFiltro: MesFiltroEficiencia
  recebido: number
  meta: number
  pct: number | null
  valor: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const modo = modoReceitaBruta(i.mesFiltro)
  const moeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const regraModo =
    modo === 'mes'
      ? 'Um mês escolhido: recebido do mês ÷ meta do mês já ajustada com o que faltou nos meses anteriores, como no painel da Receita.'
      : modo === 'meses'
        ? 'Vários meses (ou Resultado): soma do recebido ÷ soma das metas ajustadas desses meses, de junho em diante.'
        : 'Sem mês escolhido: recebido dos meses com meta que já começaram ÷ meta do ano inteiro (todos os meses com meta). O percentual cresce ao longo do ano.'
  const conta: FenixLinha[] =
    i.meta > 0
      ? [
          { rotulo: 'Recebido', valor: moeda(i.recebido), numero: i.recebido },
          {
            rotulo: modo === 'ano' ? 'Meta do ano' : 'Meta do período',
            valor: moeda(i.meta),
            numero: i.meta,
            operador: '÷',
          },
          {
            rotulo: 'Receita Bruta',
            valor: i.valor,
            numero: i.pct ?? (i.recebido / i.meta) * 100,
            operador: '=',
            tipo: 'total',
            detalhe: '× 100',
          },
        ]
      : [{ rotulo: 'Meta', valor: moeda(0), numero: 0, tipo: 'info', detalhe: 'sem meta no período' }]
  return {
    tela: 'Eficiência › Overview',
    titulo: 'Receita Bruta · Acum.',
    valor: i.valor,
    resumo: 'Quanto da meta de receita do escritório já entrou no caixa.',
    formula: 'Receita Bruta = recebido ÷ meta × 100',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
      { rotulo: 'Área', valor: 'Escritório (o filtro de área não muda este número)' },
    ],
    regras: [
      regraModo,
      `Só conta de ${nomeMes(MES_INICIO_RESULTADO).toLowerCase()} em diante, quando começa a meta de receita.`,
      'O recebido segue as regras da Receita: honorários da cota, pela data de pagamento, sem encargos de boleto e juros.',
      'Indicador do escritório: o filtro de área do Overview não muda este número.',
      'Meta: 100% da meta de receita.',
    ],
    fonte: 'Financeiro do VIOS (títulos a receber) e meta mensal das Configurações da Receita: os mesmos números do painel da Receita.',
    fonteTecnica:
      'buildOverviewReceitaBruta e receitaBrutaMonetarioAcumulado (eficiencia/utils/overviewFinanceiroKpis.ts) · calcularAtingimentoMetaKpi · receita_totais_mensais',
    detalhe: 'Para ver título a título, abra o painel da Receita.',
  }
}

export function explicarInadimplencia(i: {
  ano: number
  mesFiltro: MesFiltroEficiencia
  /** Meses que entraram na conta (jun+ no filtro, até o mês atual). */
  meses: readonly number[]
  inadimplencia: number
  previsto: number
  pct: number
  valor: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const moeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  return {
    tela: 'Eficiência › Overview',
    titulo: 'Índice de Inadimplência · Acum.',
    valor: i.valor,
    resumo: `Quanto da receita prevista de ${periodoMesesTexto(i.ano, i.meses)} está vencido e não pago hoje. Menor é melhor.`,
    formula: 'Índice de inadimplência = saldo inadimplente hoje ÷ receita prevista do período × 100',
    conta: [
      { rotulo: 'Saldo inadimplente hoje', valor: moeda(i.inadimplencia), numero: i.inadimplencia },
      { rotulo: 'Receita prevista do período', valor: moeda(i.previsto), numero: i.previsto, operador: '÷' },
      { rotulo: 'Índice de inadimplência', valor: i.valor, numero: i.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
      { rotulo: 'Meses na conta', valor: periodoMesesTexto(i.ano, i.meses) },
      { rotulo: 'Área', valor: 'Escritório (o filtro de área não muda este número)' },
    ],
    regras: [
      'Saldo inadimplente calculado ao vivo, hoje, para os títulos dos meses do período (somado por grupo de cliente), dividido pela receita prevista desses meses.',
      'Só de junho em diante, até o mês atual.',
      'É a mesma base do card Resultado % da Receita. Não soma os percentuais congelados de cada mês: cada célula mensal é o fechamento do mês, e o mês atual ainda muda.',
      'Indicador do escritório: o filtro de área do Overview não muda este número.',
      `Meta: no máximo ${pct(EFICIENCIA_META_INDICE_INADIMPLENCIA)} (menor é melhor).`,
    ],
    fonte: 'Financeiro do VIOS (títulos a receber vencidos e não pagos) e receita prevista do painel da Receita.',
    fonteTecnica:
      'receita_inadimplencia_dashboard (valor_total_periodo e previsto por mês) por intervalo de meses · consolidarInadimplenciaAoVivo (eficiencia/utils/overviewFinanceiroKpis.ts)',
    detalhe: 'Para ver por grupo de cliente, abra a aba Índice de Inadimplência.',
  }
}

// ---------------------------------------------------------------------------
// NPS
// ---------------------------------------------------------------------------

export function explicarNps(i: {
  ano: number
  nps: number
  promotores: number
  neutros: number
  detratores: number
  total: number
  campanha: string | null
  valor: string
}): FenixExplicacao {
  const saldo = i.promotores - i.detratores
  return {
    tela: 'Eficiência › Overview',
    titulo: 'NPS',
    valor: i.valor,
    resumo: `Net Promoter Score dos clientes na pesquisa de ${i.ano}: percentual de promotores menos o de detratores.`,
    formula: 'NPS = (promotores − detratores) ÷ respostas × 100, arredondado para inteiro',
    conta: [
      { rotulo: 'Promotores (nota 9 ou 10)', valor: int(i.promotores), numero: i.promotores },
      { rotulo: 'Detratores (nota 0 a 6)', valor: int(i.detratores), numero: i.detratores, operador: '−' },
      { rotulo: 'Saldo', valor: int(saldo), numero: saldo, operador: '=' },
      { rotulo: 'Respostas', valor: int(i.total), numero: i.total, operador: '÷' },
      { rotulo: 'NPS', valor: i.valor, numero: i.nps, operador: '=', tipo: 'total', detalhe: '× 100, arredondado' },
      {
        rotulo: 'Neutros (nota 7 ou 8)',
        valor: int(i.neutros),
        numero: i.neutros,
        tipo: 'info',
        detalhe: 'contam nas respostas, mas não somam nem subtraem',
      },
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Pesquisa', valor: i.campanha ?? '—' },
    ],
    regras: [
      'Usa a nota de recomendação de cada resposta da pesquisa NPS do ano.',
      `Avaliação única no ano: na linha do Overview ela ocupa de ${nomeMes(EFICIENCIA_NPS_MES_INICIO).toLowerCase()} a dezembro, e o Acum. é o mesmo número.`,
      'O filtro de meses e o de área não mudam o NPS.',
      `Meta: ${pct(EFICIENCIA_META_NPS)}.`,
    ],
    fonte: 'Pesquisa NPS de clientes do ORQESTRAI (Meus Clientes).',
    fonteTecnica: 'Edge function nps-orquestrai (nps_campaigns e nps_responses.score_recommend)',
  }
}

// ---------------------------------------------------------------------------
// Operações Legais › Overview: Iniciativas e Marketing
// ---------------------------------------------------------------------------

export function explicarIniciativas(i: {
  ano: number
  mesFiltro: MesFiltroEficiencia
  meses: readonly { mes: number; qtd: number }[]
  pct: number | null
  valor: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const meses = i.meses.filter((m) => m.qtd > 0).sort((a, b) => a.mes - b.mes)
  const qtd = meses.reduce((s, m) => s + m.qtd, 0)
  const meta = EFICIENCIA_META_OPS_INICIATIVAS
  const conta: FenixLinha[] = [
    ...meses.map((m, idx) => ({
      rotulo: rotuloMesAno(i.ano, m.mes),
      valor: int(m.qtd),
      numero: m.qtd,
      operador: idx === 0 ? undefined : ('+' as const),
    })),
    { rotulo: 'Entregas no período', valor: int(qtd), numero: qtd, operador: meses.length > 0 ? '=' : undefined, tipo: 'total' },
    { rotulo: 'Meta do ano', valor: int(meta), numero: meta, operador: '÷' },
    ...(i.pct != null
      ? [{ rotulo: 'Iniciativas', valor: i.valor, numero: i.pct, operador: '=' as const, tipo: 'total' as const, detalhe: '× 100' }]
      : []),
  ]
  return {
    tela: 'Operações Legais › Overview',
    titulo: 'Iniciativas Estratégicas · Acum.',
    valor: i.valor,
    resumo: `Projetos e melhorias entregues no período, comparados com a meta de ${meta} entregas no ano.`,
    formula: `Iniciativas = entregas no período ÷ ${meta} × 100`,
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
    ],
    regras: [
      'Conta os projetos e as melhorias do FORJAI entregues no ano, pela data de conclusão (sem ela, a data de produção quando o estágio conta como entrega).',
      `Com meses selecionados, as entregas desses meses são divididas pela meta do ano inteiro (${meta}).`,
      'Cada célula mensal mostra o acumulado do ano até aquele mês ÷ meta.',
    ],
    fonte: 'FORJAI (projetos de melhoria do SIOE).',
    fonteTecnica: 'Edge function ops-legais-iniciativas (itens com tag Projetos ou Melhorias) · OperacoesLegaisOverviewTab',
    detalhe: DETALHE_RACIONAL_OVERVIEW,
  }
}

export type MarketingTipo = 'posts' | 'engajamento' | 'pautas' | 'alcance'

export function explicarMarketing(i: {
  tipo: MarketingTipo
  ano: number
  mesFiltro: MesFiltroEficiencia
  /** Valores por mês do período (posts, %, pautas ou alcance). */
  meses: readonly { mes: number; valor: number }[]
  /** Divisor: meta (posts/pautas) ou quantidade de meses com post (médias). */
  divisor: number
  resultado: number | null
  valor: string
  meta: number
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const media = i.tipo === 'engajamento' || i.tipo === 'alcance'
  const fmt = (v: number) =>
    i.tipo === 'engajamento' ? pct(v) : Math.round(v).toLocaleString('pt-BR')
  const meses = i.meses.filter((m) => m.valor !== 0).sort((a, b) => a.mes - b.mes)
  const soma = meses.reduce((s, m) => s + m.valor, 0)
  const nomes: Record<MarketingTipo, { titulo: string; parcela: string; resumo: string; formula: string; regra: string }> = {
    posts: {
      titulo: 'MKT - Posts Anuais',
      parcela: 'Posts no período',
      resumo: 'Posts publicados no Instagram no período, comparados com a meta anual.',
      formula: 'Posts = posts no período ÷ meta anual × 100',
      regra: `Meta: ${int(i.meta)} posts no ano. Mesmo com meses selecionados, o divisor é a meta do ano inteiro.`,
    },
    engajamento: {
      titulo: 'MKT - Engajamento',
      parcela: 'Soma do engajamento mensal',
      resumo: 'Média da taxa de engajamento mensal do Instagram nos meses do período que tiveram post.',
      formula: 'Engajamento = média simples da taxa de engajamento dos meses com post',
      regra: `Meta: engajamento médio de pelo menos ${pct(i.meta)}.`,
    },
    pautas: {
      titulo: 'MKT - Pautas Anuais',
      parcela: 'Pautas no período',
      resumo: 'Pautas de marketing produzidas no período, comparadas com a meta de 10 por mês.',
      formula: 'Pautas = pautas no período ÷ (meses do período × 10) × 100',
      regra: 'Meta: 10 pautas por mês. O divisor considera todos os meses do período (no ano inteiro, 12 × 10).',
    },
    alcance: {
      titulo: 'MKT - Alcance Mensal',
      parcela: 'Soma do alcance mensal',
      resumo: 'Média do alcance mensal do Instagram nos meses do período que tiveram post.',
      formula: 'Alcance = média simples do alcance dos meses com post',
      regra: `Meta: alcance médio de pelo menos ${int(i.meta)} pessoas por mês.`,
    },
  }
  const n = nomes[i.tipo]
  const conta: FenixLinha[] = [
    ...meses.map((m, idx) => ({
      rotulo: rotuloMesAno(i.ano, m.mes),
      valor: fmt(m.valor),
      numero: m.valor,
      operador: idx === 0 ? undefined : ('+' as const),
    })),
    { rotulo: n.parcela, valor: fmt(soma), numero: soma, operador: meses.length > 0 ? '=' : undefined, tipo: 'total' },
    {
      rotulo: media ? 'Meses com post' : 'Meta do período',
      valor: int(i.divisor),
      numero: i.divisor,
      operador: '÷',
    },
  ]
  if (i.resultado != null) {
    conta.push({
      rotulo: n.titulo.replace('MKT - ', ''),
      valor: i.valor,
      numero: i.resultado,
      operador: '=',
      tipo: 'total',
      detalhe: media ? 'média' : '× 100',
    })
  }
  return {
    tela: 'Operações Legais › Overview',
    titulo: `${n.titulo} · Acum.`,
    valor: i.valor,
    resumo: n.resumo,
    formula: n.formula,
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(i.ano, i.mesFiltro, hoje) },
    ],
    regras: [
      n.regra,
      i.tipo === 'pautas'
        ? 'Pautas vêm do controle de pautas do módulo Marketing.'
        : 'Posts, engajamento e alcance vêm do Instagram do escritório.',
    ],
    fonte:
      i.tipo === 'pautas'
        ? 'Controle de pautas do módulo Marketing (Operações Legais).'
        : 'Instagram do escritório (posts, engajamento e alcance), lido pelo módulo Marketing.',
    fonteTecnica:
      'useInstagramMarketing / useMarketingPautas · buildMonthlyIndicadoresSeries (operacoes-legais/marketing/computeMarketingIndicadores.ts)',
    detalhe: DETALHE_RACIONAL_OVERVIEW,
  }
}

// ---------------------------------------------------------------------------
// Efetividade na Cobrança Inicial (aba de Operações Legais)
// ---------------------------------------------------------------------------

export function explicarEfetividadeCobranca(i: {
  ano: number
  escopo: 'gestao_a_vista' | 'periodo' | 'titulos'
  mesFiltro: MesFiltroEficiencia
  total: number
  cobrados: number
  pct: number
  valor: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const gav = i.escopo === 'gestao_a_vista'
  const periodo = gav
    ? periodoMesesTexto(i.ano, filtroEfetivoGestaoAVista(i.ano, hoje))
    : descreverFiltroMes(i.ano, i.mesFiltro, hoje)
  const fora = i.total - i.cobrados
  const conta: FenixLinha[] =
    i.escopo === 'titulos'
      ? [
          { rotulo: 'Cobrados por WhatsApp no D+1', valor: int(i.cobrados), numero: i.cobrados },
          { rotulo: 'Fora do D+1 ou sem cobrança', valor: int(fora), numero: fora, operador: '+' },
          { rotulo: 'Títulos', valor: int(i.total), numero: i.total, operador: '=', tipo: 'total' },
        ]
      : i.total > 0
        ? [
            { rotulo: 'Cobrados por WhatsApp no D+1', valor: int(i.cobrados), numero: i.cobrados },
            { rotulo: 'Títulos', valor: int(i.total), numero: i.total, operador: '÷' },
            { rotulo: 'Efetividade', valor: i.valor, numero: i.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
          ]
        : [{ rotulo: 'Títulos', valor: '0', numero: 0, tipo: 'info', detalhe: 'sem títulos no período' }]
  return {
    tela: 'Operações Legais › Efetividade na Cobrança',
    titulo:
      i.escopo === 'gestao_a_vista'
        ? 'Efetividade Gestão a Vista'
        : i.escopo === 'periodo'
          ? 'Efetividade no período selecionado'
          : 'Títulos no período selecionado',
    valor: i.valor,
    resumo: `Títulos com vencimento em ${periodo} que receberam cobrança por WhatsApp até o D+1 útil.`,
    formula: 'Efetividade = títulos cobrados por WhatsApp no D+1 ÷ títulos × 100',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: gav ? 'Período (fixo)' : 'Período', valor: periodo },
    ],
    regras: [
      'Conta os títulos a receber do painel de Cobrança pelo mês de vencimento. Títulos de saldo parcial ficam fora.',
      'Cobrado no D+1: WhatsApp enviado entre o vencimento e o próximo dia útil (fins de semana e feriados não contam).',
      ...(gav ? ['Período fixo: de junho até o mês atual; o filtro de meses não muda este card.'] : []),
      `Meta: ${pct(EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)}.`,
    ],
    fonte: 'Painel de Cobrança do SIOE (títulos a receber do VIOS e envios de WhatsApp registrados).',
    fonteTecnica: 'view cobranca_painel (tem_whatsapp_d1) · agregarEfetividade (eficiencia/utils/opsEfetividadeCobranca.ts)',
  }
}
