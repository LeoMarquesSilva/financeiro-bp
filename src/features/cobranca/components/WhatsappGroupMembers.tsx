import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { WhatsappAvatarImage } from './WhatsappAvatarImage'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Crown, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResolvedParticipant } from '../utils/participants'

function initials(name: string): string {
  const partes = name.replace(/[^a-zA-ZÀ-ÿ ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
  return (partes[0]?.slice(0, 2) ?? '?').toUpperCase()
}

interface Props {
  members: ResolvedParticipant[]
  loading?: boolean
}

export function WhatsappGroupMembers({ members, loading }: Props) {
  const sorted = [...members].sort((a, b) => {
    const adminA = a.admin_role ? 0 : 1
    const adminB = b.admin_role ? 0 : 1
    if (adminA !== adminB) return adminA - adminB
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Users className="h-3.5 w-3.5" />
        Membros
        {!loading && <span className="font-normal normal-case text-slate-400">({members.length})</span>}
      </h4>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando membros…
        </div>
      )}

      {!loading && members.length === 0 && (
        <p className="text-xs text-slate-400">Abra a conversa para sincronizar os membros do grupo.</p>
      )}

      {!loading && members.length > 0 && (
        <ScrollArea className="max-h-64">
          <ul className="space-y-1.5 pr-2">
            {sorted.map((m) => (
              <li
                key={m.participant_jid}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5"
              >
                <Avatar key={m.participant_jid} className="h-8 w-8 shrink-0">
                  <WhatsappAvatarImage
                    src={m.profile_pic_url}
                    alt=""
                    remoteJid={m.phone_number ?? m.participant_jid}
                    fetchIfNeeded
                    lazy
                  />
                  <AvatarFallback className="bg-slate-100 text-[10px] text-slate-600">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{m.name}</p>
                  {m.lid_id && (
                    <p className="truncate text-[10px] text-slate-400">@{m.lid_id.slice(-8)}</p>
                  )}
                </div>
                {m.admin_role && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'shrink-0 gap-0.5 px-1.5 py-0 text-[9px]',
                      m.admin_role === 'superadmin'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    <Crown className="h-2.5 w-2.5" />
                    {m.admin_role === 'superadmin' ? 'Admin' : 'Mod.'}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
