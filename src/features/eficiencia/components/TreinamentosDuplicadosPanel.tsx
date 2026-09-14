import { AlertTriangle, CalendarDays, MapPin } from 'lucide-react'
import { Avatar } from '@/shared/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import type { TreinamentoDuplicadoGrupo } from '../utils/treinamentosDedupe'

export type TreinamentoDuplicadoGrupoComArea = TreinamentoDuplicadoGrupo & {
  area: string | null
}

type Props = {
  grupos: TreinamentoDuplicadoGrupoComArea[]
}

export function TreinamentosDuplicadosPanel({ grupos }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  if (grupos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Nenhum lançamento duplicado no ano.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        Mesma pessoa, treinamento e data em qualquer área. Conferir e apagar a cópia na origem
        (SharePoint).
      </p>
      <ul className="divide-y divide-red-100 overflow-hidden rounded-xl border border-red-100">
        {grupos.map((grupo) => {
          const nome = resolvePessoaDisplayNome(grupo.colaborador, teamMembers, avatarCatalog)
          const avatarUrl = resolvePessoaAvatarUrl(grupo.colaborador, teamMembers, avatarCatalog)
          return (
            <li
              key={`${grupo.colaborador}|${grupo.treinamento}|${grupo.data ?? ''}`}
              className="flex flex-wrap items-start gap-3 bg-white px-4 py-3"
            >
              <Avatar
                src={avatarUrl}
                fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                fullName={nome}
                size="sm"
                className="h-9 w-9 shrink-0 text-[10px]"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{nome}</p>
                <p className="mt-0.5 text-sm text-slate-700">{grupo.treinamento}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {grupo.data ? formatDate(grupo.data) : 'Data não informada'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {grupo.area ?? 'Área não informada'}
                  </span>
                </p>
              </div>
              <Badge variant="destructive" className="ml-auto shrink-0 gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {grupo.qtd} {grupo.qtd === 1 ? 'lançamento' : 'lançamentos'}
              </Badge>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
