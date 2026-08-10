import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { toPriMaiuscula } from '../utils/textFormat'
import { isOpsLegaisCadastroDeParaOk } from '../utils/racionalFormat'
import { resolveOpsLegaisPubResponsavel, type MesFiltroEficiencia } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { RacionalIndicador } from '../types/eficiencia.types'

export type OpsDesvioDetalhe = {
  id: string
  data: string | null
  processo: string | null
  motivo: string
  area: string | null
  check: string | null
}

export type OpsDesvioRow = {
  pessoa: string
  qtd: number
  detalhes: OpsDesvioDetalhe[]
}

type Props = {
  indicador: Extract<
    RacionalIndicador,
    | 'ops_legais_sla_protocolo'
    | 'ops_legais_eficiencia_protocolo'
    | 'ops_legais_pub_analise'
    | 'ops_legais_pub_agendamento'
    | 'ops_legais_cadastro'
  >
  ano: number
  mesFiltro: MesFiltroEficiencia
  title?: string
  enabled?: boolean
}

function isPubIndicador(indicador: Props['indicador']): boolean {
  return indicador === 'ops_legais_pub_analise' || indicador === 'ops_legais_pub_agendamento'
}

function normalizeKeyPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
}

/** Data civil YYYY-MM-DD (ignora hora). */
function dataDia(value: string | null): string | null {
  if (!value) return null
  const iso = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : String(value).trim() || null
}

/** Uma linha por pessoa — motivo e data só no mini-racional. */
function rowKey(pessoa: string): string {
  return normalizeKeyPart(pessoa)
}

type MappedDesvio = {
  pessoa: string
  detalhe: OpsDesvioDetalhe
}

function processoDaLinha(row: Record<string, unknown>): string | null {
  return (
    String(row.protocolo_nos_autos ?? row.numero_processo ?? row.nro_cnj ?? '').trim() || null
  )
}

function mapDesvio(
  indicador: Props['indicador'],
  row: Record<string, unknown>,
): MappedDesvio | null {
  const id = row.sp_id == null ? '' : String(row.sp_id)
  const area = String(row.area ?? '').trim() || null
  const processo = processoDaLinha(row)
  if (indicador === 'ops_legais_sla_protocolo') {
    if (String(row.eficiencia_sla ?? '').trim() !== 'PROTOCOLADO NO FATAL') return null
    const data = dataDia(row.protocolado_em == null ? null : String(row.protocolado_em))
    return {
      pessoa: String(row.protocolado_por ?? '').trim() || '—',
      detalhe: { id, data, processo, motivo: 'Protocolado no Fatal', area, check: null },
    }
  }
  if (indicador === 'ops_legais_eficiencia_protocolo') {
    const flag = String(row.inconsistencia_controladoria ?? '').trim()
    if (!flag) return null
    const motivo = String(row.inconsistencia_controladoria_motivo ?? '').trim()
    const data = dataDia(row.protocolado_em == null ? null : String(row.protocolado_em))
    return {
      pessoa: String(row.protocolado_por ?? '').trim() || '—',
      detalhe: {
        id,
        data,
        processo,
        motivo: motivo || flag || 'Inconsistência Controladoria',
        area,
        check: null,
      },
    }
  }
  if (indicador === 'ops_legais_cadastro') {
    if (isOpsLegaisCadastroDeParaOk(row.adesao_indicador)) return null
    const motivo = String(row.adesao_indicador ?? '').trim()
    const tipo =
      String(row.tipo_abertura_encerramento ?? '').trim() ||
      String(row.tipo_agendamento ?? '').trim() ||
      null
    const data = dataDia(row.solicitado_em == null ? null : String(row.solicitado_em))
    return {
      pessoa: String(row.agendado_por ?? '').trim() || '—',
      detalhe: {
        id,
        data,
        processo: tipo,
        motivo: motivo || 'Inconsistência',
        area: String(row.area_equipe ?? '').trim() || null,
        check: null,
      },
    }
  }
  if (String(row.eficiencia ?? '').trim() !== 'DESVIO') return null
  const subtipo = String(row.inconsistencia_subtipo ?? '').trim()
  const tipo = String(row.inconsistencias_tipo ?? '').trim()
  // Análise: responsável por Área (Trabalhista → Isadora; demais → Giovanna).
  // Agendamento: quem realmente agendou (AGENDADO POR).
  const pessoa =
    indicador === 'ops_legais_pub_analise'
      ? resolveOpsLegaisPubResponsavel(area)
      : String(row.agendado_por ?? '').trim() || '—'
  const data = dataDia(
    row.data_recebimento_kurier == null ? null : String(row.data_recebimento_kurier),
  )
  const check = String(row.check_pub ?? '').trim() || null
  return {
    pessoa,
    detalhe: {
      id,
      data,
      processo,
      motivo: subtipo || tipo || 'Desvio',
      area,
      check,
    },
  }
}

