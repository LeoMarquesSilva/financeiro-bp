import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { toPriMaiuscula } from '../utils/textFormat'
import { eficienciaService } from '../services/eficienciaService'
import type { MesFiltroEficiencia } from '../constants'
import type { RacionalIndicador } from '../types/eficiencia.types'

export type OpsDesvioRow = {
  pessoa: string
  data: string | null
  motivo: string
  qtd: number
}

type Props = {
  indicador: Extract<
    RacionalIndicador,
    | 'ops_legais_sla_protocolo'
    | 'ops_legais_eficiencia_protocolo'
    | 'ops_legais_pub_analise'
    | 'ops_legais_pub_agendamento'
  >
  ano: number
  mesFiltro: MesFiltroEficiencia
  title?: string
  enabled?: boolean
}

function normalizeKeyPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
}

/** Data civil YYYY-MM-DD para agrupar (ignora hora). */
function dataDia(value: string | null): string | null {
  if (!value) return null
  const iso = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : String(value).trim() || null
}

function mapDesvio(
  indicador: Props['indicador'],
  row: Record<string, unknown>,
): Omit<OpsDesvioRow, 'qtd'> | null {
  if (indicador === 'ops_legais_sla_protocolo') {
    if (String(row.eficiencia_sla ?? '').trim() !== 'PROTOCOLADO NO FATAL') return null
    return {
      pessoa: String(row.protocolado_por ?? '').trim() || '—',
      data: dataDia(row.protocolado_em == null ? null : String(row.protocolado_em)),
      motivo: 'Protocolado no Fatal',
    }
  }
  if (indicador === 'ops_legais_eficiencia_protocolo') {
    const flag = String(row.inconsistencia_controladoria ?? '').trim()
    if (!flag) return null
    const motivo = String(row.inconsistencia_controladoria_motivo ?? '').trim()
    return {
      pessoa: String(row.protocolado_por ?? '').trim() || '—',
      data: dataDia(row.protocolado_em == null ? null : String(row.protocolado_em)),
      motivo: motivo || flag || 'Inconsistência Controladoria',
    }
  }
  if (String(row.eficiencia ?? '').trim() !== 'DESVIO') return null
  const subtipo = String(row.inconsistencia_subtipo ?? '').trim()
  const tipo = String(row.inconsistencias_tipo ?? '').trim()
  return {
    pessoa: String(row.agendado_por ?? '').trim() || '—',
    data: dataDia(
      row.data_recebimento_kurier == null ? null : String(row.data_recebimento_kurier),
    ),
    motivo: subtipo || tipo || 'Desvio',
  }
}

function unificarDesvios(rows: Omit<OpsDesvioRow, 'qtd'>[]): OpsDesvioRow[] {
  const map = new Map<string, OpsDesvioRow>()
  for (const row of rows) {
    const key = [
      normalizeKeyPart(row.pessoa),
      row.data ?? '',
      normalizeKeyPart(row.motivo),
    ].join('|')
    const prev = map.get(key)
    if (prev) {
      prev.qtd += 1
    } else {
      map.set(key, { ...row, qtd: 1 })
    }
  }
  return [...map.values()].sort((a, b) => {
    const byDate = String(b.data ?? '').localeCompare(String(a.data ?? ''))
    if (byDate !== 0) return byDate
    const byPessoa = a.pessoa.localeCompare(b.pessoa, 'pt-BR')
    if (byPessoa !== 0) return byPessoa
    return a.motivo.localeCompare(b.motivo, 'pt-BR')
  })
}

export function OpsLegaisInconsistenciasCard({
  indicador,
  ano,
  mesFiltro,
  title = 'Inconsistências',
  enabled = true,
}: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const { data: rowsData, isLoading } = useQuery({
    queryKey: ['eficiencia', 'ops-desvios', indicador, ano, mesFiltro],
    enabled,
    queryFn: async () => {
      const result = await eficienciaService.fetchRacional(indicador, ano, null, mesFiltro)
      const mapped: Omit<OpsDesvioRow, 'qtd'>[] = []
      for (const row of result.linhas) {
        const d = mapDesvio(indicador, row)
        if (d) mapped.push(d)
      }
      return unificarDesvios(mapped)
    },
  })
  const rows: OpsDesvioRow[] = rowsData ?? []

  const totalOcorrencias = rows.reduce((s: number, r: OpsDesvioRow) => s + r.qtd, 0)

  return (
    <section className="rounded-xl border border-rose-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-800">{toPriMaiuscula(title)}</h3>
          <p className="text-[10px] text-slate-400">
            {isLoading
              ? 'Carregando…'
              : `${rows.length} linha${rows.length === 1 ? '' : 's'} · ${totalOcorrencias} ocorrência${totalOcorrencias === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          Nenhuma inconsistência no período selecionado.
        </p>
      ) : (
        <ul className="max-h-56 space-y-0 overflow-y-auto divide-y divide-slate-50">
          {rows.map((r: OpsDesvioRow) => {
            const nome = resolvePessoaDisplayNome(r.pessoa, teamMembers, avatarCatalog)
            const avatarUrl = resolvePessoaAvatarUrl(r.pessoa, teamMembers, avatarCatalog)
            return (
              <li
                key={`${r.pessoa}|${r.data}|${r.motivo}`}
                className="flex items-start gap-2.5 py-2"
              >
                <Avatar
                  src={avatarUrl}
                  fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                  fullName={nome}
                  size="sm"
                  className="mt-0.5 h-8 w-8 shrink-0 text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <p className="truncate text-xs font-semibold text-slate-900">{nome}</p>
                    <p className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {r.data ? formatDate(r.data) : '—'}
                      {r.qtd > 1 ? ` · ×${r.qtd}` : ''}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                    {toPriMaiuscula(r.motivo)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
