/**
 * Melhor estimativa (ME) — cálculo puro, sem Supabase.
 *
 * ME do mês = recebido no caixa (só o mês corrente) + em aberto que conta
 *           − fora da estimativa + novas receitas (chance alta/média).
 * Meses fechados entram pelo realizado; estimativas antigas somem sozinhas.
 * Título vencido sem pagamento no mês corrente fica fora por padrão (como nas
 * planilhas das áreas); o gerente pode marcar "vai pagar".
 */
import type {
  ReceitaMeAjuste,
  ReceitaMeNovaReceita,
  ReceitaMeVisto,
} from '../types/receitaMe.types'

/** Diferenças abaixo disso são arredondamento do VIOS, não novidade. */
export const RECEITA_ME_TOLERANCIA = 1

export type ReceitaMeItemPrevisto = {
  areaKey: string
  grupo: string
  mes: number
  valor: number
  pago: boolean
  /** Vencido até o corte (ontem) e sem pagamento. */
  vencido: boolean
  /** YYYY-MM-DD (para o tooltip da célula). */
  vencimento?: string | null
  pagamento?: string | null
}

/** Título que compõe a célula (grupo × mês), mostrado no tooltip. */
export type ReceitaMeTituloDetalhe = {
  valor: number
  vencimento: string | null
  pagamento: string | null
  pago: boolean
  vencido: boolean
}

export type ReceitaMeItemRecebido = {
  areaKey: string
  grupo: string
  valor: number
}

export type ReceitaMeCelulaEstado = 'conta' | 'nao_paga' | 'em_atraso' | 'vai_pagar' | 'quitado'

export type ReceitaMeCelula = {
  mes: number
  previsto: number
  pago: number
  aberto: number
  abertoVencido: number
  titulos: number
  /** Títulos da célula por vencimento. */
  detalhes: ReceitaMeTituloDetalhe[]
  estado: ReceitaMeCelulaEstado
  contado: number
  fora: number
  ajuste: ReceitaMeAjuste | null
}

export type ReceitaMeLinha = {
  grupo: string
  /** Caixa do mês corrente (inclui títulos de outros meses). */
  recebido: number
  celulas: Record<number, ReceitaMeCelula>
  aberto: number
  fora: number
  me: number
  temNovidade: boolean
}

export type ReceitaMeNovidadeNovo = {
  tipo: 'novo'
  id: string
  grupo: string
  meses: Array<{ mes: number; incremento: number; previsto: number; aberto: number }>
  /** Nova receita estimada que parece ter virado este título. */
  duplicidade: { novaReceitaId: string; nome: string; meses: number[] } | null
}

export type ReceitaMeNovidadePagou = {
  tipo: 'pagou'
  id: string
  grupo: string
  mes: number
  ajusteId: string
  reducao: number
  abertoAtual: number
  /** false = o valor saiu do VIOS sem pagamento registrado. */
  houvePagamento: boolean
}

export type ReceitaMeNovidade = ReceitaMeNovidadeNovo | ReceitaMeNovidadePagou

export type ReceitaMeAreaCalc = {
  areaKey: string
  meses: number[]
  mesCorrente: number | null
  linhas: ReceitaMeLinha[]
  recebido: number
  aberto: number
  fora: number
  /** Parte do `fora` vencida sem pagamento que ficou fora por padrão (inadimplência do mês). */
  foraAtraso: number
  /** Parte do `fora` marcada pelo gerente como "não deve pagar". */
  foraNaoPaga: number
  novas: number
  potencial: number
  mePorMes: Record<number, number>
  foraPorMes: Record<number, number>
  novasPorMes: Record<number, number>
  meTotal: number
  novidades: ReceitaMeNovidade[]
}

function chaveCelula(grupo: string, mes: number): string {
  return `${grupo}\u0000${mes}`
}

function arred(v: number): number {
  return Math.round(v * 100) / 100
}

export function mesesNovaReceita(
  nr: Pick<ReceitaMeNovaReceita, 'recorrencia' | 'mes_inicio' | 'mes_fim'>,
): number[] {
  if (nr.recorrencia === 'pontual') return [nr.mes_inicio]
  const out: number[] = []
  for (let m = nr.mes_inicio; m <= Math.max(nr.mes_inicio, nr.mes_fim); m++) out.push(m)
  return out
}

