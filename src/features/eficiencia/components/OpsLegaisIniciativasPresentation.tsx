import { createContext, useContext, type ContextType, type ReactNode } from 'react'
import { AppWindow, BarChart3, Bot, Code2, Globe2, Layers3, ListChecks, Plug2, UserRound, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { projetoCategoriaPresentation, resumirSubtarefasResponsaveis, splitIniciativasResponsaveis, type IniciativaSubtarefaRealizada } from '../utils/opsLegaisProjetoPresentation'

const PESSOAS_DEFAULT = { teamMembers: [], avatarCatalog: [] }
const PessoasContext = createContext<{
  teamMembers: ReturnType<typeof useTeamMembers>['teamMembers']
  avatarCatalog: ReturnType<typeof useBpUsuariosAvatar>['usuarios']
}>(PESSOAS_DEFAULT)

function resolveIniciativaPessoa(nome: string, { teamMembers, avatarCatalog }: ContextType<typeof PessoasContext>) {
  const email = nome.includes('@') ? nome.toLowerCase() : null
  const identityNome = email
    ? avatarCatalog.find((pessoa) => pessoa.email?.toLowerCase() === email)?.nome
      ?? teamMembers.find((pessoa) => pessoa.email.toLowerCase() === email)?.full_name
      ?? nome
    : nome
  return {
    email,
    displayNome: email && identityNome === nome ? nome : resolvePessoaDisplayNome(identityNome, teamMembers, avatarCatalog),
    avatarUrl: resolvePessoaAvatarUrl(identityNome, teamMembers, avatarCatalog),
  }
}

export function IniciativasPessoasProvider({ children }: { children: ReactNode }) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  return <PessoasContext.Provider value={{ teamMembers, avatarCatalog }}>{children}</PessoasContext.Provider>
}

export function useIniciativasPessoaNome() {
  const pessoas = useContext(PessoasContext)
  return (nome: string) => resolveIniciativaPessoa(nome, pessoas).displayNome
}

export function IniciativasResponsaveis({ value, compact = false }: { value: string | null | undefined; compact?: boolean }) {
  const pessoas = useContext(PessoasContext)
  const nomes = splitIniciativasResponsaveis(value)
  if (!nomes.length) {
    return (
      <span className="inline-flex items-center gap-2.5 text-xs text-slate-400">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-200">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
        </span>
        Sem responsável
      </span>
    )
  }
  return (
    <div className="space-y-2.5">
      {nomes.map((nome) => {
        const { email, displayNome, avatarUrl } = resolveIniciativaPessoa(nome, pessoas)
        return (
          <div key={nome} className="flex items-center gap-2.5">
            <Avatar
              src={avatarUrl}
              email={email}
              fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
              fullName={displayNome}
              size="md"
              className={cn('bg-slate-100 text-[10px] ring-2 ring-white', compact ? 'h-6 w-6' : 'h-8 w-8')}
            />
            <span className={cn('min-w-0 break-words font-medium leading-relaxed text-slate-600', compact ? 'text-sm' : 'text-sm xl:text-base')}>
              {displayNome}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function IniciativasResumoResponsaveis({ subtarefas, loading, responsavelAtivo, onResponsavelChange }: {
  subtarefas: IniciativaSubtarefaRealizada[]
  loading: boolean
  responsavelAtivo: string | null
  onResponsavelChange: (nome: string | null) => void
}) {
  const pessoas = useContext(PessoasContext)
  const resumo = resumirSubtarefasResponsaveis(subtarefas, (nome) => resolveIniciativaPessoa(nome, pessoas).displayNome)
  return (
    <section aria-label="Subtarefas por responsável" className="border-b border-slate-200 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <h4 className="text-sm font-semibold text-slate-700">Subtarefas por responsável</h4>
        <p className="text-sm text-slate-500">
          {loading ? 'Carregando…' : <><span className="font-medium tabular-nums text-slate-600">{resumo.total}</span> concluída{resumo.total === 1 ? '' : 's'} nesta visão</>}
        </p>
      </div>
      {loading ? (
        <div className="mt-3 h-12 animate-pulse rounded-lg bg-slate-50" aria-hidden />
      ) : resumo.responsaveis.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {resumo.responsaveis.map(({ nome, total, semResponsavel }) => (
            <li key={nome} className="max-w-full">
              <button
                type="button"
                aria-pressed={responsavelAtivo === (semResponsavel ? '' : nome)}
                onClick={() => onResponsavelChange(responsavelAtivo === (semResponsavel ? '' : nome) ? null : semResponsavel ? '' : nome)}
                className={cn(
                  'flex max-w-full items-center justify-between gap-4 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
                  responsavelAtivo === (semResponsavel ? '' : nome)
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/60 hover:border-emerald-300 hover:bg-emerald-50/50',
                )}
              >
                <IniciativasResponsaveis value={semResponsavel ? '' : nome} compact />
                <span aria-label={`${total} subtarefa${total === 1 ? '' : 's'} concluída${total === 1 ? '' : 's'}`} className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold tabular-nums text-emerald-700">
                  {total}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Nenhuma subtarefa concluída nesta visão.</p>
      )}
      {responsavelAtivo !== null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
          <p className="text-emerald-800">Mostrando subtarefas de <strong>{responsavelAtivo || 'Sem responsável'}</strong>.</p>
          <button type="button" onClick={() => onResponsavelChange(null)} className="rounded-md px-2 py-1 font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Mostrar todos</button>
        </div>
      ) : null}
      {!loading && resumo.compartilhadas > 0 ? (
        <p className="mt-2.5 text-xs leading-relaxed text-slate-500">Subtarefas compartilhadas contam uma vez para cada responsável.</p>
      ) : null}
    </section>
  )
}

const CATEGORIA_ICONS = { saas: AppWindow, automation: Workflow, process: ListChecks, agent: Bot, web: Globe2, integration: Plug2, software: Code2, bi: BarChart3, other: Layers3 }

export function ProjetoCategoriaBadge({ tipo }: { tipo: string | null | undefined }) {
  const { label, icon } = projetoCategoriaPresentation(tipo)
  const Icon = CATEGORIA_ICONS[icon]
  return (
    <span className="inline-flex max-w-full items-start gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-xs font-medium leading-relaxed text-slate-600">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  )
}

export function ProjetoTipoIcon({ tipo }: { tipo: string | null | undefined }) {
  const { icon } = projetoCategoriaPresentation(tipo)
  const Icon = CATEGORIA_ICONS[icon]
  return (
    <span className={cn(
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
      icon === 'saas' || icon === 'software' ? 'bg-sky-50 text-sky-600'
        : icon === 'automation' || icon === 'integration' ? 'bg-amber-50 text-amber-600'
          : icon === 'process' ? 'bg-emerald-50 text-emerald-600'
            : 'bg-slate-100 text-slate-500',
    )}>
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </span>
  )
}
