/**
 * Fênix na Inadimplência: Comitê Inadimplência (cards do topo) e Painel de Inadimplência
 * (carteiras, resumo, taxa de recuperação do Comitê, total por classe e evolução do saldo devedor).
 *
 * Funções puras. Recebem o mesmo objeto do dashboard (dashboardService.getDashboard) ou os
 * mesmos dados da evolução do saldo devedor que alimentam os cards; a conta fecha com a tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import type { DashboardData } from '../services/dashboardService.ts'
import type { ClienteSaldoDevedor, EvolucaoSaldoDevedorData } from '../utils/saldoDevedor.ts'
import { DATA_INICIO_COMITE } from '../../../shared/constants/inadimplencia.ts'
import {
  FONTE_FINANCEIRO_VIOS,
  dataBr,
  info,
  inteiro,
  linhasMaioresMoeda,
  linhasPercentual,
  mesAno,
  moeda,
  notaCentavos,
  parcelaInteiro,
  parcelaMoeda,
  pct,
  plural,
  totalInteiro,
  totalMoeda,
} from '../../cobranca/fenix/fenixComum.ts'

export const TELA_COMITE = 'Comitê Inadimplência'
export const TELA_PAINEL_CARTEIRAS = 'Painel de Inadimplência › Carteiras'
export const TELA_PAINEL_RESUMO = 'Painel de Inadimplência › Resumo'
export const TELA_PAINEL_TAXA_COMITE = 'Painel de Inadimplência › Taxa de recuperação do Comitê'
export const TELA_PAINEL_CLASSES = 'Painel de Inadimplência › Total por classe'
export const TELA_PAINEL_SALDO = 'Painel de Inadimplência › Evolução do saldo devedor'

const INICIO_COMITE = dataBr(DATA_INICIO_COMITE)

const FONTE_COMITE = `Cards do Comitê de Inadimplência no SIOE (valor em aberto calculado do VIOS) e ${FONTE_FINANCEIRO_VIOS.charAt(0).toLowerCase()}${FONTE_FINANCEIRO_VIOS.slice(1)}`

const REGRA_VALOR_CARD =
  'Valor de cada card do Comitê: com grupo no cadastro de pessoas, é o saldo vencido até ontem dos honorários da cota do grupo (só clientes ativos), mais reembolsos de despesa em aberto; sem esse saldo, ou com vínculo só à pessoa, é a soma dos títulos em aberto já vencidos; sem vínculo, vale o valor digitado no card.'
const REGRA_RECORRENTE = 'Recorrente (Comitê): soma do valor em aberto dos cards ativos do Comitê (cards resolvidos ficam fora).'
const REGRA_PONTUAL =
  'Pontual: grupos fora do Comitê com títulos vencidos de 1 a 60 dias após a cobrança D+1. É a mesma conta da tela Inadimplência Pontual com o filtro Fora do Comitê.'
const REGRA_JUDICIALIZADA =
  'Judicializada: casos ativos pelo valor corrigido (valor nominal + INPC + juros de mora de 1% ao mês desde a judicialização).'
const REGRA_SEM_FILTRO_LISTA = 'Os cards do topo não mudam com os filtros da lista de clientes.'
const REGRA_CLASSES =
  'No Comitê, a classe é definida na reunião, caso a caso: A = bom pagador, B = atrasos recorrentes, C = inadimplente crônico.'
const REGRA_CLASSES_PONTUAL =
  'Na Pontual não há classificação manual: o grupo conta como A quando o título mais atrasado tem até 30 dias e como B quando tem de 31 a 60 dias. Não existe C na Pontual.'

const FONTE_TECNICA_DASHBOARD = 'dashboardService.getDashboard (inadimplencia/services/dashboardService.ts)'

// ---------------------------------------------------------------------------
// Total em aberto
// ---------------------------------------------------------------------------

/** "Total em aberto" do Comitê Inadimplência: Recorrente + Pontual (sem Judicializada). */
export function explicarTotalEmAbertoOperacional(d: DashboardData, tela = TELA_COMITE): FenixExplicacao {
  const { recorrente, pontual, judicializada } = d.carteiras
  const total = d.totais.totalEmAbertoOperacional
  return {
    tela,
    titulo: 'Total em aberto',
    valor: moeda(total),
    resumo: 'Quanto está em aberto nas carteiras acompanhadas pela cobrança: Comitê (Recorrente) mais Pontual. A Judicializada fica fora.',
    formula: 'Total em aberto = Recorrente (Comitê) + Pontual',
    conta: [
      parcelaMoeda('Recorrente (cards ativos do Comitê)', recorrente.valorEmAberto, true, plural(recorrente.qtdClientes, 'card', 'cards')),
      parcelaMoeda('Pontual (fora do Comitê)', pontual.valorEmAberto, false, plural(pontual.qtdGrupos, 'grupo', 'grupos')),
      totalMoeda('Total em aberto', total),
      ...notaCentavos([recorrente.valorEmAberto, pontual.valorEmAberto], total),
      info('Judicializada (não entra)', moeda(judicializada.valorEmAberto), 'valor corrigido, mostrado no Painel de Inadimplência', judicializada.valorEmAberto),
    ],
    regras: [REGRA_RECORRENTE, REGRA_VALOR_CARD, REGRA_PONTUAL, 'A carteira Judicializada não entra neste total.', REGRA_SEM_FILTRO_LISTA],
    fonte: FONTE_COMITE,
    fonteTecnica: `Supabase › clients_inadimplencia_list · cobranca_seguimento_dashboard · ${FONTE_TECNICA_DASHBOARD}`,
    detalhe: 'O Painel de Inadimplência mostra cada carteira separada.',
  }
}