/** Valor da nova receita em cada mês do horizonte (sem os meses que viraram título). */
export function valorNovaReceitaPorMes(
  nr: Pick<
    ReceitaMeNovaReceita,
    'recorrencia' | 'mes_inicio' | 'mes_fim' | 'valor' | 'meses_baixados'
  >,
  meses: readonly number[],
): Record<number, number> {
  const out: Record<number, number> = {}
  const baixados = new Set(nr.meses_baixados ?? [])
  for (const m of mesesNovaReceita(nr)) {
    if (!meses.includes(m) || baixados.has(m)) continue
    out[m] = (out[m] ?? 0) + nr.valor
  }
  return out
}

export function estadoCelula(
  aberto: number,
  abertoVencido: number,
  ajuste: Pick<ReceitaMeAjuste, 'tipo'> | null,
): { estado: ReceitaMeCelulaEstado; contado: number; fora: number } {
  if (aberto <= RECEITA_ME_TOLERANCIA) return { estado: 'quitado', contado: 0, fora: 0 }
  if (ajuste?.tipo === 'nao_paga') return { estado: 'nao_paga', contado: 0, fora: aberto }
  if (ajuste?.tipo === 'vai_pagar') return { estado: 'vai_pagar', contado: aberto, fora: 0 }
  if (abertoVencido > RECEITA_ME_TOLERANCIA) {
    return { estado: 'em_atraso', contado: aberto - abertoVencido, fora: abertoVencido }
  }
  return { estado: 'conta', contado: aberto, fora: 0 }
}

/** Próximo estado ao clicar na célula (null = remover ajuste). */
export function proximoAjusteAoClicar(
  estado: ReceitaMeCelulaEstado,
): ReceitaMeAjuste['tipo'] | null | 'ignorar' {
  switch (estado) {
    case 'conta':
      return 'nao_paga'
    case 'em_atraso':
      return 'vai_pagar'
    case 'vai_pagar':
      return 'nao_paga'
    case 'nao_paga':
      return null
    default:
      return 'ignorar'
  }
}

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bgrupo\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Nova receita parece ser o grupo (mesmo grupo cadastrado ou nome contido). */
export function novaReceitaCorrespondeGrupo(
  nr: Pick<ReceitaMeNovaReceita, 'nome' | 'grupo_cliente'>,
  grupo: string,
): boolean {
  if (nr.grupo_cliente && nr.grupo_cliente.trim() === grupo.trim()) return true
  const g = normalizarNome(grupo)
  const candidatos = [nr.grupo_cliente ?? '', nr.nome].map(normalizarNome).filter((s) => s.length >= 4)
  if (g.length < 4) return false
  return candidatos.some((c) => c === g || c.includes(g) || g.includes(c))
}

