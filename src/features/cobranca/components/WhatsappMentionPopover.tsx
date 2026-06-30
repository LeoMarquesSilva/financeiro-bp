import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { isPhoneFormattedLabel } from '../utils/contactDisplay'
import type { ResolvedParticipant } from '../utils/participants'
import { avatarRemoteJidForParticipant } from '../utils/participants'
import { WhatsappAvatarImage } from './WhatsappAvatarImage'

function initials(name: string): string {
  const partes = name.replace(/[^a-zA-ZÀ-ÿ ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
  return (partes[0]?.slice(0, 2) ?? '?').toUpperCase()
}

interface Props {
  members: ResolvedParticipant[]
  activeIndex: number
  onSelect: (member: ResolvedParticipant) => void
  onHover: (index: number) => void
}

export function WhatsappMentionPopover({ members, activeIndex, onSelect, onHover }: Props) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (members.length === 0) {
    return (
      <div className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-xl">
        Nenhum membro encontrado
      </div>
    )
  }

  return (
    <ul
      ref={listRef}
      role="listbox"
      className="max-h-64 w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    >
      {members.map((m, i) => (
        <li
          key={m.participant_jid}
          role="option"
          aria-selected={i === activeIndex}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm',
            i === activeIndex ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50',
          )}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(m)
          }}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <WhatsappAvatarImage
              src={m.profile_pic_url}
              alt=""
              remoteJid={avatarRemoteJidForParticipant(m) ?? undefined}
              fetchIfNeeded
              lazy
            />
            <AvatarFallback className="bg-slate-100 text-[9px] text-slate-600">
              {initials(m.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-800">{m.name}</p>
            {m.phoneLabel && m.name !== m.phoneLabel && !isPhoneFormattedLabel(m.name) && (
              <p className="truncate text-[10px] text-slate-400">{m.phoneLabel}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