/** "Total em aberto" do Painel de Inadimplência: as três carteiras. */
export function explicarTotalEmAbertoCarteiras(d: DashboardData, tela = TELA_PAINEL_RESUMO): FenixExplicacao {
  const { recorrente, pontual, judicializada } = d.carteiras
  const total = d.totais.totalEmAberto
  const parte = (v: number) => (total > 0 ? `${pct((v / total) * 100)} do total` : undefined)
  return {
    tela,
    titulo: 'Total em aberto',
    valor: moeda(total),
    resumo: 'Soma do que está em aberto nas três carteiras de inadimplência: Pontual, Recorrente (Comitê) e Judicializada.',
    formula: 'Total em aberto = Pontual + Recorrente + Judicializada (corrigida)',
    conta: [
      parcelaMoeda('Pontual', pontual.valorEmAberto, true, parte(pontual.valorEmAberto)),
      parcelaMoeda('Recorrente (Comitê)', recorrente.valorEmAberto, false, parte(recorrente.valorEmAberto)),
      parcelaMoeda('Judicializada (valor corrigido)', judicializada.valorEmAberto, false, parte(judicializada.valorEmAberto)),
      totalMoeda('Total em aberto', total),
      ...notaCentavos([pontual.valorEmAberto, recorrente.valorEmAberto, judicializada.valorEmAberto], total),
    ],
    regras: [REGRA_PONTUAL, REGRA_RECORRENTE, REGRA_VALOR_CARD, REGRA_JUDICIALIZADA],
    fonte: FONTE_COMITE,
    fonteTecnica: `Supabase › clients_inadimplencia_list · cobranca_seguimento_dashboard · inadimplencia_judicializada_list · ${FONTE_TECNICA_DASHBOARD}`,
    detalhe: 'Os cards das carteiras, logo acima, mostram cada parte.',
  }
}

// ---------------------------------------------------------------------------
// Classes A / B / C
// ---------------------------------------------------------------------------

export type ClasseInadimplencia = 'A' | 'B' | 'C'

export function explicarClasse(d: DashboardData, classe: ClasseInadimplencia, tela = TELA_COMITE): FenixExplicacao {
  const t = d.totais
  const comite = classe === 'A' ? t.comiteClasseA : classe === 'B' ? t.comiteClasseB : t.comiteClasseC
  const pontual = classe === 'A' ? t.pontualClasseA : classe === 'B' ? t.pontualClasseB : 0
  const total = classe === 'A' ? t.totalClasseA : classe === 'B' ? t.totalClasseB : t.totalClasseC
  const rotuloComite = `Recorrente (Comitê): grau ${classe}`
  const conta: FenixLinha[] =
    classe === 'C'
      ? [parcelaMoeda(rotuloComite, comite, true), totalMoeda(`Classe ${classe}`, total)]
      : [
          parcelaMoeda(rotuloComite, comite, true),
          parcelaMoeda(
            classe === 'A' ? 'Pontual: título mais atrasado até 30 dias' : 'Pontual: título mais atrasado de 31 a 60 dias',
            pontual,
            false,
          ),
          totalMoeda(`Classe ${classe}`, total),
          ...notaCentavos([comite, pontual], total),
        ]
  const significado = classe === 'A' ? 'bom pagador' : classe === 'B' ? 'atrasos recorrentes' : 'inadimplente crônico'
  return {
    tela,
    titulo: `Classe ${classe}`,
    valor: moeda(total),
    resumo:
      classe === 'C'
        ? 'Valor em aberto dos cards ativos do Comitê classificados como grau C (inadimplente crônico).'
        : `Valor em aberto classificado como ${classe} (${significado}): cards ativos do Comitê com grau ${classe} mais a parte da Pontual nessa faixa.`,
    formula: classe === 'C' ? 'Classe C = valor dos cards ativos do Comitê com grau C' : `Classe ${classe} = Comitê grau ${classe} + Pontual na faixa`,
    conta,
    regras: [REGRA_CLASSES, REGRA_CLASSES_PONTUAL, REGRA_VALOR_CARD, 'A Judicializada não usa classes.', ...(tela === TELA_COMITE ? [REGRA_SEM_FILTRO_LISTA] : [])],
    fonte: FONTE_COMITE,
    fonteTecnica: `Supabase › clients_inadimplencia_list (status_classe) · cobranca_seguimento_dashboard · ${FONTE_TECNICA_DASHBOARD}`,
  }
}