export function calcularAreaMe(input: {
  areaKey: string
  meses: number[]
  mesCorrente: number | null
  previstos: readonly ReceitaMeItemPrevisto[]
  recebidos: readonly ReceitaMeItemRecebido[]
  ajustes: readonly ReceitaMeAjuste[]
  novasReceitas: readonly ReceitaMeNovaReceita[]
  vistos: readonly ReceitaMeVisto[]
  confirmada: boolean
}): ReceitaMeAreaCalc {
  const { areaKey, meses, mesCorrente } = input
  const mesesSet = new Set(meses)

  type Bruto = {
    previsto: number
    pago: number
    aberto: number
    abertoVencido: number
    titulos: number
    detalhes: ReceitaMeTituloDetalhe[]
  }
  const brutoPorCelula = new Map<string, Bruto>()
  const grupos = new Set<string>()
  for (const it of input.previstos) {
    if (it.areaKey !== areaKey || !mesesSet.has(it.mes)) continue
    const valor = Number(it.valor) || 0
    if (valor === 0) continue
    grupos.add(it.grupo)
    const k = chaveCelula(it.grupo, it.mes)
    const cur = brutoPorCelula.get(k) ?? {
      previsto: 0,
      pago: 0,
      aberto: 0,
      abertoVencido: 0,
      titulos: 0,
      detalhes: [],
    }
    cur.previsto += valor
    cur.titulos += 1
    cur.detalhes.push({
      valor,
      vencimento: it.vencimento ?? null,
      pagamento: it.pagamento ?? null,
      pago: it.pago,
      vencido: it.vencido,
    })
    if (it.pago) cur.pago += valor
    else {
      cur.aberto += valor
      if (it.vencido) cur.abertoVencido += valor
    }
    brutoPorCelula.set(k, cur)
  }

  const recebidoPorGrupo = new Map<string, number>()
  if (mesCorrente != null) {
    for (const r of input.recebidos) {
      if (r.areaKey !== areaKey) continue
      const valor = Number(r.valor) || 0
      if (valor === 0) continue
      grupos.add(r.grupo)
      recebidoPorGrupo.set(r.grupo, (recebidoPorGrupo.get(r.grupo) ?? 0) + valor)
    }
  }

  const ajustesArea = input.ajustes.filter((a) => a.area_key === areaKey && mesesSet.has(a.mes))
  const ajustePorCelula = new Map(ajustesArea.map((a) => [chaveCelula(a.grupo, a.mes), a]))

  const mePorMes: Record<number, number> = {}
  const foraPorMes: Record<number, number> = {}
  const novasPorMes: Record<number, number> = {}
  for (const m of meses) {
    mePorMes[m] = 0
    foraPorMes[m] = 0
    novasPorMes[m] = 0
  }

  let foraAtraso = 0
  let foraNaoPaga = 0
  const linhas: ReceitaMeLinha[] = []
  for (const grupo of grupos) {
    const recebido = arred(recebidoPorGrupo.get(grupo) ?? 0)
    const celulas: Record<number, ReceitaMeCelula> = {}
    let aberto = 0
    let fora = 0
    let me = recebido
    for (const m of meses) {
      const b = brutoPorCelula.get(chaveCelula(grupo, m))
      const ajuste = ajustePorCelula.get(chaveCelula(grupo, m)) ?? null
      const abertoCel = arred(b?.aberto ?? 0)
      const vencidoCel = arred(b?.abertoVencido ?? 0)
      const st = estadoCelula(abertoCel, vencidoCel, ajuste)
      celulas[m] = {
        mes: m,
        previsto: arred(b?.previsto ?? 0),
        pago: arred(b?.pago ?? 0),
        aberto: abertoCel,
        abertoVencido: vencidoCel,
        titulos: b?.titulos ?? 0,
        detalhes: [...(b?.detalhes ?? [])].sort((x, y) => (x.vencimento ?? '').localeCompare(y.vencimento ?? '')),
        estado: st.estado,
        contado: arred(st.contado),
        fora: arred(st.fora),
        ajuste,
      }
      aberto += abertoCel
      fora += st.fora
      me += st.contado
      mePorMes[m] += st.contado
      foraPorMes[m] += st.fora
      if (st.estado === 'em_atraso') foraAtraso += st.fora
      else if (st.estado === 'nao_paga') foraNaoPaga += st.fora
    }
    if (mesCorrente != null && mesesSet.has(mesCorrente)) mePorMes[mesCorrente] += recebido
    linhas.push({
      grupo,
      recebido,
      celulas,
      aberto: arred(aberto),
      fora: arred(fora),
      me: arred(me),
      temNovidade: false,
    })
  }

  const novasArea = input.novasReceitas.filter((n) => n.area_key === areaKey)
  let potencial = 0
  for (const nr of novasArea) {
    const porMes = valorNovaReceitaPorMes(nr, meses)
    for (const [mStr, v] of Object.entries(porMes)) {
      if (nr.chance === 'baixa') {
        potencial += v
        continue
      }
      const m = Number(mStr)
      novasPorMes[m] += v
      mePorMes[m] += v
    }
  }

  const novidades: ReceitaMeNovidade[] = []
  if (input.confirmada) {
    const vistoPorCelula = new Map(
      input.vistos
        .filter((v) => v.area_key === areaKey)
        .map((v) => [chaveCelula(v.grupo, v.mes), Number(v.valor_visto) || 0]),
    )
    for (const linha of linhas) {
      const mesesNovos: ReceitaMeNovidadeNovo['meses'] = []
      for (const m of meses) {
        const cel = linha.celulas[m]
        const visto = vistoPorCelula.get(chaveCelula(linha.grupo, m)) ?? 0
        const incremento = cel.previsto - visto
        if (incremento > RECEITA_ME_TOLERANCIA) {
          mesesNovos.push({ mes: m, incremento: arred(incremento), previsto: cel.previsto, aberto: cel.aberto })
        }
      }
      if (mesesNovos.length === 0) continue
      const mesesNovosSet = new Set(mesesNovos.map((x) => x.mes))
      let duplicidade: ReceitaMeNovidadeNovo['duplicidade'] = null
      for (const nr of novasArea) {
        if (!novaReceitaCorrespondeGrupo(nr, linha.grupo)) continue
        const coincidentes = Object.keys(valorNovaReceitaPorMes(nr, meses))
          .map(Number)
          .filter((m) => mesesNovosSet.has(m))
        if (coincidentes.length > 0) {
          duplicidade = { novaReceitaId: nr.id, nome: nr.nome, meses: coincidentes }
          break
        }
      }
      linha.temNovidade = true
      novidades.push({
        tipo: 'novo',
        id: `novo:${linha.grupo}`,
        grupo: linha.grupo,
        meses: mesesNovos,
        duplicidade,
      })
    }

    const linhaPorGrupo = new Map(linhas.map((l) => [l.grupo, l]))
    for (const a of ajustesArea) {
      if (a.tipo !== 'nao_paga') continue
      const linha = linhaPorGrupo.get(a.grupo)
      const cel = linha?.celulas[a.mes]
      const abertoAtual = cel?.aberto ?? 0
      const reducao = (Number(a.valor_marcado) || 0) - abertoAtual
      if (reducao <= RECEITA_ME_TOLERANCIA) continue
      if (linha) linha.temNovidade = true
      novidades.push({
        tipo: 'pagou',
        id: `pagou:${a.id}`,
        grupo: a.grupo,
        mes: a.mes,
        ajusteId: a.id,
        reducao: arred(reducao),
        abertoAtual,
        houvePagamento: (cel?.pago ?? 0) > 0,
      })
    }
  }

  // Ordem pela carteira bruta (não muda ao marcar células: a linha não pula sob o cursor).
  linhas.sort(
    (a, b) => b.recebido + b.aberto - (a.recebido + a.aberto) || a.grupo.localeCompare(b.grupo, 'pt-BR'),
  )

  const soma = (rec: Record<number, number>) => Object.values(rec).reduce((s, v) => s + v, 0)
  for (const m of meses) {
    mePorMes[m] = arred(mePorMes[m])
    foraPorMes[m] = arred(foraPorMes[m])
    novasPorMes[m] = arred(novasPorMes[m])
  }

  return {
    areaKey,
    meses,
    mesCorrente,
    linhas,
    recebido: arred(linhas.reduce((s, l) => s + l.recebido, 0)),
    aberto: arred(linhas.reduce((s, l) => s + l.aberto, 0)),
    fora: arred(soma(foraPorMes)),
    foraAtraso: arred(foraAtraso),
    foraNaoPaga: arred(foraNaoPaga),
    novas: arred(soma(novasPorMes)),
    potencial: arred(potencial),
    mePorMes,
    foraPorMes,
    novasPorMes,
    meTotal: arred(soma(mePorMes)),
    novidades,
  }
}

