import { useMemo, useState } from 'react'
import { usePlanPessoas } from '../hooks/usePlanejamento'
import { AREAS_PLANEJAMENTO, MESES_ABREV, areaEncerrada, areaNome, soma, variacaoPct, zeros12, type AreaKey } from '../utils/areasPlanejamento'
import { contratacoesMensais, type Premissas } from '../utils/planejamentoCalc'
import type { PlanPessoasRow } from '../types'
import { fenixValor } from '../fenix/planejamentoFenix'
import { AreaChips, Aviso, CarregandoBloco, ErroBloco, PlanKpi, Secao, TabelaMeses, VarPct, moeda, moedaCurta } from './PlanUi'

type Props = { ultimoMesFechado: number; premissas: Premissas; nomeCenario: string | null }

const CHAVES = [
  ...AREAS_PLANEJAMENTO.map((a) => ({ key: a.key as string, nome: a.nome })),
  { key: 'operacoes_legais', nome: 'Operações Legais' },
  { key: 'estrutura', nome: 'Estrutura (Facilities, Financeiro, MKT, RH, TI, Comercial)' },
]

type Serie = { folha: number[]; demais: number[]; headcount: (number | null)[] }

function series(rows: readonly PlanPessoasRow[] | undefined, chave: string): Serie {
  const out: Serie = { folha: zeros12(), demais: zeros12(), headcount: Array(12).fill(null) }
  for (const r of rows ?? []) {
    if (chave !== 'escritorio' && r.area_key !== chave) continue
    const i = r.mes - 1
    if (i < 0 || i > 11) continue
    out.folha[i] += r.folha
    out.demais[i] += r.demais_pessoas
    if (r.headcount != null) out.headcount[i] = (out.headcount[i] ?? 0) + r.headcount
  }
  return out
}

/**
 * Último mês de 2026 com folha lançada (até o último mês fechado). A folha do mês é paga no começo do
 * mês seguinte; enquanto o VIOS não tem os pagamentos por pessoa, o mês aparece zerado.
 */
function mesReferenciaFolha(rows: readonly PlanPessoasRow[] | undefined, ultimoMesFechado: number): number {
  for (let m = ultimoMesFechado; m >= 1; m--) {
    if ((rows ?? []).some((r) => r.mes === m && r.folha > 0)) return m
  }
  return ultimoMesFechado
}

/**
 * Folha (competência): meses depois do mês de referência repetem esse mês.
 * Demais custos de pessoas (caixa): meses depois do último mês fechado repetem o último mês fechado.
 */
function projetarFolha(s: Serie, mesRefFolha: number, ultimoMesFechado: number): { serie: Serie; projetado: boolean[] } {
  const ref = Math.max(1, mesRefFolha) - 1
  const refCaixa = Math.max(1, ultimoMesFechado) - 1
  const projetado = Array.from({ length: 12 }, (_, i) => i + 1 > mesRefFolha)
  return {
    serie: {
      folha: s.folha.map((v, i) => (projetado[i] ? s.folha[ref] : v)),
      demais: s.demais.map((v, i) => (i + 1 > ultimoMesFechado ? s.demais[refCaixa] : v)),
      headcount: s.headcount,
    },
    projetado,
  }
}

/** Folha 2027 do cenário: folha 2026 × (1 + ajustes na equipe atual) × reajuste + contratações. */
function folha2027(s2026: Serie, chave: string, p: Premissas): { folha: number[]; headcount: (number | null)[] } {
  // Área encerrada: sem projeção em 2027.
  if (areaEncerrada(chave)) return { folha: zeros12(), headcount: Array(12).fill(0) }
  const e = p.escritorio
  const area = p.areas[chave as AreaKey]
  const fatorArea = area ? 1 + area.variacaoPessoasPct / 100 : 1
  const dez = s2026.headcount[11] ?? s2026.headcount.filter((v) => v != null).slice(-1)[0] ?? null
  const novos = contratacoesMensais(area?.contratacoes ?? [])
  return {
    folha: s2026.folha.map((v, i) => v * fatorArea * (i + 1 >= e.mesReajuste ? 1 + e.reajustePct / 100 : 1) + novos.custo[i]),
    headcount: Array.from({ length: 12 }, (_, i) => (dez == null ? null : dez + novos.pessoas[i])),
  }
}

