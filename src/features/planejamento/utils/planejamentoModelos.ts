/**
 * Cenários prontos do simulador 2027, ancorados no crescimento de 2025 para 2026.
 *
 * - Receita: meta do escritório = fator × crescimento 25→26 (Consolidar 0,6×; Manter o ritmo 1×; Acelerar 1,3×),
 *   arredondada para o % inteiro. Todas as áreas no automático (crescem o mesmo % e fecham a meta).
 * - Pessoas: em 25→26 o custo de pessoas das áreas que continuam em 2027 cresceu uma fração (k) do
 *   crescimento da receita (a área encerrada fica de fora: o custo dela já some em 2027).
 *   O cenário mantém essa proporção: custo de pessoas 2027 sobe k × crescimento da receita, já contando
 *   o reajuste de 5% em janeiro; o resto vira "ajustes na equipe atual" (capacidade). Sem contratações
 *   nomeadas, para não usar custo médio por pessoa.
 * - Demais despesas, Controladoria e estrutura: inflação (5%); Acelerar investe mais (demais 10%, estrutura e Controladoria 8%).
 *
 * Funções puras (imports com .ts) para rodar com `node --test`.
 */
import { AREA_KEYS, AREA_KEYS_2027, soma } from './areasPlanejamento.ts'
import type { BaseAno } from './planejamentoBase.ts'
import type { Premissas } from './planejamentoCalc.ts'

export type ModeloId = 'consolidar' | 'ritmo' | 'acelerar'

export type ModeloCenario = {
  id: ModeloId
  /** Nome curto (ex.: "Acelerar"). */
  rotulo: string
  /** Nome do cenário com o % (ex.: "Acelerar (+35%)"). */
  nome: string
  crescimentoPct: number
  descricao: string
  /** Múltiplo do crescimento 25→26. */
  fator: number
  premissas: Premissas
}

export type Historico = {
  /** Crescimento da receita do escritório 2025→2026 (áreas + sem área), em %. */
  receitaPct: number | null
  /** Crescimento do custo de pessoas das áreas que continuam em 2027, 2025→2026, em %. */
  pessoasPct: number | null
  /** Quanto do crescimento da receita virou custo de pessoas (pessoas% ÷ receita%), entre 0 e 1. */
  proporcaoPessoas: number
}

export const REAJUSTE_MODELOS_PCT = 5
export const INFLACAO_MODELOS_PCT = 5
const REAJUSTE_PCT = REAJUSTE_MODELOS_PCT
const INFLACAO_PCT = INFLACAO_MODELOS_PCT

const totalReceita = (b: BaseAno) => soma(AREA_KEYS.map((k) => soma(b.areas[k].receita))) + soma(b.semArea)
const totalPessoas = (b: BaseAno) => soma(AREA_KEYS_2027.map((k) => soma(b.areas[k].pessoas)))
const arred = (v: number, passo: number) => Math.round(v / passo) * passo

export function historico25a26(base2025: BaseAno, base2026: BaseAno): Historico {
  const r25 = totalReceita(base2025)
  const p25 = totalPessoas(base2025)
  const receitaPct = r25 > 0 ? (totalReceita(base2026) / r25 - 1) * 100 : null
  const pessoasPct = p25 > 0 ? (totalPessoas(base2026) / p25 - 1) * 100 : null
  const proporcaoPessoas =
    receitaPct != null && pessoasPct != null && receitaPct > 0 ? Math.min(1, Math.max(0, pessoasPct / receitaPct)) : 0.5
  return { receitaPct, pessoasPct, proporcaoPessoas }
}

const DEF: { id: ModeloId; nome: string; fator: number; despesas: { demais: number; estrutura: number; controladoria: number }; descricao: string }[] = [
  {
    id: 'consolidar',
    nome: 'Consolidar',
    fator: 0.6,
    despesas: { demais: INFLACAO_PCT, estrutura: INFLACAO_PCT, controladoria: INFLACAO_PCT },
    descricao: '60% do ritmo de 25→26: consolida a carteira de 2026, com reforço menor na equipe.',
  },
  {
    id: 'ritmo',
    nome: 'Manter o ritmo',
    fator: 1,
    despesas: { demais: INFLACAO_PCT, estrutura: INFLACAO_PCT, controladoria: INFLACAO_PCT },
    descricao: 'Repete 25→26: receita e equipe crescem como cresceram em 2026.',
  },
  {
    id: 'acelerar',
    nome: 'Acelerar',
    fator: 1.3,
    despesas: { demais: 10, estrutura: 8, controladoria: 8 },
    descricao: '30% acima do ritmo de 25→26: mais equipe e mais investimento em despesas e estrutura.',
  },
]

/** Os três cenários prontos, montados sobre as premissas padrão (alíquota e inadimplência do escritório). */
export function modelosCenario(h: Historico, padrao: Premissas): ModeloCenario[] {
  const base = h.receitaPct ?? 0
  return DEF.map((d) => {
    const cresc = Math.round(base * d.fator)
    // Custo de pessoas sobe k × crescimento; o reajuste já cobre 5 pontos, o resto é capacidade da equipe.
    const alvoPessoas = h.proporcaoPessoas * cresc
    const capacidade = arred(((1 + alvoPessoas / 100) / (1 + REAJUSTE_PCT / 100) - 1) * 100, 0.5)
    const p: Premissas = structuredClone(padrao)
    p.escritorio = {
      ...p.escritorio,
      crescimentoReceitaPct: cresc,
      reajustePct: REAJUSTE_PCT,
      mesReajuste: 1,
      variacaoControladoriaPct: d.despesas.controladoria,
      variacaoEstruturaPct: d.despesas.estrutura,
      distribuicao: 'sazonal',
    }
    for (const k of AREA_KEYS) {
      p.areas[k] = {
        crescimentoPct: null,
        receitaNova: 0,
        variacaoPessoasPct: capacidade,
        variacaoDemaisPct: d.despesas.demais,
        contratacoes: [],
      }
    }
    const sinal = cresc >= 0 ? '+' : ''
    return {
      id: d.id,
      rotulo: d.nome,
      nome: `${d.nome} (${sinal}${cresc}%)`,
      crescimentoPct: cresc,
      descricao: d.descricao,
      fator: d.fator,
      premissas: p,
    }
  })
}