/** Coluna da matriz: grupo, recebido do mês corrente, um mês (em aberto) ou ME. */
export type ReceitaMeOrdenacaoChave = 'grupo' | 'recebido' | 'me' | number
export type ReceitaMeOrdenacao = { chave: ReceitaMeOrdenacaoChave; direcao: 'asc' | 'desc' }

function valorOrdenacao(l: ReceitaMeLinha, chave: Exclude<ReceitaMeOrdenacaoChave, 'grupo'>): number {
  if (chave === 'recebido') return l.recebido
  if (chave === 'me') return l.me
  return l.celulas[chave]?.aberto ?? 0
}

/** Ordena pelo valor exibido na coluna; empate (e coluna Grupo) por nome. Sem ordenação, mantém a ordem recebida. */
export function ordenarLinhasMe(
  linhas: readonly ReceitaMeLinha[],
  ordenacao: ReceitaMeOrdenacao | null,
): ReceitaMeLinha[] {
  if (!ordenacao) return [...linhas]
  const { chave, direcao } = ordenacao
  const fator = direcao === 'asc' ? 1 : -1
  const porNome = (a: ReceitaMeLinha, b: ReceitaMeLinha) => a.grupo.localeCompare(b.grupo, 'pt-BR')
  return [...linhas].sort((a, b) => {
    if (chave === 'grupo') return fator * porNome(a, b)
    return fator * (valorOrdenacao(a, chave) - valorOrdenacao(b, chave)) || porNome(a, b)
  })
}

/** Clique no cabeçalho: 1º maior→menor (Grupo: A→Z), 2º inverte, 3º volta à ordem padrão. */
export function proximaOrdenacao(
  atual: ReceitaMeOrdenacao | null,
  chave: ReceitaMeOrdenacaoChave,
): ReceitaMeOrdenacao | null {
  const inicial: ReceitaMeOrdenacao['direcao'] = chave === 'grupo' ? 'asc' : 'desc'
  if (!atual || atual.chave !== chave) return { chave, direcao: inicial }
  if (atual.direcao === inicial) return { chave, direcao: inicial === 'asc' ? 'desc' : 'asc' }
  return null
}