// ---------------------------------------------------------------------------
// Recuperação no mês
// ---------------------------------------------------------------------------

function regrasRecuperacaoMes(): string[] {
  return [
    'Recuperado no mês = pagamentos registrados nos cards do Comitê com data neste mês + títulos a receber do VIOS baixados neste mês depois do vencimento.',
    'Os títulos do VIOS entram de qualquer cliente, não só de quem está no Comitê ou na Pontual: basta a baixa ter sido neste mês e depois do vencimento.',
    'Do título do VIOS vale o valor pago; sem valor pago registrado, o valor do título.',
  ]
}

function contaRecuperadoMes(d: DashboardData): FenixLinha[] {
  const r = d.recuperacaoMes
  return [
    parcelaMoeda('Pagamentos registrados nos cards do Comitê', r.manual, true),
    parcelaMoeda('Títulos do VIOS pagos com atraso no mês', r.vios, false),
    totalMoeda('Recuperado no mês', d.totais.totalRecuperadoMes),
    ...notaCentavos([r.manual, r.vios], d.totais.totalRecuperadoMes),
  ]
}

export function explicarRecuperadoMes(d: DashboardData, tela = TELA_PAINEL_RESUMO): FenixExplicacao {
  const r = d.recuperacaoMes
  return {
    tela,
    titulo: 'Total recuperado no mês',
    valor: moeda(d.totais.totalRecuperadoMes),
    resumo: `Quanto entrou em ${mesAno(r.mes, r.ano)} de dívidas atrasadas: pagamentos lançados nos cards do Comitê e títulos do VIOS pagos depois do vencimento.`,
    formula: 'Recuperado no mês = pagamentos registrados nos cards + títulos do VIOS pagos com atraso no mês',
    conta: contaRecuperadoMes(d),
    filtros: [{ rotulo: 'Mês', valor: mesAno(r.mes, r.ano) }],
    regras: regrasRecuperacaoMes(),
    fonte: `Pagamentos registrados nos cards do Comitê e ${FONTE_FINANCEIRO_VIOS.charAt(0).toLowerCase()}${FONTE_FINANCEIRO_VIOS.slice(1)}`,
    fonteTecnica: `Supabase › inadimplencia_pagamentos (data_pagamento) · financeiro_parcelas (data_baixa > data_vencimento) · ${FONTE_TECNICA_DASHBOARD}`,
    detalhe: 'O ranking por gestor e por área, mais abaixo, divide esse valor.',
  }
}

export function explicarRecuperacaoMes(d: DashboardData, tela = TELA_PAINEL_RESUMO): FenixExplicacao {
  const t = d.totais
  const r = d.recuperacaoMes
  const base = t.totalEmAbertoOperacional + t.totalRecuperadoMes
  return {
    tela,
    titulo: tela === TELA_COMITE ? 'Recuperação' : '% Recuperação',
    valor: pct(t.percentualRecuperacao),
    resumo: `Quanto da dívida das carteiras Recorrente e Pontual foi recuperado em ${mesAno(r.mes, r.ano)}.`,
    formula: 'Recuperação = recuperado no mês ÷ (em aberto hoje + recuperado no mês) × 100',
    conta: [
      ...contaRecuperadoMes(d),
      parcelaMoeda('Em aberto hoje (Recorrente + Pontual)', t.totalEmAbertoOperacional, true),
      parcelaMoeda('Recuperado no mês', t.totalRecuperadoMes, false),
      totalMoeda('Base do mês', base, 'reconstrói quanto havia no começo do mês'),
      ...linhasPercentual({
        numerador: { rotulo: 'Recuperado no mês', valor: moeda(t.totalRecuperadoMes), numero: t.totalRecuperadoMes },
        denominador: { rotulo: 'Base do mês', valor: moeda(base), numero: base },
        resultado: { rotulo: 'Recuperação', pct: t.percentualRecuperacao },
      }),
    ],
    filtros: [{ rotulo: 'Mês', valor: mesAno(r.mes, r.ano) }],
    regras: [
      ...regrasRecuperacaoMes(),
      'A base soma o que ainda está em aberto hoje com o que foi recuperado no mês, para estimar quanto havia no começo do mês.',
      'A Judicializada não entra.',
      ...(tela === TELA_COMITE
        ? ['Este card mostra a recuperação do mês porque a taxa desde o início do Comitê está desligada nas Configurações.', REGRA_SEM_FILTRO_LISTA]
        : []),
    ],
    fonte: `Pagamentos registrados nos cards do Comitê e ${FONTE_FINANCEIRO_VIOS.charAt(0).toLowerCase()}${FONTE_FINANCEIRO_VIOS.slice(1)}`,
    fonteTecnica: `Supabase › inadimplencia_pagamentos · financeiro_parcelas · clients_inadimplencia_list · cobranca_seguimento_dashboard · ${FONTE_TECNICA_DASHBOARD}`,
  }
}

