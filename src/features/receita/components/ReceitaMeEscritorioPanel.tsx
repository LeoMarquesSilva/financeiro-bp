import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/shared/utils/format'
import { receitaMeService } from '../services/receitaMeService'
import { RECEITA_ME_QUERY_KEYS, useReceitaMeSnapshots } from '../hooks/useReceitaMe'
import {
  calcularGapMeta,
  montarMesAMes,
  type ReceitaMeAreaCalc,
} from '../utils/receitaMeCalc'
import {
  RECEITA_ME_AREAS,
  RECEITA_ME_OUTRAS_KEY,
  receitaMeAreaLabel,
  receitaMeMesRotulo,
  receitaMeMesesRotulo,
} from '../utils/receitaMeLabels'
import type { ReceitaMesRow } from '../types/receita.types'
import type {
  ReceitaMeAreaStatus,
  ReceitaMeResponsavel,
  ReceitaMeSnapshotRow,
} from '../types/receitaMe.types'
import { ReceitaMeMesAMesTabela } from './ReceitaMeMesAMesTabela'

type Props = {
  ano: number
  calcs: Record<string, ReceitaMeAreaCalc>
  meses: number[]
  mesCorrente: number | null
  mesesMeta: number[]
  metaBasePorMes: Record<number, number>
  dashboardRows: ReceitaMesRow[]
  realizadoPorArea: Record<string, Record<number, number>>
  status: ReceitaMeAreaStatus[]
  responsaveis: ReceitaMeResponsavel[]
  onAbrirArea: (areaKey: string) => void
}

function pct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'negativo' | 'positivo' }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums text-slate-900',
          tone === 'negativo' && 'text-red-600',
          tone === 'positivo' && 'text-emerald-700',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] leading-snug text-slate-500">{hint}</p>}
    </div>
  )
}

