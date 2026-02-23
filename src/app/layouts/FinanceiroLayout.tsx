import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Menu, X, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearAuthenticated } from '@/lib/auth'

const LOGO_BRANCO = '/team/logo-branco.png'

const navLinks = [
  { to: '/financeiro/inadimplencia', label: 'Inadimplência' },
  { to: '/financeiro/inadimplencia/dashboard', label: 'Dashboard' },
  { to: '/financeiro/escritorio', label: 'Escritório' },
]

function NavItems({ onLinkClick }: { onLinkClick?: () => void }) {
  return (
    <>
      {navLinks.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onLinkClick}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-[15px] font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-800',
              isActive
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </>
  )
}

export function FinanceiroLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 w-full bg-slate-800 shadow-lg">
        {/* Barra superior (faixa fina no topo) */}
        <div className="h-1 w-full bg-slate-600" aria-hidden />

        <div className="container mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-4 sm:px-6 lg:px-8">
          {/* Logo principal */}
          <NavLink
            to="/financeiro/inadimplencia"
            className="relative flex shrink-0 items-center focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-800 rounded-md"
            aria-label="Ir para Inadimplência"
          >
            <img
              src={LOGO_BRANCO}
              alt="Bismarchi Pires - Sociedade de Advogados"
              className="h-10 w-auto max-w-[180px] object-contain object-left sm:h-12 sm:max-w-[200px]"
            />
          </NavLink>

          {/* Navegação desktop */}
          <nav
            className="hidden flex-1 items-center justify-center gap-2 md:flex md:gap-6"
            aria-label="Menu financeiro"
          >
            <NavItems />
          </nav>

          {/* Logout (desktop) */}
          <div className="hidden flex-shrink-0 md:block">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearAuthenticated()
                window.location.href = '/'
              }}
              className="gap-2 text-slate-300 hover:bg-slate-700/50 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          {/* Botão menu mobile */}
          <div className="flex flex-1 justify-end gap-2 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearAuthenticated()
                window.location.href = '/'
              }}
              className="h-10 w-10 text-slate-300 hover:bg-slate-700/50 hover:text-white"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="h-10 w-10 text-slate-300 hover:bg-slate-700/50 hover:text-white"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Menu mobile (painel expandido) */}
        {mobileMenuOpen && (
          <div
            className="border-t border-slate-700/50 bg-slate-800 shadow-lg md:hidden"
            role="dialog"
            aria-label="Menu de navegação"
          >
            <div className="container mx-auto max-w-[1400px] space-y-1 py-4 px-4 sm:px-6">
              <NavItems onLinkClick={closeMobileMenu} />
              <button
                type="button"
                onClick={() => {
                  clearAuthenticated()
                  window.location.href = '/'
                }}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-4 py-3 text-[15px] font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