// ---------------------------------------------------------------------------
// Taxa de recuperação do Comitê (desde 05/02/2026)
// ---------------------------------------------------------------------------

function regrasComite(): string[] {
  return [
    `Recuperado desde ${INICIO_COMITE} = pagamentos registrados nos cards do Comitê a partir dessa data + títulos a receber do VIOS baixados a partir dessa data, da pessoa ligada a cada card.`,
    'Entram todos os cards que já passaram pelo Comitê, inclusive os resolvidos.',
    'Dos títulos do VIOS entram todos os baixados no período, pagos em dia ou com atraso, da pessoa ligada ao card (não do grupo inteiro). Vale o valor pago; sem valor pago registrado, o valor do título.',
    `O valor no início é reconstruído: em aberto hoje + o que foi recuperado desde ${INICIO_COMITE}.`,
    REGRA_VALOR_CARD,
  ]
}

function contaRecuperadoComite(d: DashboardData): FenixLinha[] {
  const c = d.taxaRecuperacaoComite
  return [
    parcelaMoeda('Pagamentos registrados nos cards', c.recuperadoManual, true),
    parcelaMoeda(`Títulos do VIOS baixados desde ${INICIO_COMITE}`, c.recuperadoVios, false),
    totalMoeda(`Recuperado desde ${INICIO_COMITE}`, c.totalRecuperadoDesdeComite),
    ...notaCentavos([c.recuperadoManual, c.recuperadoVios], c.totalRecuperadoDesdeComite),
  ]
}

function contaInicioComite(d: DashboardData): FenixLinha[] {
  const c = d.taxaRecuperacaoComite
  return [
    parcelaMoeda('Em aberto hoje nos cards', c.emAbertoAtual, true, `${plural(c.qtdClientes, 'card', 'cards')}, ${inteiro(c.qtdResolvidos)} resolvidos`),
    parcelaMoeda(`Recuperado desde ${INICIO_COMITE}`, c.totalRecuperadoDesdeComite, false),
    totalMoeda('Valor em aberto no início do Comitê', c.valorTotalEmAbertoInicioComite),
    ...notaCentavos([c.emAbertoAtual, c.totalRecuperadoDesdeComite], c.valorTotalEmAbertoInicioComite),
  ]
}

const FONTE_TECNICA_COMITE = `Supabase › inadimplencia_pagamentos (data_pagamento ≥ ${DATA_INICIO_COMITE}) · financeiro_parcelas (data_baixa ≥ ${DATA_INICIO_COMITE}, por pessoa_id) · clients_inadimplencia_list · getTaxaRecuperacaoComite`

export function explicarRecuperadoComite(d: DashboardData, tela = TELA_PAINEL_TAXA_COMITE): FenixExplicacao {
  const c = d.taxaRecuperacaoComite
  return {
    tela,
    titulo: `Total recuperado desde ${INICIO_COMITE.slice(0, 5)}`,
    valor: moeda(c.totalRecuperadoDesdeComite),
    resumo: `Quanto os clientes que passaram pelo Comitê pagaram desde ${INICIO_COMITE}, data de início do Comitê.`,
    formula: 'Recuperado = pagamentos registrados nos cards + títulos do VIOS baixados desde o início do Comitê',
    conta: contaRecuperadoComite(d),
    filtros: [{ rotulo: 'Desde', valor: INICIO_COMITE }],
    regras: regrasComite(),
    fonte: FONTE_COMITE,
    fonteTecnica: FONTE_TECNICA_COMITE,
    detalhe: 'As listas por gestor e por área, logo abaixo, dividem esse valor.',
  }
}

