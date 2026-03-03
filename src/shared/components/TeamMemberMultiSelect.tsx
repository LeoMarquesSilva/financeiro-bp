import { useState, useRef, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'
import { Avatar } from '@/shared/components/Avatar'
import { getTeamMember } from '@/lib/teamAvatars'
import type { TeamMember } from '@/lib/database.types'
import { X } from 'lucide-react'

interface TeamMemberMultiSelectProps {
  value: string[]
  onChange: (emails: string[]) => void
  teamMembers: TeamMember[]
  placeholder?: string
  className?: string
}

export function TeamMemberMultiSelect({
  value,
  onChange,
  teamMembers,
  placeholder = 'Selecione gestores',
  className,
}: TeamMemberMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  const selectedMembers = teamMembers.filter((m) => value.includes(m.email))

  const toggle = (email: string) => {
    if (value.includes(email)) {
      onChange(value.filter((e) => e !== email))
    } else {
      onChange([...value, email])
    }
  }

  const remove = (email: string) => {
    onChange(value.filter((e) => e !== email))
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full min-h-9 flex-wrap items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm',
          'hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedMembers.length > 0 ? (
          selectedMembers.map((m) => {
            const avatarInfo = getTeamMember(m.email)
            return (
              <span
                key={m.email}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs"
              >
                <Avatar
                  src={avatarInfo?.avatar ?? m.avatar_url}
                  fullName={m.full_name}
                  size="xs"
                />
                <span className="max-w-[120px] truncate">{m.full_name.split(' ')[0]}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(m.email)
                  }}
                  aria-label={`Remover ${m.full_name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <span className="ml-auto shrink-0 pl-1 text-slate-400" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          {teamMembers.map((m) => {
            const avatarInfo = getTeamMember(m.email)
            const isSelected = value.includes(m.email)
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100',
                  isSelected && 'bg-slate-50'
                )}
                onClick={() => toggle(m.email)}
              >
                <div className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300'
                )}>
                  {isSelected && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <Avatar
                  src={avatarInfo?.avatar ?? m.avatar_url}
                  fullName={m.full_name}
                  size="sm"
                />
                <span className="min-w-0 truncate">
                  {m.full_name}
                  {m.area && (
                    <span className="text-slate-500"> ({m.area})</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