function mediaHeadcount(h: (number | null)[], meses: number[]): number | null {
  const v = meses.map((m) => h[m - 1]).filter((x): x is number => x != null)
  return v.length ? soma(v) / v.length : null
}

export function PessoasTab({ ultimoMesFechado, premissas, nomeCenario }: Props) {
  const p25 = usePlanPessoas(2025)
  const p26 = usePlanPessoas(2026)
  const [sel, setSel] = useState('escritorio')
  const rotuloFechado = (MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()
  const mesRef = mesReferenciaFolha(p26.data, ultimoMesFechado)
  const rotuloRef = (MESES_ABREV[mesRef - 1] ?? '').toLowerCase()
  const rotuloProj = (MESES_ABREV[mesRef] ?? '').toLowerCase()
  const todos = Array.from({ length: 12 }, (_, i) => i + 1)
  const fechados = Array.from({ length: ultimoMesFechado }, (_, i) => i + 1)

  const linhas = useMemo(() => {
    if (!p25.data || !p26.data) return []
    return CHAVES.map((c) => {
      const s25 = series(p25.data, c.key)
      const { serie: s26 } = projetarFolha(series(p26.data, c.key), mesRef, ultimoMesFechado)
      const f27 = folha2027(s26, c.key, premissas)
      return {
        ...c,
        folha25: soma(s25.folha),
        folha26: soma(s26.folha),
        folha27: soma(f27.folha),
        hcMedio25: mediaHeadcount(s25.headcount, todos),
        hcMedio26: mediaHeadcount(s26.headcount, fechados),
        hcDez25: s25.headcount[11],
        hcAtual: s26.headcount[ultimoMesFechado - 1] ?? null,
        hcDez27: f27.headcount[11],
      }
    })
  }, [p25.data, p26.data, premissas, ultimoMesFechado, mesRef, todos, fechados])

  const erro = p25.error ?? p26.error
  if (erro) return <ErroBloco erro={erro} contexto="folha e headcount" />
  if (p25.isLoading || p26.isLoading) return <CarregandoBloco />

  const s25 = series(p25.data, sel)
  const { serie: s26, projetado } = projetarFolha(series(p26.data, sel), mesRef, ultimoMesFechado)
  const f27 =
    sel === 'escritorio'
      ? (() => {
          const folha = zeros12()
          const hc: (number | null)[] = Array(12).fill(null)
          for (const c of CHAVES) {
            const x = folha2027(projetarFolha(series(p26.data, c.key), mesRef, ultimoMesFechado).serie, c.key, premissas)
            x.folha.forEach((v, i) => (folha[i] += v))
            x.headcount.forEach((v, i) => {
              if (v != null) hc[i] = (hc[i] ?? 0) + v
            })
          }
          return { folha, headcount: hc }
        })()
      : folha2027(s26, sel, premissas)
  const nome = sel === 'escritorio' ? 'Escritório' : areaNome(sel)
  const tot25 = soma(linhas.map((l) => l.folha25))
  const tot26 = soma(linhas.map((l) => l.folha26))
  const tot27 = soma(linhas.map((l) => l.folha27))

  return (
    <div className="space-y-4">
      <Aviso tom="azul">
        Só totais por área — sem valor por pessoa e sem salário médio. Folha = contas de remuneração fixa (associados e CLT) pelo mês de
        competência (pagamento até o dia 15 conta no mês anterior). Em 2025 a folha lançada em Facilities foi para a área de cada pessoa.
        Headcount = cadastro de RH (quem trabalhou ao menos um dia no mês; sem advogado parceiro).
      </Aviso>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanKpi rotulo="Folha 2025" valor={moedaCurta(tot25)} sub={moeda(tot25)} />
        <PlanKpi
          rotulo={`Folha 2026 (${rotuloProj}–dez projetados)`}
          valor={moedaCurta(tot26)}
          sub={
            <>
              vs. 2025: <VarPct v={variacaoPct(tot26, tot25)} />
            </>
          }
          fenixChave="planejamento.pessoas.folha2026"
          explicar={() =>
            fenixValor({
              tela: 'Pessoas',
              titulo: 'Folha 2026 do escritório',
              valor: moeda(tot26),
              resumo: `Folha por competência de jan a ${rotuloRef}/26; de ${rotuloProj} a dez repetem ${rotuloRef}/26 (a folha de um mês é paga no começo do mês seguinte e ainda não está lançada por pessoa no VIOS).`,
              conta: linhas.map((l) => ({ rotulo: l.nome, valor: moeda(l.folha26), numero: l.folha26, operador: '+' as const })),
              regras: ['Remuneração fixa: contas 8.1.01 (associados) e 8.1.02 (CLT), além de lançamentos com descrição "folha" de pessoas identificadas.'],
              fonteTecnica: 'planejamento_pessoas_mensal',
            })
          }
        />
        <PlanKpi
          rotulo={`Folha 2027 (${nomeCenario ? `cenário “${nomeCenario}”` : 'sem cenário'})`}
          valor={moedaCurta(tot27)}
          tom="destaque"
          sub={
            <>
              vs. 2026: <VarPct v={variacaoPct(tot27, tot26)} />
            </>
          }
        />
        <PlanKpi
          rotulo={`Headcount ${rotuloFechado}/26`}
          valor={String(soma(linhas.map((l) => l.hcAtual ?? 0)))}
          sub={`dez/25: ${soma(linhas.map((l) => l.hcDez25 ?? 0))} · dez/27 (cenário): ${soma(linhas.map((l) => l.hcDez27 ?? 0))}`}
        />
      </div>

      <Secao titulo="Folha e headcount por área" subtitulo="Headcount médio = média dos meses do ano (2026 até o último mês fechado).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">Folha 2025</th>
                <th className="px-2 py-1.5 text-right font-medium">Folha 2026</th>
                <th className="px-2 py-1.5 text-right font-medium">Var.</th>
                <th className="px-2 py-1.5 text-right font-medium">Folha 2027</th>
                <th className="px-2 py-1.5 text-right font-medium">HC médio 25</th>
                <th className="px-2 py-1.5 text-right font-medium">HC médio 26</th>
                <th className="px-2 py-1.5 text-right font-medium">HC dez/25</th>
                <th className="px-2 py-1.5 text-right font-medium">HC {rotuloFechado}/26</th>
                <th className="px-2 py-1.5 text-right font-medium">HC dez/27</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.key} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{l.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.folha25)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.folha26)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <VarPct v={variacaoPct(l.folha26, l.folha25)} />
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{moeda(l.folha27)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.hcMedio25 == null ? '—' : l.hcMedio25.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.hcMedio26 == null ? '—' : l.hcMedio26.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.hcDez25 ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.hcAtual ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.hcDez27 ?? '—'}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-2 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(tot25)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(tot26)}</td>
                <td className="px-2 py-1.5 text-right">
                  <VarPct v={variacaoPct(tot26, tot25)} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(tot27)}</td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao
        titulo={`Mês a mês — ${nome}`}
        subtitulo={`Em itálico: ${rotuloProj}–dez/26 repetindo ${rotuloRef}/26 (último mês com folha lançada por pessoa no VIOS; a folha é paga no começo do mês seguinte).`}
      >
        <div className="mb-3">
          <AreaChips value={sel} onChange={setSel} areas={CHAVES.map((c) => ({ key: c.key, nome: c.key === 'estrutura' ? 'Estrutura' : c.nome }))} />
        </div>
        <TabelaMeses
          linhas={[
            { rotulo: 'Folha 2025', valores: s25.folha },
            { rotulo: 'Folha 2026', valores: s26.folha, projetado, destaque: true },
            { rotulo: 'Folha 2027 (cenário)', valores: f27.folha },
            { rotulo: 'Demais custos de pessoas 2025', valores: s25.demais, sub: true },
            { rotulo: 'Demais custos de pessoas 2026', valores: s26.demais, projetado, sub: true },
            { rotulo: 'Headcount 2025', valores: s25.headcount, formato: 'num', total: s25.headcount[11] ?? null },
            { rotulo: 'Headcount 2026', valores: s26.headcount, formato: 'num', total: s26.headcount[ultimoMesFechado - 1] ?? null },
            { rotulo: 'Headcount 2027 (cenário)', valores: f27.headcount, formato: 'num', total: f27.headcount[11] ?? null },
          ]}
          rotuloTotal="Total / dez"
        />
      </Secao>
    </div>
  )
}