export function explicarValorInicioComite(d: DashboardData, tela = TELA_PAINEL_TAXA_COMITE): FenixExplicacao {
  const c = d.taxaRecuperacaoComite
  return {
    tela,
    titulo: 'Valor total em aberto (início do Comitê)',
    valor: moeda(c.valorTotalEmAbertoInicioComite),
    resumo: `Estimativa de quanto os clientes do Comitê deviam em ${INICIO_COMITE}: o que ainda está em aberto mais o que já foi pago desde então.`,
    formula: 'Valor no início = em aberto hoje + recuperado desde o início do Comitê',
    conta: contaInicioComite(d),
    filtros: [{ rotulo: 'Desde', valor: INICIO_COMITE }],
    regras: regrasComite(),
    fonte: FONTE_COMITE,
    fonteTecnica: FONTE_TECNICA_COMITE,
  }
}

export function explicarRecuperacaoComite(d: DashboardData, tela = TELA_PAINEL_TAXA_COMITE): FenixExplicacao {
  const c = d.taxaRecuperacaoComite
  return {
    tela,
    titulo: tela === TELA_COMITE ? 'Recuperação (comitê)' : '% Recuperação comitê',
    valor: pct(c.percentualRecuperacaoComite),
    resumo: `Quanto da dívida dos clientes do Comitê já foi recuperado desde ${INICIO_COMITE}.`,
    formula: 'Recuperação = recuperado desde o início ÷ valor em aberto no início × 100',
    conta: [
      ...contaInicioComite(d),
      ...contaRecuperadoComite(d),
      ...linhasPercentual({
        numerador: { rotulo: `Recuperado desde ${INICIO_COMITE}`, valor: moeda(c.totalRecuperadoDesdeComite), numero: c.totalRecuperadoDesdeComite },
        denominador: { rotulo: 'Valor em aberto no início', valor: moeda(c.valorTotalEmAbertoInicioComite), numero: c.valorTotalEmAbertoInicioComite },
        resultado: { rotulo: 'Recuperação do Comitê', pct: c.percentualRecuperacaoComite },
      }),
    ],
    filtros: [{ rotulo: 'Desde', valor: INICIO_COMITE }],
    regras: [...regrasComite(), ...(tela === TELA_COMITE ? [REGRA_SEM_FILTRO_LISTA] : [])],
    fonte: FONTE_COMITE,
    fonteTecnica: FONTE_TECNICA_COMITE,
  }
}

// ---------------------------------------------------------------------------
// Tempo médio de recuperação
// ---------------------------------------------------------------------------

export function explicarTempoMedioRecuperacao(d: DashboardData, tela = TELA_PAINEL_RESUMO): FenixExplicacao {
  const dias = d.tempoMedioRecuperacaoDias
  const base = d.tempoMedioRecuperacaoBase
  const conta: FenixLinha[] = base
    ? [
        { rotulo: 'Soma dos dias de cada card resolvido', valor: `${inteiro(base.somaDias)} dias`, numero: base.somaDias },
        { rotulo: 'Cards resolvidos', valor: inteiro(base.qtd), numero: base.qtd, operador: '÷' },
        {
          rotulo: 'Tempo médio',
          valor: dias != null ? `${dias} dias` : '–',
          numero: dias ?? undefined,
          operador: '=',
          tipo: 'total',
          detalhe: base.qtd > 0 ? `${(base.somaDias / base.qtd).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} arredondado` : undefined,
        },
      ]
    : [info('Cards resolvidos', '0', 'sem card resolvido, não há média', 0)]
  return {
    tela,
    titulo: 'Tempo médio de recuperação',
    valor: dias != null ? `${dias} dias` : '–',
    resumo: 'Em média, quantos dias um card fica no Comitê, da inclusão até ser marcado como resolvido.',
    formula: 'Tempo médio = soma dos dias de cada card resolvido ÷ cards resolvidos',
    conta,
    regras: [
      'Para cada card resolvido: dias entre a inclusão no Comitê e a data em que foi marcado como resolvido, arredondados.',
      'Só entram cards resolvidos; cards ativos não entram.',
      'A média é arredondada para dias inteiros.',
    ],
    fonte: 'Cards do Comitê de Inadimplência no SIOE.',
    fonteTecnica: 'Supabase › clients_inadimplencia (created_at, resolvido_at) · getTempoMedioRecuperacao',
  }
}

// ---------------------------------------------------------------------------
// Carteira Recorrente (Comitê) no Painel de Inadimplência
// ---------------------------------------------------------------------------

