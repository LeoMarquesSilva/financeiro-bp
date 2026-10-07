import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import {
  resolveAvatarFromCatalog,
  useBpUsuariosAvatar,
  type BpUsuarioAvatar,
} from '@/features/eficiencia/hooks/useBpUsuariosAvatar'
import { formatTimesheetHoras } from '../utils/formatTimesheetHoras'
import type { TimesheetFatia } from '../services/timesheetService'

type Props = {
  rows: TimesheetFatia[]
  totalMinutos: number
  loading?: boolean
  vazio?: string
  /** Foto oficial (ORQESTRAI) no ranking de responsáveis. */
  comFoto?: boolean
}

function pessoaDoNome(
  nome: string,
  usuarios: BpUsuarioAvatar[],
  byNomeChave: Map<string, BpUsuarioAvatar>,
  normalizeNomeChave: (nome: string) => string,
): BpUsuarioAvatar | null {
  const chave = normalizeNomeChave(nome)
  const exata = byNomeChave.get(chave)
  if (exata) return exata
  const tokens = chave.split(' ').filter((t) => t.length > 2)
  if (tokens.length >= 2) {
    const fuzzy = usuarios.find((u) => tokens.every((t) => u.nome_chave.includes(t)))
    if (fuzzy) return fuzzy
  }
  return (
    usuarios.find(
      (u) =>
        u.nome_chave.startsWith(chave) ||
        chave.startsWith(u.nome_chave.split(' ').slice(0, 2).join(' ')),
    ) ?? null
  )
}

export function TimesheetRanking({ rows, totalMinutos, loading, vazio, comFoto }: Props) {
  const { usuarios, byNomeChave, normalizeNomeChave } = useBpUsuariosAvatar()
  const max = rows.reduce((m, row) => Math.max(m, row.minutos), 0)

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{vazio ?? 'Sem lançamentos no período.'}</p>
  }

  return (
    <ol className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
      {rows.map((row, index) => {
        const pctBarra = max > 0 ? (row.minutos / max) * 100 : 0
        const pctTotal = totalMinutos > 0 ? (row.minutos / totalMinutos) * 100 : 0
        const pessoa = comFoto
          ? pessoaDoNome(row.nome, usuarios, byNomeChave, normalizeNomeChave)
          : null
        const avatarUrl = comFoto ? resolveAvatarFromCatalog(row.nome, usuarios) : null
        return (
          <li key={`${row.nome}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">
                  {index + 1}
                </span>
                {comFoto ? (
                  <Avatar
                    fullName={pessoa?.nome || row.nome}
                    email={pessoa?.email}
                    src={avatarUrl ?? pessoa?.avatar_url}
                    size="md"
                    className="h-9 w-9 text-xs"
                  />
                ) : null}
                <p className="min-w-0 truncate text-sm font-medium text-slate-800" title={row.nome}>
                  {row.nome}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                {formatTimesheetHoras(row.minutos)}
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#C6A361]"
                style={{ width: `${Math.max(pctBarra, row.minutos > 0 ? 2 : 0)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {formatPercent(pctTotal)} do período · {row.lancamentos.toLocaleString('pt-BR')}{' '}
              {row.lancamentos === 1 ? 'lançamento' : 'lançamentos'}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
