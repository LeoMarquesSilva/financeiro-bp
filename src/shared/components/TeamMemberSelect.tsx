import { useState, useRef, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'
import { Avatar } from '@/shared/components/Avatar'
import { getTeamMember } from '@/lib/teamAvatars'
import type { TeamMember } from '@/lib/database.types'

interface TeamMemberSelectProps {
  value: string
  onChange: (email: string) => void
  teamMembers: TeamMember[]
  placeholder?: string
  className?: string
  /** Compacto para filtros (menor altura) */
  compact?: boolean
}

export function TeamMemberSelect({
  value,
  onChange,
  teamMembers,
  placeholder = 'Selecione',
  className,
  compact = false,
}: TeamMemberSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = teamMembers.find((m) => m.email === value)
  const selectedAvatar = selected ? getTeamMember(selected.email) : null

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded border border-slate-300 bg-white text-left',
          compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-sm',
          'hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <Avatar
              src={selectedAvatar?.avatar ?? selected.avatar_url}
              fullName={selected.full_name}
              size={compact ? 'sm' : 'md'}
            />
            <span className="min-w-0 truncate">
              {selected.full_name}
              {selected.area && (
                <span className="text-slate-500"> ({selected.area})</span>
              )}
            </span>
          </>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <span className="ml-auto shrink-0 text-slate-400" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          <li
            role="option"
            aria-selected={!value}
            className={cn(
              'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100',
              !value && 'bg-slate-50'
            )}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
              –
            </span>
            <span className="text-slate-500">{placeholder}</span>
          </li>
          {teamMembers.map((m) => {
            const avatarInfo = getTeamMember(m.email)
            const isSelected = m.email === value
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100',
                  isSelected && 'bg-slate-100'
                )}
                onClick={() => {
                  onChange(m.email)
                  setOpen(false)
                }}
              >
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
