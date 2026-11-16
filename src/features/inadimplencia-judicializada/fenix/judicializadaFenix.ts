/**
 * Fênix na Inadimplência Judicializada: valor corrigido, valor de ajuizamento,
 * lançamento VIOS e processos/grupos. Usado na tela da Judicializada e no card
 * da carteira no Painel de Inadimplência.
 *
 * Funções puras. Recebem as mesmas linhas que geraram o card (judicializadaService.calcularKpis)
 * e o total exibido; a conta fecha com a tela.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import type { InadimplenciaJudicializadaRow } from '../types/judicializada.types.ts'
import {
  FONTE_FINANCEIRO_VIOS,
  info,
  inteiro,
  linhasMaioresMoeda,
  moeda,
  notaCentavos,
  parcelaInteiro,
  parcelaMoeda,
  plural,
  totalInteiro,
  totalMoeda,
} from '../../cobranca/fenix/fenixComum.ts'

export type JudicializadaFenixInput = {
  /** Ex.: "Inadimplência Judicializada" ou "Painel de Inadimplência › Carteiras". */
  tela: string
  /** As mesmas linhas passadas para calcularKpis (a função considera só os ativos). */
  rows: readonly InadimplenciaJudicializadaRow[]
  /** Valor exibido no card. */
  total: number
  /** "Mostrar encerrados" ligado na tela da Judicializada. */
  mostrandoEncerrados?: boolean
}

export const TELA_JUDICIALIZADA = 'Inadimplência Judicializada'

type Row = InadimplenciaJudicializadaRow

function ativos(rows: readonly Row[]): Row[] {
  return rows.filter((r) => !r.encerrado_at)
}

function rotuloCaso(r: Row): string {
  return r.nro_cnj ? `${r.grupo_cliente} · ${r.nro_cnj}` : r.grupo_cliente
}

function filtros(i: Pick<JudicializadaFenixInput, 'mostrandoEncerrados'>): FenixFiltro[] {
  return [
    { rotulo: 'Casos', valor: 'só ativos (sem data de encerramento)' },
    ...(i.mostrandoEncerrados ? [{ rotulo: 'Lista', valor: 'mostrando encerrados (não mudam os cards)' }] : []),
  ]
}

function gruposRepetidos(rs: readonly Row[]): { grupo: string; qtd: number }[] {
  const porGrupo = new Map<string, { grupo: string; qtd: number }>()
  for (const r of rs) {
    const cur = porGrupo.get(r.grupo_chave) ?? { grupo: r.grupo_cliente, qtd: 0 }
    cur.qtd += 1
    porGrupo.set(r.grupo_chave, cur)
  }
  return [...porGrupo.values()].filter((g) => g.qtd > 1)
}

const REGRA_ATIVOS =
  'Só entram casos ativos. Caso encerrado sai dos cards, mesmo com "Mostrar encerrados" ligado (isso só muda a lista).'

const REGRA_NOMINAL =
  'Valor nominal de cada caso: o valor ajustado no caso, quando existe; senão, o lançamento VIOS do grupo. Na importação da planilha de ajuizados, o valor da causa vira o valor ajustado.'

const REGRA_LANCAMENTO =
  'Lançamento VIOS: saldo em aberto do grupo devedor no financeiro do VIOS (visão Escritório) no dia em que o caso foi incluído, teve o grupo trocado ou foi recalculado. Não se atualiza sozinho. Se o grupo não tem saldo em aberto, usa o valor em atraso.'

function regraGruposRepetidos(rs: readonly Row[]): string[] {
  const rep = gruposRepetidos(rs)
  if (rep.length === 0) return []
  const exemplos = rep
    .slice(0, 3)
    .map((g) => `${g.grupo} (${g.qtd} processos)`)
    .join(', ')
  return [
    `Cada caso é um processo e guarda o seu próprio valor. ${plural(rep.length, 'grupo tem', 'grupos têm')} mais de um processo ativo (${exemplos}${rep.length > 3 ? ', …' : ''}): sem valor ajustado, o saldo do grupo no VIOS entra uma vez por processo.`,
  ]
}