function contaClassesRecorrente(d: DashboardData, rotuloTotal: string): FenixLinha[] {
  const r = d.carteiras.recorrente
  return [
    parcelaMoeda('Grau A (bom pagador)', r.classeA, true),
    parcelaMoeda('Grau B (atrasos recorrentes)', r.classeB, false),
    parcelaMoeda('Grau C (inadimplente crônico)', r.classeC, false),
    totalMoeda(rotuloTotal, r.valorEmAberto),
    ...notaCentavos([r.classeA, r.classeB, r.classeC], r.valorEmAberto),
  ]
}

export function explicarRecorrenteValor(d: DashboardData, tela = TELA_PAINEL_CARTEIRAS): FenixExplicacao {
  const r = d.carteiras.recorrente
  return {
    tela,
    titulo: 'Inadimplência Recorrente › Valor em aberto',
    valor: moeda(r.valorEmAberto),
    resumo: `Soma do valor em aberto dos ${plural(r.qtdClientes, 'card ativo', 'cards ativos')} do Comitê de Inadimplência.`,
    formula: 'Valor em aberto = soma do valor em aberto de cada card ativo do Comitê',
    conta: contaClassesRecorrente(d, 'Valor em aberto'),
    regras: [REGRA_RECORRENTE, REGRA_VALOR_CARD, REGRA_CLASSES],
    fonte: FONTE_COMITE,
    fonteTecnica: `Supabase › clients_inadimplencia_list (valor_em_aberto, resolvido_at) · ${FONTE_TECNICA_DASHBOARD}`,
    detalhe: 'Clique no card (com o Fênix fechado) para abrir o Comitê Inadimplência, card a card.',
  }
}

export function explicarRecorrenteClientes(d: DashboardData, tela = TELA_PAINEL_CARTEIRAS): FenixExplicacao {
  const r = d.carteiras.recorrente
  const c = d.taxaRecuperacaoComite
  return {
    tela,
    titulo: 'Inadimplência Recorrente › Clientes ativos',
    valor: String(r.qtdClientes),
    resumo: 'Quantos cards estão ativos no Comitê de Inadimplência (ainda não resolvidos).',
    formula: 'Clientes ativos = cards do Comitê − cards resolvidos',
    conta: [
      parcelaInteiro('Cards no Comitê (todos)', c.qtdClientes, true),
      { rotulo: 'Cards resolvidos', valor: inteiro(c.qtdResolvidos), numero: c.qtdResolvidos, operador: '−' },
      totalInteiro('Clientes ativos', r.qtdClientes),
    ],
    regras: ['Card ativo é o que não tem data de resolução. Card reaberto volta a contar.', 'Cada card é um cliente ou grupo incluído no Comitê.'],
    fonte: 'Cards do Comitê de Inadimplência no SIOE.',
    fonteTecnica: `Supabase › clients_inadimplencia_list (resolvido_at) · ${FONTE_TECNICA_DASHBOARD}`,
    detalhe: 'Clique no card (com o Fênix fechado) para abrir o Comitê Inadimplência.',
  }
}

export function explicarRecorrenteClasses(d: DashboardData, tela = TELA_PAINEL_CARTEIRAS): FenixExplicacao {
  const r = d.carteiras.recorrente
  return {
    tela,
    titulo: 'Inadimplência Recorrente › Classes A / B / C',
    valor: `${moeda(r.classeA)} / ${moeda(r.classeB)} / ${moeda(r.classeC)}`,
    resumo: 'Valor em aberto dos cards ativos do Comitê, separado pelo grau definido na reunião.',
    formula: 'Grau A + Grau B + Grau C = valor em aberto da Recorrente',
    conta: contaClassesRecorrente(d, 'Valor em aberto da Recorrente'),
    regras: [REGRA_CLASSES, REGRA_VALOR_CARD],
    fonte: FONTE_COMITE,
    fonteTecnica: `Supabase › clients_inadimplencia_list (status_classe) · ${FONTE_TECNICA_DASHBOARD}`,
  }
}

// ---------------------------------------------------------------------------
// Evolução do saldo devedor por cliente
// ---------------------------------------------------------------------------

export type SaldoDevedorFenixInput = {
  data: EvolucaoSaldoDevedorData
  /** Mesmas listas do card (clienteSubiuDivida / clienteDesceuDivida). */
  cresceram: readonly ClienteSaldoDevedor[]
  reduziram: readonly ClienteSaldoDevedor[]
  /** Ex.: "JAN-NOV", como no título do card. */
  periodoAbrev: string
}