function unificarDesvios(rows: MappedDesvio[]): OpsDesvioRow[] {
  const map = new Map<string, OpsDesvioRow>()
  for (const row of rows) {
    const key = rowKey(row.pessoa)
    const prev = map.get(key)
    if (prev) {
      prev.qtd += 1
      prev.detalhes.push(row.detalhe)
    } else {
      map.set(key, { pessoa: row.pessoa, qtd: 1, detalhes: [row.detalhe] })
    }
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      detalhes: [...row.detalhes].sort((a, b) => {
        const byDate = String(b.data ?? '').localeCompare(String(a.data ?? ''))
        if (byDate !== 0) return byDate
        return a.motivo.localeCompare(b.motivo, 'pt-BR')
      }),
    }))
    .sort((a, b) => {
      const byQtd = b.qtd - a.qtd
      if (byQtd !== 0) return byQtd
      return a.pessoa.localeCompare(b.pessoa, 'pt-BR')
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
  const [abertoKey, setAbertoKey] = useState<string | null>(null)
  const showCheck = isPubIndicador(indicador)
  const processoColLabel = indicador === 'ops_legais_cadastro' ? 'Tipo' : 'Processo'

  const { data: rowsData, isLoading } = useQuery({
    queryKey: ['eficiencia', 'ops-desvios', indicador, ano, mesFiltro],
    enabled,
    queryFn: async () => {
      const result = await eficienciaService.fetchRacional(indicador, ano, null, mesFiltro)
      const mapped: MappedDesvio[] = []
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
              : `${rows.length} pessoa${rows.length === 1 ? '' : 's'} · ${totalOcorrencias} ocorrência${totalOcorrencias === 1 ? '' : 's'}`}
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
        <ul className="max-h-80 space-y-0 overflow-y-auto divide-y divide-slate-50">
          {rows.map((r: OpsDesvioRow) => {
            const key = rowKey(r.pessoa)
            const aberto = abertoKey === key
            const nome = resolvePessoaDisplayNome(r.pessoa, teamMembers, avatarCatalog)
            const avatarUrl = resolvePessoaAvatarUrl(r.pessoa, teamMembers, avatarCatalog)
            return (
              <li key={key} className="py-1">
                <button
                  type="button"
                  onClick={() => setAbertoKey(aberto ? null : key)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-rose-50/60"
                >
                  <Avatar
                    src={avatarUrl}
                    fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                    fullName={nome}
                    size="sm"
                    className="h-8 w-8 shrink-0 text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-x-2">
                      <p className="truncate text-xs font-semibold text-slate-900">{nome}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <p className="text-[10px] tabular-nums text-slate-400">×{r.qtd}</p>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-slate-400 transition-transform',
                            aberto && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {aberto ? (
                  <div className="mb-1.5 ml-10 mt-1 overflow-hidden rounded-md border border-rose-100/80 bg-rose-50/40">
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="border-b border-rose-100/80 text-slate-500">
                          <th className="px-2 py-1.5 font-semibold">ID</th>
                          <th className="px-2 py-1.5 font-semibold">{processoColLabel}</th>
                          <th className="px-2 py-1.5 font-semibold">Data</th>
                          <th className="px-2 py-1.5 font-semibold">Área</th>
                          <th className="px-2 py-1.5 font-semibold">Motivo</th>
                          {showCheck ? (
                            <th className="px-2 py-1.5 font-semibold">Check</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100/60">
                        {r.detalhes.map((d, i) => (
                          <tr key={`${d.id || 'sem-id'}-${i}`} className="text-slate-700">
                            <td className="px-2 py-1 font-medium tabular-nums">{d.id || '—'}</td>
                            <td className="max-w-[9rem] px-2 py-1 tabular-nums text-slate-600">
                              <span className="line-clamp-2 break-all">{d.processo || '—'}</span>
                            </td>
                            <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                              {d.data ? formatDate(d.data) : '—'}
                            </td>
                            <td className="px-2 py-1 text-slate-600 whitespace-nowrap">
                              {d.area ? toPriMaiuscula(d.area) : '—'}
                            </td>
                            <td className="px-2 py-1 text-slate-600">
                              {toPriMaiuscula(d.motivo)}
                            </td>
                            {showCheck ? (
                              <td className="px-2 py-1 text-slate-600">
                                {d.check ? toPriMaiuscula(d.check) : '—'}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