const FONTE = `Cadastro de casos judicializados no SIOE (planilha de ajuizados ou inclusão manual), ligado ao processo do VIOS. ${FONTE_FINANCEIRO_VIOS}`

function contaPorCaso(
  rs: readonly Row[],
  valor: (r: Row) => number,
  total: number,
  rotuloTotal: string,
  detalhe?: (r: Row) => string | undefined,
): FenixLinha[] {
  const { linhas, parcelas } = linhasMaioresMoeda(rs, {
    valor,
    rotulo: rotuloCaso,
    detalhe,
    rotuloDemais: (n) => `Demais ${n} processos`,
  })
  return [...linhas, totalMoeda(rotuloTotal, total), ...notaCentavos(parcelas, total)]
}

export function explicarJudicializadaValorCorrigido(i: JudicializadaFenixInput): FenixExplicacao {
  const rs = ativos(i.rows)
  const nominal = rs.reduce((s, r) => s + r.valor_em_aberto_nominal, 0)
  const inpc = rs.reduce((s, r) => s + r.valor_correcao_inpc, 0)
  const juros = rs.reduce((s, r) => s + r.valor_juros_mora, 0)
  const semData = rs.filter((r) => !r.data_judicializacao).length
  const conta: FenixLinha[] = [
    parcelaMoeda('Valor nominal dos casos', nominal, true, 'ajuste do caso ou lançamento VIOS'),
    parcelaMoeda('Correção pelo INPC', inpc, false),
    parcelaMoeda('Juros de mora (1% ao mês)', juros, false),
    totalMoeda('Valor corrigido', i.total),
    ...notaCentavos([nominal, inpc, juros], i.total),
  ]
  if (semData > 0) {
    conta.push(info('Casos sem data de judicialização', inteiro(semData), 'entram pelo valor nominal, sem correção', semData))
  }
  const maiores = [...rs].sort((a, b) => b.valor_em_aberto - a.valor_em_aberto).slice(0, 3)
  for (const r of maiores) {
    conta.push(
      info(
        rotuloCaso(r),
        moeda(r.valor_em_aberto),
        `${moeda(r.valor_em_aberto_nominal)} nominal · ${r.meses_atualizacao} ${r.meses_atualizacao === 1 ? 'mês' : 'meses'} de atualização`,
        r.valor_em_aberto,
      ),
    )
  }
  return {
    tela: i.tela,
    titulo: 'Valor corrigido',
    valor: moeda(i.total),
    resumo: `Quanto os ${plural(rs.length, 'processo ativo vale', 'processos ativos valem')} hoje: o valor nominal de cada caso, corrigido pelo INPC e com juros de mora do TJSP desde a judicialização.`,
    formula: 'Valor corrigido = valor nominal + correção INPC + juros de mora (1% ao mês, simples)',
    conta,
    filtros: filtros(i),
    regras: [
      REGRA_ATIVOS,
      REGRA_NOMINAL,
      'Correção pelo INPC mês a mês (composta), do mês da judicialização até o mês atual. Mês sem índice INPC cadastrado não corrige, mas conta para os juros.',
      'Juros de mora de 1% ao mês, simples, sobre o valor nominal, pelo mesmo número de meses (o mês da judicialização conta).',
      'Sem data de judicialização, o caso entra pelo valor nominal, sem correção.',
      ...regraGruposRepetidos(rs),
    ],
    fonte: FONTE,
    fonteTecnica:
      'Supabase › view inadimplencia_judicializada_list (atualizar_valor_inpc_tjsp, indices_inpc_mensal) · judicializadaService.calcularKpis',
    detalhe: 'Na tela da Judicializada, a tabela mostra caso a caso; clique no caso para ver a correção.',
  }
}