function filtrosSaldo(d: EvolucaoSaldoDevedorData): FenixFiltro[] {
  return [
    { rotulo: 'Posição', valor: `${mesAno(d.mesFim, d.ano)} (títulos vencidos até ontem)` },
    { rotulo: 'Fechamento anterior', valor: `31/12/${d.anoAnterior}` },
    { rotulo: 'Clientes', valor: 'ativos, com saldo acima de R$ 0,50' },
  ]
}

function regrasSaldo(d: EvolucaoSaldoDevedorData): string[] {
  return [
    'Base: honorários da cota a receber no VIOS, de clientes ativos, somados por grupo de cliente.',
    'Saldo de cada título: o que ainda não foi pago. Título quitado com desconto conta zero (o desconto não vira dívida); com baixa parcial, conta o que ficou em aberto.',
    'Entram títulos vencidos até ontem; o que vence hoje ainda não conta.',
    `Saldo ${d.anoAnterior}: posição de 31/12/${d.anoAnterior}, sem descontar pagamentos feitos em ${d.ano}.`,
    'Só aparecem clientes com saldo acima de R$ 0,50 hoje. Quem quitou tudo sai da lista, e o saldo antigo dele também sai das somas.',
  ]
}

const FONTE_SALDO = 'Financeiro do VIOS: itens dos títulos a receber, sincronizados no SIOE.'
const FONTE_TECNICA_SALDO =
  'Supabase › inadimplencia_evolucao_saldo_devedor (receita_itens_inadimplencia_base, receita_item_saldo_inadimplencia) · montarTotaisSaldoDevedor (inadimplencia/utils/saldoDevedor.ts)'
const DETALHE_SALDO = 'Na tabela logo abaixo, clique no nome do cliente para ver os títulos que formam o saldo.'

function contaClientes(
  clientes: readonly ClienteSaldoDevedor[],
  valor: (c: ClienteSaldoDevedor) => number,
  total: number,
  rotuloTotal: string,
): FenixLinha[] {
  const { linhas, parcelas } = linhasMaioresMoeda(clientes, {
    valor,
    rotulo: (c) => c.nome,
    max: 5,
    rotuloDemais: (n) => `Demais ${n} clientes`,
  })
  return [...linhas, totalMoeda(rotuloTotal, total), ...notaCentavos(parcelas, total)]
}

function baseSaldo(d: EvolucaoSaldoDevedorData) {
  return {
    tela: TELA_PAINEL_SALDO,
    filtros: filtrosSaldo(d),
    regras: regrasSaldo(d),
    fonte: FONTE_SALDO,
    fonteTecnica: FONTE_TECNICA_SALDO,
    detalhe: DETALHE_SALDO,
  }
}

export function explicarSaldoAcumulado(i: SaldoDevedorFenixInput): FenixExplicacao {
  const d = i.data
  const t = d.totais
  const anteriores = t.acumulado - t.geradoAno
  return {
    ...baseSaldo(d),
    titulo: 'Saldo devedor acumulado',
    valor: moeda(t.acumulado),
    resumo: `Quanto os ${plural(t.qtd, 'cliente deve', 'clientes devem')} hoje em honorários vencidos, somando dívida antiga e dívida de ${d.ano}.`,
    formula: `Saldo acumulado = saldo de anos anteriores ainda em aberto + saldo gerado em ${d.ano}`,
    conta: [
      parcelaMoeda(`Vencidos antes de ${d.ano}, ainda em aberto`, anteriores, true, 'acumulado − gerado no ano'),
      parcelaMoeda(`Gerado em ${d.ano} (${i.periodoAbrev})`, t.geradoAno, false),
      totalMoeda('Saldo devedor acumulado', t.acumulado),
      info(`Saldo ${d.anoAnterior} (fechamento)`, moeda(t.saldoAnterior), 'não soma: o acumulado é o saldo de hoje, já com os pagamentos do ano', t.saldoAnterior),
    ],
    regras: [
      ...regrasSaldo(d),
      `O acumulado não é a soma de Saldo ${d.anoAnterior} com Gerado ${d.ano}: a dívida antiga entra pelo que ainda está em aberto hoje.`,
    ],
  }
}

export function explicarSaldoEstoqueAnterior(i: SaldoDevedorFenixInput): FenixExplicacao {
  const d = i.data
  return {
    ...baseSaldo(d),
    titulo: `Estoque de ${d.anoAnterior}`,
    valor: moeda(d.totais.saldoAnterior),
    resumo: `Quanto os clientes da lista deviam no fechamento de ${d.anoAnterior} (31/12), antes dos pagamentos de ${d.ano}.`,
    formula: `Estoque ${d.anoAnterior} = soma do saldo de cada cliente em 31/12/${d.anoAnterior}`,
    conta: contaClientes(d.clientes, (c) => c.saldoAnterior, d.totais.saldoAnterior, `Estoque de ${d.anoAnterior}`),
  }
}

