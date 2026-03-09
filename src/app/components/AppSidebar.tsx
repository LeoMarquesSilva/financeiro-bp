import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { AlertTriangle, BarChart3, Building2, Users, Settings, LogOut, UserCog } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import type { AppRole } from '@/lib/database.types'

const LOGO_FENIX = '/fenix.png'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: AppRole[]
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/financeiro/inadimplencia', label: 'Inadimplência', icon: AlertTriangle, roles: ['admin', 'financeiro', 'comite'], end: true },
  { to: '/financeiro/inadimplencia/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'financeiro', 'comite'] },
  { to: '/financeiro/escritorio', label: 'Escritório', icon: Building2, roles: ['admin', 'financeiro'] },
  { to: '/financeiro/gestores', label: 'Gestores', icon: Users, roles: ['admin'] },
  { to: '/financeiro/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin'] },
]

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AppSidebar() {
  const { role, fullName, avatarUrl, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const visibleItems = useMemo(
    () => navItems.filter((item) => role && item.roles.includes(role)),
    [role],
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="glass-sidebar fixed inset-y-0 left-0 z-40 flex w-14 flex-col">
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center justify-center">
          <NavLink
            to="/financeiro/inadimplencia"
            className="flex items-center justify-center rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <img
              src={LOGO_FENIX}
              alt="Bismarchi Pires"
              className="h-8 w-8 object-contain"
            />
          </NavLink>
        </div>

        <div className="mx-2.5 h-px bg-white/[0.06]" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-1.5 py-4" aria-label="Menu principal">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    className={cn(
                      'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      isActive
                        ? 'glass-item-active text-white'
                        : 'text-slate-400 hover:glass-item hover:text-white',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sales" />
                    )}
                    <Icon className={cn('h-[18px] w-[18px] transition-colors', isActive ? 'text-sales' : 'text-slate-400 group-hover:text-white')} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="mx-2.5 h-px bg-white/[0.06]" />

        {/* User footer */}
        <div className="flex flex-col items-center gap-2 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate('/financeiro/perfil')}
                className="cursor-pointer rounded-full transition-all hover:ring-2 hover:ring-sales/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Meu perfil"
              >
                <Avatar className="h-7 w-7 ring-2 ring-white/10">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-sidebar-accent text-[10px] text-white">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {fullName} · Meu Perfil
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate('/financeiro/perfil')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Configurações"
              >
                <UserCog className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Perfil</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={signOut}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