export function ReceitaMeEscritorioPanel({
  ano,
  calcs,
  meses,
  mesCorrente,
  mesesMeta,
  metaBasePorMes,
  dashboardRows,
  realizadoPorArea,
  status,
  responsaveis,
  onAbrirArea,
}: Props) {
  const qc = useQueryClient()
  const snapshots = useReceitaMeSnapshots(ano)
  const chaves = useMemo(() => [...RECEITA_ME_AREAS.map((a) => a.key), RECEITA_ME_OUTRAS_KEY], [])
  const lista = chaves.map((k) => calcs[k]).filter(Boolean)

  const mePorMes = useMemo(() => {
    const out: Record<number, number> = {}
    for (const m of meses) out[m] = lista.reduce((s, c) => s + (c.mePorMes[m] ?? 0), 0)
    return out
  }, [lista, meses])

  const realizadoPorMes = useMemo(
    () => Object.fromEntries(dashboardRows.map((r) => [r.mes, r.recebido])) as Record<number, number>,
    [dashboardRows],
  )

  const mesAMes = useMemo(
    () => montarMesAMes({ mesesMeta, metaPorMes: metaBasePorMes, realizadoPorMes, mePorMes, mesesHorizonte: meses }),
    [mesesMeta, metaBasePorMes, realizadoPorMes, mePorMes, meses],
  )
  const gap = useMemo(() => calcularGapMeta(mesAMes), [mesAMes])

  const total = {
    recebido: lista.reduce((s, c) => s + c.recebido, 0),
    aberto: lista.reduce((s, c) => s + c.aberto, 0),
    fora: lista.reduce((s, c) => s + c.fora, 0),
    novas: lista.reduce((s, c) => s + c.novas, 0),
    potencial: lista.reduce((s, c) => s + c.potencial, 0),
    me: lista.reduce((s, c) => s + c.meTotal, 0),
  }

  const periodoMeta = receitaMeMesesRotulo(ano, mesesMeta)
  const periodoMe = receitaMeMesesRotulo(ano, meses)
  const mesesMetaHorizonte = mesesMeta.filter((m) => meses.includes(m))

  /** Foto do mês: grava no primeiro acesso do mês à visão do escritório. */
  const gravando = useRef(false)
  useEffect(() => {
    if (mesCorrente == null || snapshots.isLoading || !snapshots.data || gravando.current) return
    if (snapshots.data.some((s) => s.mes_ref === mesCorrente)) return
    const rows: ReceitaMeSnapshotRow[] = []
    for (const key of chaves) {
      const c = calcs[key]
      if (!c) continue
      for (const m of mesesMeta) {
        const noHorizonte = meses.includes(m)
        rows.push({
          ano,
          mes_ref: mesCorrente,
          area_key: key,
          mes: m,
          base: noHorizonte ? 'me' : 'realizado',
          valor: noHorizonte ? c.mePorMes[m] ?? 0 : realizadoPorArea[key]?.[m] ?? 0,
        })
      }
    }
    gravando.current = true
    receitaMeService
      .registrarSnapshot(rows)
      .then(() => qc.invalidateQueries({ queryKey: RECEITA_ME_QUERY_KEYS.snapshots(ano) }))
      .catch(() => {
        gravando.current = false
      })
  }, [ano, calcs, chaves, mesCorrente, meses, mesesMeta, qc, realizadoPorArea, snapshots.data, snapshots.isLoading])

  const evolucao = useMemo(() => {
    const porRef = new Map<number, { valor: number; gerado: string | null }>()
    for (const s of snapshots.data ?? []) {
      const cur = porRef.get(s.mes_ref) ?? { valor: 0, gerado: s.gerado_em ?? null }
      cur.valor += s.valor
      porRef.set(s.mes_ref, cur)
    }
    return [...porRef.entries()].sort((a, b) => a[0] - b[0]).map(([mesRef, v]) => ({ mesRef, ...v }))
  }, [snapshots.data])

  const cenarios = [
    { label: 'Como está', fator: 0 },
    { label: 'Recupera metade do que está fora', fator: 0.5 },
    { label: 'Recupera tudo o que está fora', fator: 1 },
  ].map((c) => {
    const projecao = gap.projecao + c.fator * total.fora
    return { ...c, projecao, gap: gap.metaTotal - projecao, atingimento: gap.metaTotal > 0 ? (projecao / gap.metaTotal) * 100 : 0 }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Meta ${periodoMeta}`} value={formatCurrencyCompact(gap.metaTotal)} hint="Meta do SIOE (Configurações da Receita)" />
        <Kpi
          label={`Projeção ${periodoMeta}`}
          value={formatCurrencyCompact(gap.projecao)}
          hint={`Realizado ${formatCurrencyCompact(gap.realizadoFechado)} + ME ${formatCurrencyCompact(gap.meAberto)}`}
        />
        <Kpi label="Atingimento projetado" value={pct(gap.atingimentoPct)} tone={gap.atingimentoPct >= 100 ? 'positivo' : undefined} />
        <Kpi
          label="Gap para a meta"
          value={formatCurrencyCompact(Math.max(0, gap.gap))}
          tone={gap.gap > 0 ? 'negativo' : 'positivo'}
          hint={gap.gap > 0 ? undefined : 'Meta coberta pela projeção'}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Mês a mês</h2>
        <ReceitaMeMesAMesTabela ano={ano} linhas={mesAMes} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Gap meta</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              [`Receita necessária em ${periodoMe || 'meses abertos'}`, gap.necessarioAberto],
              ['Necessário por mês', gap.necessarioPorMes],
              ['Melhor estimativa média por mês', gap.meMediaPorMes],
              ['Receita adicional necessária por mês', gap.adicionalPorMes],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-medium tabular-nums text-slate-900" title={formatCurrency(v as number)}>
                  {formatCurrencyCompact(v as number)}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
              <dt className="text-slate-600">Aumento sobre a melhor estimativa</dt>
              <dd className={cn('font-semibold tabular-nums', gap.aumentoSobreMePct > 0 ? 'text-red-600' : 'text-emerald-700')}>
                {pct(gap.aumentoSobreMePct)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Se o que está fora entrar</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Fora da estimativa hoje: {formatCurrencyCompact(total.fora)} (não deve pagar e em atraso).
          </p>
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-1 text-left font-semibold">Cenário</th>
                <th className="pb-1 text-right font-semibold">Projeção</th>
                <th className="pb-1 text-right font-semibold">Gap</th>
                <th className="pb-1 text-right font-semibold">Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {cenarios.map((c) => (
                <tr key={c.label} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{c.label}</td>
                  <td className="py-1.5 text-right">{formatCurrencyCompact(c.projecao)}</td>
                  <td className={cn('py-1.5 text-right', c.gap > 0 ? 'text-red-600' : 'text-emerald-700')}>
                    {formatCurrencyCompact(Math.max(0, c.gap))}
                  </td>
                  <td className="py-1.5 text-right">{pct(c.atingimento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Por área</h2>
          <p className="text-xs text-slate-500">Clique numa área para abrir a matriz. Demais departamentos entram automaticamente, sem ajuste.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm tabular-nums">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left font-semibold">Área</th>
                {meses.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-semibold">
                    {receitaMeMesRotulo(ano, m)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">ME {periodoMe}</th>
                <th className="px-3 py-2 text-right font-semibold">Meta</th>
                <th className="px-3 py-2 text-right font-semibold">% meta</th>
                <th className="px-3 py-2 text-left font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {chaves.map((key) => {
                const c = calcs[key]
                if (!c) return null
                const area = RECEITA_ME_AREAS.find((a) => a.key === key)
                const meta = area ? mesesMetaHorizonte.reduce((s, m) => s + ((metaBasePorMes[m] ?? 0) * area.pct) / 100, 0) : 0
                const st = status.find((s) => s.area_key === key)
                const resp = responsaveis.filter((r) => r.area_key === key && r.ativo).map((r) => r.nome.split(' ')[0])
                const n = c.novidades.length
                return (
                  <tr
                    key={key}
                    className={cn('border-b border-slate-100', area && 'cursor-pointer hover:bg-slate-50')}
                    onClick={area ? () => onAbrirArea(key) : undefined}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{receitaMeAreaLabel(key)}</p>
                      {resp.length > 0 && <p className="text-[11px] text-slate-500">{resp.join(', ')}</p>}
                    </td>
                    {meses.map((m) => (
                      <td key={m} className="px-3 py-2 text-right text-slate-700" title={formatCurrency(c.mePorMes[m] ?? 0)}>
                        {formatCurrencyCompact(c.mePorMes[m] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-slate-900" title={formatCurrency(c.meTotal)}>
                      {formatCurrencyCompact(c.meTotal)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{area ? formatCurrencyCompact(meta) : '—'}</td>
                    <td className={cn('px-3 py-2 text-right', meta > 0 && c.meTotal >= meta ? 'text-emerald-700' : 'text-slate-700')}>
                      {meta > 0 ? pct((c.meTotal / meta) * 100) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {!area ? (
                        <span className="text-xs text-slate-500">Automático</span>
                      ) : !st?.confirmada_em ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Não confirmada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Confirmada {formatDate(st.confirmada_em.slice(0, 10))}
                          </span>
                          {n > 0 && (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              {n} {n === 1 ? 'novidade' : 'novidades'}
                            </span>
                          )}
                        </span>
                      )}
                      {area && <ChevronRight className="ml-1 inline h-3.5 w-3.5 text-slate-300" aria-hidden />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-slate-900">
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2">Escritório</td>
                {meses.map((m) => (
                  <td key={m} className="px-3 py-2 text-right">
                    {formatCurrencyCompact(mePorMes[m] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">{formatCurrencyCompact(total.me)}</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrencyCompact(mesesMetaHorizonte.reduce((s, m) => s + (metaBasePorMes[m] ?? 0), 0))}
                </td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Composição {periodoMe}: recebido {formatCurrencyCompact(total.recebido)} + em aberto {formatCurrencyCompact(total.aberto)} − fora da
          estimativa {formatCurrencyCompact(total.fora)} + novas receitas {formatCurrencyCompact(total.novas)} ={' '}
          <span className="font-semibold text-slate-700">{formatCurrencyCompact(total.me)}</span>
          {total.potencial > 0 && ` · potencial com chance baixa: ${formatCurrencyCompact(total.potencial)}`}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Evolução da projeção {periodoMeta}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Foto registrada no primeiro acesso de cada mês a esta visão (realizado até ali + melhor estimativa do momento).
        </p>
        {evolucao.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">A primeira foto é registrada agora.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {evolucao.map((e, i) => {
              const anterior = i > 0 ? evolucao[i - 1].valor : null
              return (
                <li key={e.mesRef} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-slate-700">
                    Foto de {receitaMeMesRotulo(ano, e.mesRef)}
                    {e.gerado && <span className="ml-1 text-xs text-slate-400">({formatDate(e.gerado.slice(0, 10))})</span>}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-medium text-slate-900">{formatCurrencyCompact(e.valor)}</span>
                    {anterior != null && (
                      <span className={cn('ml-2 text-xs', e.valor >= anterior ? 'text-emerald-700' : 'text-red-600')}>
                        {e.valor >= anterior ? '+' : ''}
                        {formatCurrencyCompact(e.valor - anterior)}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium text-slate-900">Agora</span>
              <span className="tabular-nums">
                <span className="font-semibold text-slate-900">{formatCurrencyCompact(gap.projecao)}</span>
                {(() => {
                  const ultimo = evolucao[evolucao.length - 1].valor
                  const d = gap.projecao - ultimo
                  return (
                    <span className={cn('ml-2 text-xs', d >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {d >= 0 ? '+' : ''}
                      {formatCurrencyCompact(d)}
                    </span>
                  )
                })()}
              </span>
            </li>
          </ul>
        )}
      </section>
    </div>
  )
}
