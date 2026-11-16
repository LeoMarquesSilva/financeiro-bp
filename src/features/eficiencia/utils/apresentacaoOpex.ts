import { MESES_CURTOS } from '@/features/opex/constants'
import { opexService } from '@/features/opex/services/opexService'
import { opexGrupoChave } from '@/features/opex/utils/opexGrupoNome'
import { yoyPct } from '@/features/opex/utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '@/features/opex/utils/opexPlanoFiltro'

/** Bloco OPEX da Apresentação — realizado (base caixa) do ano vs mesmo recorte do ano anterior. */
export type ApresentacaoOpexMes = {
  mes: number
  /** `jan`, `fev`… — com `*` quando o mês ainda está em curso. */
  label: string
  anterior: number
  atual: number
  /** Variação do ano sobre o anterior (%). `null` sem base. */
  variacaoPct: number | null
  parcial: boolean
}

export type ApresentacaoOpexGrupo = {
  /** Nome curto para o slide (ex.: `Serviços de terceiros`). */
  nome: string
  /** Nome do grupo no VIOS. */
  grupoConta: string
  realizado: number
  /** Planos de contas com pagamento no período. */
  planos: number
}

export type ApresentacaoOpexData = {
  ano: number
  anoAnterior: number
  meses: ApresentacaoOpexMes[]
  totalAnterior: number
  totalAtual: number
  variacaoPct: number | null
  /** Grupos com pagamento no período, do maior para o menor. */
  grupos: ApresentacaoOpexGrupo[]
  totalPlanos: number
  /** Mês em curso incluído no recorte (ex.: 11) — `null` se todos fechados. */
  mesParcial: number | null
  /** `dd/mm` do corte do mês em curso. */
  parcialAte: string | null
}

/**
 * Mesmo `mes_atual` do RPC `opex_dashboard`: ano passado = 12, ano corrente =
 * mês de hoje, ano futuro = 0.
 */
export function opexMesAtualRef(ano: number, ref = new Date()): number {
  const anoRef = ref.getFullYear()
  if (ano < anoRef) return 12
  if (ano > anoRef) return 0
  return ref.getMonth() + 1
}

/** Padrão do filtro "Até": último mês fechado (o mês em curso entra só se escolhido). */
export function opexMesFimPadrao(ano: number, ref = new Date()): number {
  const mesAtual = opexMesAtualRef(ano, ref)
  if (ano < ref.getFullYear()) return 12
  if (mesAtual <= 1) return 1
  return mesAtual - 1
}

/** Meses do recorte De/Até, limitados ao mês em curso (meses futuros não têm realizado). */
export function mesesApresentacaoOpex(
  ano: number,
  mesInicio: number,
  mesFim: number,
  ref = new Date(),
): number[] {
  const mesAtual = opexMesAtualRef(ano, ref)
  const teto = mesAtual > 0 ? mesAtual : 12
  const a = Math.max(1, Math.min(mesInicio, mesFim, teto))
  const b = Math.max(a, Math.min(Math.max(mesInicio, mesFim), teto))
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

const NOME_CURTO: Record<string, string> = {
  'TREINAMENTO/DESENVOLVIMENTO/CULTURA': 'Treinamento e cultura',
  'ASSOCIACOES E CUSTAS JUDICIAIS': 'Custas judiciais',
  'MATERIAL DE CONSUMO, LIMPEZA E SEGURANCA': 'Material de consumo',
}

/** `DESPESAS DE MANUTENÇãO` → `Manutenção`; `ENCARGOS SOCIAIS` → `Encargos sociais`. */
export function nomeCurtoGrupoOpex(grupo: string): string {
  const curto = NOME_CURTO[opexGrupoChave(grupo)]
  if (curto) return curto
  let t = grupo.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
  const semPrefixo = t.replace(/^despesas (de|com) /, '')
  if (semPrefixo !== t && semPrefixo.length > 0) t = semPrefixo
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1)
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function fetchApresentacaoOpex(
  ano: number,
  meses: number[],
  planoFiltro: OpexPlanoFiltroState,
  ref = new Date(),
): Promise<ApresentacaoOpexData> {
  const anoAnterior = ano - 1
  const [atual, anterior] = await Promise.all([
    opexService.fetchDashboard(ano, meses, planoFiltro),
    opexService.fetchDashboard(anoAnterior, meses, planoFiltro),
  ])

  const mesAtual = opexMesAtualRef(ano, ref)
  const emCurso = ano === ref.getFullYear() ? mesAtual : null
  const mesParcial = emCurso != null && meses.includes(emCurso) ? emCurso : null

  const realizadoMes = (rows: typeof atual.evolucao, mes: number) =>
    rows.find((r) => r.mes === mes)?.realizado ?? 0

  const linhas: ApresentacaoOpexMes[] = meses.map((mes) => {
    const a = realizadoMes(atual.evolucao, mes)
    const b = realizadoMes(anterior.evolucao, mes)
    const parcial = mes === mesParcial
    return {
      mes,
      label: `${MESES_CURTOS[mes - 1] ?? mes}${parcial ? '*' : ''}`,
      anterior: b,
      atual: a,
      variacaoPct: yoyPct(a, b),
      parcial,
    }
  })

  const totalAtual = linhas.reduce((s, l) => s + l.atual, 0)
  const totalAnterior = linhas.reduce((s, l) => s + l.anterior, 0)

  const gruposComValor = atual.grupos.filter((g) => g.realizado_ytd > 0)
  const planosPorGrupo = await Promise.all(
    gruposComValor.map(async (g) => {
      const planos = await opexService.fetchPlanosGrupo(
        ano,
        g.grupo_conta,
        meses,
        planoFiltro,
        g.aliases,
      )
      return planos.filter((p) => p.realizado_ytd > 0).length
    }),
  )

  const grupos: ApresentacaoOpexGrupo[] = gruposComValor
    .map((g, i) => ({
      nome: nomeCurtoGrupoOpex(g.grupo_conta),
      grupoConta: g.grupo_conta,
      realizado: g.realizado_ytd,
      planos: planosPorGrupo[i] ?? 0,
    }))
    .sort((x, y) => y.realizado - x.realizado)

  return {
    ano,
    anoAnterior,
    meses: linhas,
    totalAnterior,
    totalAtual,
    variacaoPct: yoyPct(totalAtual, totalAnterior),
    grupos,
    totalPlanos: grupos.reduce((s, g) => s + g.planos, 0),
    mesParcial,
    parcialAte: mesParcial != null ? ddmm(ref) : null,
  }
}