export function explicarJudicializadaValorCausa(i: JudicializadaFenixInput): FenixExplicacao {
  const rs = ativos(i.rows)
  const comCausa = rs.filter((r) => r.valor_causa != null && r.valor_causa > 0)
  const semCausa = rs.length - comCausa.length
  const conta = contaPorCaso(comCausa, (r) => r.valor_causa ?? 0, i.total, 'Valor de ajuizamento')
  if (semCausa > 0) {
    conta.push(info('Processos sem valor da causa', inteiro(semCausa), 'não somam aqui', semCausa))
  }
  return {
    tela: i.tela,
    titulo: 'Valor de ajuizamento',
    valor: moeda(i.total),
    resumo: 'Soma do valor da causa dos processos ativos: quanto foi pedido na Justiça, sem correção.',
    formula: 'Valor de ajuizamento = soma do valor da causa de cada processo ativo',
    conta,
    filtros: filtros(i),
    regras: [
      REGRA_ATIVOS,
      'O valor da causa vem da planilha de ajuizados (importação) ou do cadastro do caso. Processo sem valor da causa não soma.',
      'É o valor nominal do pedido; não tem correção nem juros.',
    ],
    fonte: 'Planilha de ajuizados importada no SIOE e cadastro manual dos casos.',
    fonteTecnica: 'Supabase › inadimplencia_judicializada.valor_causa · judicializadaService.calcularKpis',
    detalhe: 'Na tela da Judicializada, a tabela mostra caso a caso.',
  }
}

export function explicarJudicializadaLancamentoVios(i: JudicializadaFenixInput): FenixExplicacao {
  const rs = ativos(i.rows)
  const comAjuste = rs.filter((r) => r.valor_em_aberto_ajuste != null).length
  const conta = contaPorCaso(rs, (r) => r.valor_em_aberto_auto, i.total, 'Lançamento VIOS')
  if (comAjuste > 0) {
    conta.push(
      info('Casos com valor ajustado', inteiro(comAjuste), 'no valor corrigido vale o ajuste, não este lançamento', comAjuste),
    )
  }
  return {
    tela: i.tela,
    titulo: 'Lançamento VIOS (grupo)',
    valor: moeda(i.total),
    resumo: 'Soma do saldo financeiro do grupo devedor no VIOS, guardado em cada processo ativo.',
    formula: 'Lançamento VIOS = soma do saldo do grupo guardado em cada processo ativo',
    conta,
    filtros: filtros(i),
    regras: [REGRA_ATIVOS, REGRA_LANCAMENTO, ...regraGruposRepetidos(rs)],
    fonte: FONTE_FINANCEIRO_VIOS,
    fonteTecnica:
      'Supabase › inadimplencia_judicializada.valor_em_aberto_auto (calcularValorAutoGrupo sobre escritorio_grupos_resumo) · judicializadaService.calcularKpis',
    detalhe: 'No detalhe do caso há o botão para recalcular o lançamento com o saldo de hoje.',
  }
}

export function explicarJudicializadaProcessos(
  i: Omit<JudicializadaFenixInput, 'total'> & { qtdProcessos: number; qtdGrupos: number },
): FenixExplicacao {
  const rs = ativos(i.rows)
  const rep = gruposRepetidos(rs)
  const extras = rep.reduce((s, g) => s + g.qtd - 1, 0)
  const conta: FenixLinha[] = [
    parcelaInteiro('Grupos distintos', i.qtdGrupos, true),
    parcelaInteiro('Processos a mais no mesmo grupo', extras, false),
    totalInteiro('Processos ativos', i.qtdProcessos),
  ]
  return {
    tela: i.tela,
    titulo: 'Processos / grupos',
    valor: `${i.qtdProcessos} (${plural(i.qtdGrupos, 'grupo', 'grupos')})`,
    resumo: 'Quantos processos ativos estão na carteira judicializada e quantos grupos devedores distintos eles cobrem.',
    formula: 'Processos ativos = grupos distintos + processos a mais do mesmo grupo',
    conta,
    filtros: filtros(i),
    regras: [
      REGRA_ATIVOS,
      'Cada caso é um processo do VIOS; um processo só pode estar em um caso ativo.',
      'Grupos são contados pelo nome normalizado do grupo devedor.',
    ],
    fonte: FONTE,
    fonteTecnica: 'Supabase › view inadimplencia_judicializada_list · judicializadaService.calcularKpis',
    detalhe: 'Na tela da Judicializada, a tabela agrupa os processos por grupo.',
  }
}
