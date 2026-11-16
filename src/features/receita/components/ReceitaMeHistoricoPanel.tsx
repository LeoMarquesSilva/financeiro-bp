import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrencyCompact, formatDateTime } from '@/shared/utils/format'
import { useReceitaMeHistorico } from '../hooks/useReceitaMe'
import { RECEITA_ME_AREAS, receitaMeAreaLabel, receitaMeMesRotulo } from '../utils/receitaMeLabels'
import type { ReceitaMeHistoricoRow } from '../types/receitaMe.types'

type Props = { ano: number }

const SELECT_CLASS =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

const TIPO_AJUSTE: Record<string, string> = {
  nao_paga: 'não deve pagar',
  vai_pagar: 'vai pagar',
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function num(v: unknown): number {
  return Number(v) || 0
}

/** Frase legível para cada linha do histórico (gravado por trigger). */
export function descreverHistorico(row: ReceitaMeHistoricoRow, ano: number): string {
  const d = row.depois ?? {}
  const a = row.antes ?? {}
  const ref = row.operacao === 'DELETE' ? a : d
  const mes = ref.mes != null ? receitaMeMesRotulo(ano, num(ref.mes)) : ''
  switch (row.tabela) {
    case 'receita_me_ajustes':
      if (row.operacao === 'INSERT') return `Marcou ${str(d.grupo)} em ${mes} como ${TIPO_AJUSTE[str(d.tipo)] ?? str(d.tipo)}`
      if (row.operacao === 'DELETE') return `Voltou ${str(a.grupo)} em ${mes} para o padrão`
      if (str(a.tipo) !== str(d.tipo)) return `Mudou ${str(d.grupo)} em ${mes} para ${TIPO_AJUSTE[str(d.tipo)] ?? str(d.tipo)}`
      return `Atualizou o valor em aberto de ${str(d.grupo)} em ${mes} para ${formatCurrencyCompact(num(d.valor_marcado))}`
    case 'receita_me_novas_receitas': {
      const nome = str(ref.nome)
      if (row.operacao === 'INSERT') {
        const quando =
          str(d.recorrencia) === 'mensal'
            ? `${formatCurrencyCompact(num(d.valor))}/mês de ${receitaMeMesRotulo(ano, num(d.mes_inicio))} a ${receitaMeMesRotulo(ano, num(d.mes_fim))}`
            : `${formatCurrencyCompact(num(d.valor))} em ${receitaMeMesRotulo(ano, num(d.mes_inicio))}`
        return `Incluiu a nova receita ${nome} (${quando})`
      }
      if (row.operacao === 'DELETE') return `Removeu a nova receita ${nome}`
      const antesBaixa = JSON.stringify(a.meses_baixados ?? [])
      const depoisBaixa = JSON.stringify(d.meses_baixados ?? [])
      if (antesBaixa !== depoisBaixa) return `Baixou a estimativa ${nome}: virou título no VIOS`
      return `Alterou a nova receita ${nome}`
    }
    case 'receita_me_area_status':
      return 'Confirmou a melhor estimativa da área'
    case 'receita_me_responsaveis':
      if (row.operacao === 'INSERT') return `Incluiu ${str(d.nome)} como responsável de ${receitaMeAreaLabel(str(d.area_key))}`
      if (row.operacao === 'DELETE') return `Removeu ${str(a.nome)} dos responsáveis de ${receitaMeAreaLabel(str(a.area_key))}`
      return `Alterou o responsável ${str(d.nome)} (${receitaMeAreaLabel(str(d.area_key))})`
    default:
      return `${row.operacao} em ${row.tabela}`
  }
}

export function ReceitaMeHistoricoPanel({ ano }: Props) {
  const { data, isLoading, error } = useReceitaMeHistorico(ano)
  const [area, setArea] = useState('')

  const linhas = useMemo(
    () => (data ?? []).filter((r) => !area || r.area_key === area),
    [data, area],
  )

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Histórico de alterações</h2>
          <p className="text-xs text-slate-500">Quem mudou o quê na melhor estimativa. Últimas 200 alterações.</p>
        </div>
        <select className={SELECT_CLASS} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área">
          <option value="">Todas as áreas</option>
          {RECEITA_ME_AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {receitaMeAreaLabel(a.key)}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <div className="m-4 h-40 animate-pulse rounded-lg bg-slate-100" />
      ) : error ? (
        <p className="px-4 py-6 text-sm text-red-600">Não foi possível carregar o histórico.</p>
      ) : linhas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma alteração ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {linhas.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
              <span className="w-36 shrink-0 text-xs tabular-nums text-slate-500">{formatDateTime(row.created_at)}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  row.area_key ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-transparent text-slate-400',
                )}
              >
                {row.area_key ? receitaMeAreaLabel(row.area_key) : 'Configuração'}
              </span>
              <span className="min-w-0 flex-1 text-slate-800">{descreverHistorico(row, ano)}</span>
              <span className="text-xs text-slate-500">{row.usuario_nome ?? row.usuario_email ?? 'Sistema'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