export function explicarSaldoGeradoAno(i: SaldoDevedorFenixInput): FenixExplicacao {
  const d = i.data
  return {
    ...baseSaldo(d),
    titulo: `Gerado em ${d.ano} (${i.periodoAbrev})`,
    valor: moeda(d.totais.geradoAno),
    resumo: `Dívida nova de ${d.ano}: saldo ainda em aberto dos títulos com vencimento entre janeiro e ${mesAno(d.mesFim, d.ano)}.`,
    formula: `Gerado em ${d.ano} = soma do saldo em aberto dos títulos que venceram em ${d.ano}`,
    conta: contaClientes(d.clientes, (c) => c.geradoAno, d.totais.geradoAno, `Gerado em ${d.ano}`),
  }
}

function contaQuantidades(i: SaldoDevedorFenixInput): FenixLinha[] {
  const t = i.data.totais
  const estaveis = t.qtd - t.qtdCresceram - t.qtdReduziram
  return [
    parcelaInteiro('Cresceram', t.qtdCresceram, true),
    parcelaInteiro('Reduziram', t.qtdReduziram, false),
    parcelaInteiro('Sem variação', estaveis, false),
    totalInteiro('Clientes na lista', t.qtd),
  ]
}

function delta(c: ClienteSaldoDevedor): number {
  return c.acumulado - c.saldoAnterior
}

export function explicarSaldoCresceram(i: SaldoDevedorFenixInput): FenixExplicacao {
  const d = i.data
  const t = d.totais
  const novos = i.cresceram.filter((c) => delta(c) > 0.5)
  const { linhas, parcelas } = linhasMaioresMoeda(novos, {
    valor: delta,
    rotulo: (c) => c.nome,
    max: 5,
    rotuloDemais: (n) => `Demais ${n} clientes`,
  })
  return {
    ...baseSaldo(d),
    titulo: 'Clientes que cresceram',
    valor: `${t.qtdCresceram} de ${t.qtd}`,
    resumo: `Clientes com dívida de ${d.ano} em aberto cujo saldo não caiu em relação a 31/12/${d.anoAnterior}. Juntos, somam ${moeda(t.dividaNova)} de dívida nova.`,
    formula: `Dívida nova = soma de (saldo de hoje − saldo ${d.anoAnterior}) dos clientes que cresceram`,
    conta: [
      ...contaQuantidades(i),
      ...linhas,
      totalMoeda('Dívida nova', t.dividaNova),
      ...notaCentavos(parcelas, t.dividaNova),
    ],
    regras: [
      `Cresceu: tem dívida de ${d.ano} em aberto e o saldo de hoje não ficou abaixo do saldo de 31/12/${d.anoAnterior}. Inclui quem trocou dívida antiga por dívida nova do mesmo valor.`,
      'A dívida nova soma só o quanto o saldo subiu; quem ficou estável conta como cliente que cresceu, mas não soma valor.',
      ...regrasSaldo(d),
    ],
  }
}

export function explicarSaldoReduziram(i: SaldoDevedorFenixInput): FenixExplicacao {
  const d = i.data
  const t = d.totais
  const { linhas, parcelas } = linhasMaioresMoeda(i.reduziram, {
    valor: (c) => Math.abs(delta(c)),
    rotulo: (c) => c.nome,
    max: 5,
    rotuloDemais: (n) => `Demais ${n} clientes`,
  })
  return {
    ...baseSaldo(d),
    titulo: 'Clientes que reduziram',
    valor: `${t.qtdReduziram} de ${t.qtd}`,
    resumo:
      t.amortizado > 0.5
        ? `Clientes cujo saldo de hoje é menor que o de 31/12/${d.anoAnterior}. Juntos, amortizaram ${moeda(t.amortizado)}.`
        : `Clientes cujo saldo de hoje é menor que o de 31/12/${d.anoAnterior}.`,
    formula: `Amortizado = soma de (saldo ${d.anoAnterior} − saldo de hoje) dos clientes que reduziram`,
    conta: [
      ...contaQuantidades(i),
      ...linhas,
      totalMoeda('Amortizado', t.amortizado),
      ...notaCentavos(parcelas, t.amortizado),
    ],
    regras: [
      `Reduziu: o saldo de hoje está mais de R$ 0,50 abaixo do saldo de 31/12/${d.anoAnterior}.`,
      ...regrasSaldo(d),
    ],
  }
}
