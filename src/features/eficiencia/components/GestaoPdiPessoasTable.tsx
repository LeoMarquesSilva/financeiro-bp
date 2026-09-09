import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { MESES_EFICIENCIA } from '../constants'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import type { GestaoPdiPessoaMesLinha } from '../utils/gestaoPdiCalc'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { toPriMaiuscula } from '../utils/textFormat'

type Props = {
  linhas: GestaoPdiPessoaMesLinha[]
  meses: number[]
  loading?: boolean
  /** Meses do filtro global — só visual (opacidade). */
  mesesEmDestaque?: ReadonlySet<number>
  onPessoaClick?: (nome: string) => void
  pessoaAtiva?: string | null
}

function cellClass(apta: boolean | null, emDestaque: boolean): string {
  const base =
    'min-w-[3.25rem] px-1.5 py-2 text-center text-xs font-semibold tabular-nums'
  if (apta === true) {
    return cn(base, 'bg-emerald-50 text-emerald-800', !emDestaque && 'opacity-45')
  }
  if (apta === false) {
    return cn(base, 'bg-rose-50 text-rose-800', !emDestaque && 'opacity-45')
  }
  return cn(base, 'text-slate-300', !emDestaque && 'opacity-45')
}

export function GestaoPdiPessoasTable({
  linhas,
  meses,
  loading = false,
  mesesEmDestaque,
  onPessoaClick,
  pessoaAtiva,
}: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      {loading ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      ) : linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhuma pessoa elegível no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium">
                  {toPriMaiuscula('Colaborador')}
                </th>
                {meses.map((m) => (
                  <th
                    key={m}
                    className={cn(
                      'px-1.5 py-2 text-center font-medium',
                      mesesEmDestaque && !mesesEmDestaque.has(m) && 'opacity-45',
                    )}
                  >
                    {MESES_EFICIENCIA[m - 1]}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">
                  {toPriMaiuscula('Acum.')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linhas.map((linha) => {
                const nome = resolvePessoaDisplayNome(
                  linha.colaborador,
                  teamMembers,
                  avatarCatalog,
                )
                const avatarUrl = resolvePessoaAvatarUrl(
                  linha.colaborador,
                  teamMembers,
                  avatarCatalog,
                )
                const ativa = Boolean(
                  pessoaAtiva &&
                    pessoaAtiva.localeCompare(linha.colaborador, 'pt-BR', {
                      sensitivity: 'accent',
                    }) === 0,
                )
                return (
                  <tr
                    key={linha.colaborador}
                    className={cn(ativa && 'bg-slate-50')}
                  >
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5">
                      {onPessoaClick ? (
                        <button
                          type="button"
                          className="flex max-w-[14rem] items-center gap-2 text-left"
                          onClick={() => onPessoaClick(linha.colaborador)}
                        >
                          <Avatar
                            src={avatarUrl}
                            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                            fullName={nome}
                            size="sm"
                            className="h-7 w-7 shrink-0 text-[10px]"
                          />
                          <span className="truncate font-medium text-slate-900">{nome}</span>
                        </button>
                      ) : (
                        <div className="flex max-w-[14rem] items-center gap-2">
                          <Avatar
                            src={avatarUrl}
                            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                            fullName={nome}
                            size="sm"
                            className="h-7 w-7 shrink-0 text-[10px]"
                          />
                          <span className="truncate font-medium text-slate-900">{nome}</span>
                        </div>
                      )}
                    </td>
                    {linha.cells.map((cell) => (
                      <td
                        key={cell.mes}
                        className={cellClass(
                          cell.apta,
                          !mesesEmDestaque || mesesEmDestaque.has(cell.mes),
                        )}
                      >
                        {cell.apta == null
                          ? '—'
                          : formatPercent(cell.apta ? 100 : 0)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {linha.pct != null ? formatPercent(linha.pct) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