/** Horizonte da ME: mês corrente até dezembro (ano corrente); vazio para ano encerrado. */
export function horizonteMe(ano: number, ref = new Date()): { meses: number[]; mesCorrente: number | null } {
  const y = ref.getFullYear()
  if (ano < y) return { meses: [], mesCorrente: null }
  if (ano > y) return { meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mesCorrente: null }
  const atual = ref.getMonth() + 1
  const meses: number[] = []
  for (let m = atual; m <= 12; m++) meses.push(m)
  return { meses, mesCorrente: atual }
}

export type ReceitaMeMesAMes = {
  mes: number
  base: 'realizado' | 'me'
  meta: number
  valor: number
  diferenca: number
  pctMeta: number
  metaAcumulada: number
  projecaoAcumulada: number
  gapAcumulado: number
}

/**
 * Bloco "Mês a mês" da planilha do escritório: meta × realizado (fechado) ou ME (aberto).
 * `metaPorMes` é a meta variável do mês (rebalanceada como na Gestão à vista: o que faltou
 * nos meses fechados é redistribuído nos seguintes). Acumulado e gap usam `metaBasePorMes`,
 * a meta anual fixa — somar a variável contaria o mesmo gap mais de uma vez.
 */
export function montarMesAMes(input: {
  mesesMeta: readonly number[]
  metaPorMes: Readonly<Record<number, number>>
  metaBasePorMes?: Readonly<Record<number, number>>
  realizadoPorMes: Readonly<Record<number, number>>
  mePorMes: Readonly<Record<number, number>>
  mesesHorizonte: readonly number[]
}): ReceitaMeMesAMes[] {
  const horizonte = new Set(input.mesesHorizonte)
  const metaBase = input.metaBasePorMes ?? input.metaPorMes
  let metaAcumulada = 0
  let projecaoAcumulada = 0
  return [...input.mesesMeta]
    .sort((a, b) => a - b)
    .map((mes) => {
      const base: ReceitaMeMesAMes['base'] = horizonte.has(mes) ? 'me' : 'realizado'
      const meta = input.metaPorMes[mes] ?? 0
      const valor = base === 'me' ? input.mePorMes[mes] ?? 0 : input.realizadoPorMes[mes] ?? 0
      metaAcumulada += metaBase[mes] ?? 0
      projecaoAcumulada += valor
      return {
        mes,
        base,
        meta,
        valor,
        diferenca: valor - meta,
        pctMeta: meta > 0 ? (valor / meta) * 100 : 0,
        metaAcumulada,
        projecaoAcumulada,
        gapAcumulado: projecaoAcumulada - metaAcumulada,
      }
    })
}

export type ReceitaMeGapMeta = {
  metaTotal: number
  realizadoFechado: number
  meAberto: number
  projecao: number
  gap: number
  atingimentoPct: number
  mesesAbertos: number
  necessarioAberto: number
  necessarioPorMes: number
  meMediaPorMes: number
  adicionalPorMes: number
  aumentoSobreMePct: number
}

/** Bloco "Gap meta" da planilha do escritório (meta total = meta anual fixa). */
export function calcularGapMeta(linhas: readonly ReceitaMeMesAMes[]): ReceitaMeGapMeta {
  const metaTotal = linhas.length > 0 ? linhas[linhas.length - 1].metaAcumulada : 0
  const realizadoFechado = linhas.filter((l) => l.base === 'realizado').reduce((s, l) => s + l.valor, 0)
  const abertos = linhas.filter((l) => l.base === 'me')
  const meAberto = abertos.reduce((s, l) => s + l.valor, 0)
  const projecao = realizadoFechado + meAberto
  const mesesAbertos = abertos.length
  const necessarioAberto = metaTotal - realizadoFechado
  const necessarioPorMes = mesesAbertos > 0 ? necessarioAberto / mesesAbertos : 0
  const meMediaPorMes = mesesAbertos > 0 ? meAberto / mesesAbertos : 0
  const adicionalPorMes = necessarioPorMes - meMediaPorMes
  return {
    metaTotal,
    realizadoFechado,
    meAberto,
    projecao,
    gap: metaTotal - projecao,
    atingimentoPct: metaTotal > 0 ? (projecao / metaTotal) * 100 : 0,
    mesesAbertos,
    necessarioAberto,
    necessarioPorMes,
    meMediaPorMes,
    adicionalPorMes,
    aumentoSobreMePct: meMediaPorMes > 0 ? (adicionalPorMes / meMediaPorMes) * 100 : 0,
  }
}
