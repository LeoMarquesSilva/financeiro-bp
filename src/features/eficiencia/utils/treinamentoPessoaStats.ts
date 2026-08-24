import { metaTreinamentoMinutosProporcional } from './treinamentoMetaProporcional'

export type TreinamentoPessoaStat = {
  colaborador: string
  minutos: number
  metaMinutos: number
  /** % do indivíduo em relação à meta proporcional (pode passar de 100). */
  pctIndividual: number
  atingiuMeta: boolean
  admissao?: string | null
}

export type TreinamentoPessoasResumo = {
  linhas: TreinamentoPessoaStat[]
  qtdTotal: number
  qtdAtingiu: number
  /** % de pessoas que atingiram 100% da meta individual. */
  pctPessoasMeta: number | null
  /** Média do % individual de cada pessoa (progresso médio). */
  pctMedioIndividual: number | null
}

type PessoaInput = {
  colaborador: string
  minutos: number
  admissao?: string | null
  metaMinutos?: number | null
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100
}

/** Consolida KPIs por pessoa (meta 14h proporcional) e % da equipe que concluiu. */
export function buildTreinamentoPessoasResumo(
  pessoas: PessoaInput[],
  ano: number,
): TreinamentoPessoasResumo {
  const linhas: TreinamentoPessoaStat[] = pessoas.map((p) => {
    const metaMinutos =
      p.metaMinutos != null && Number.isFinite(Number(p.metaMinutos))
        ? Number(p.metaMinutos)
        : metaTreinamentoMinutosProporcional(p.admissao, ano)
    const minutos = Number(p.minutos ?? 0)
    const pctIndividual =
      metaMinutos > 0 ? roundPct((minutos / metaMinutos) * 100) : 0
    return {
      colaborador: p.colaborador,
      minutos,
      metaMinutos,
      pctIndividual,
      atingiuMeta: metaMinutos > 0 && minutos >= metaMinutos,
      admissao: p.admissao ?? null,
    }
  })

  const qtdTotal = linhas.length
  const qtdAtingiu = linhas.filter((l) => l.atingiuMeta).length
  const pctPessoasMeta =
    qtdTotal > 0 ? roundPct((qtdAtingiu / qtdTotal) * 100) : null
  const pctMedioIndividual =
    qtdTotal > 0
      ? roundPct(linhas.reduce((s, l) => s + l.pctIndividual, 0) / qtdTotal)
      : null

  linhas.sort(
    (a, b) =>
      Number(a.atingiuMeta) - Number(b.atingiuMeta) ||
      a.pctIndividual - b.pctIndividual ||
      a.colaborador.localeCompare(b.colaborador, 'pt-BR', { sensitivity: 'base' }),
  )

  return { linhas, qtdTotal, qtdAtingiu, pctPessoasMeta, pctMedioIndividual }
}
