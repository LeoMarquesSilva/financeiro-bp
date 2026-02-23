import { formatCurrency } from '@/shared/utils/format'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { Avatar } from '@/shared/components/Avatar'
import type { RankingItem } from '../services/dashboardService'
import { useDashboard } from '../hooks/useDashboard'
import { useTeamMembers } from '../hooks/useTeamMembers'

export function InadimplenciaDashboardPage() {
  const { data, loading, error } = useDashboard()
  const { teamMembers } = useTeamMembers()

  if (loading) {
    return (
      <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard Estratégico</h1>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard Estratégico</h1>
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar o dashboard. Verifique a conexão com o Supabase.
        </p>
      </div>
    )
  }

  const {
    totais,
    rankingGestores,
    rankingAreas,
    valorEmAbertoPorGestor,
    valorEmAbertoPorArea,
    tempoMedioRecuperacaoDias,
  } = data

  return (
    <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard Estratégico</h1>
        <p className="mt-1 text-sm text-slate-500">Visão geral e indicadores de inadimplência</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Resumo</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total em aberto</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totais.totalEmAberto)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total recuperado no mês</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totais.totalRecuperadoMes)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">% Recuperação</p>
            <p className="text-2xl font-bold text-slate-900">{totais.percentualRecuperacao.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Tempo médio de recuperação</p>
            <p className="text-2xl font-bold text-slate-900">
              {tempoMedioRecuperacaoDias != null ? `${tempoMedioRecuperacaoDias} dias` : '–'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Total por classe (em aberto)</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded bg-blue-50 px-3 py-2">
              <span className="text-sm font-medium text-blue-900">Classe A</span>
              <span className="font-bold text-blue-900">{formatCurrency(totais.totalClasseA)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-amber-50 px-3 py-2">
              <span className="text-sm font-medium text-amber-900">Classe B</span>
              <span className="font-bold text-amber-900">{formatCurrency(totais.totalClasseB)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-red-50 px-3 py-2">
              <span className="text-sm font-medium text-red-900">Classe C</span>
              <span className="font-bold text-red-900">{formatCurrency(totais.totalClasseC)}</span>
            </div>
          </div>
          <div className="mt-4 h-48">
            <GraficoClasses
              a={totais.totalClasseA}
              b={totais.totalClasseB}
              c={totais.totalClasseC}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Ranking por gestor (recuperação no mês)</h3>
          {rankingGestores.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado no mês.</p>
          ) : (
            <ul className="space-y-2">
              {rankingGestores.slice(0, 8).map((item: RankingItem, i: number) => {
                const member = resolveTeamMember(item.nome, teamMembers)
                return (
                  <li key={item.nome} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                      {member && (
                        <Avatar
                          src={getTeamMember(member.email)?.avatar ?? member.avatar_url}
                          fullName={member.full_name}
                          size="md"
                        />
                      )}
                      <span className="truncate">
                        {i + 1}. {member ? `${member.full_name} (${member.area})` : item.nome}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-slate-900">{formatCurrency(item.valor)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold text-slate-800">Ranking por área (recuperação no mês)</h3>
        {rankingAreas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum dado no mês.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rankingAreas.slice(0, 9).map((item: RankingItem, i: number) => (
              <li key={item.nome} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-medium text-slate-700">
                  {i + 1}. {item.nome}
                </span>
                <span className="font-medium text-slate-900">{formatCurrency(item.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Valor em aberto por gestor</h3>
          {valorEmAbertoPorGestor.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado.</p>
          ) : (
            <div className="space-y-2">
              {valorEmAbertoPorGestor.slice(0, 8).map((item: RankingItem) => {
                const member = resolveTeamMember(item.nome, teamMembers)
                const displayName = member ? `${member.full_name} (${member.area})` : item.nome
                return (
                  <div key={item.nome} className="flex items-center gap-2">
                    <span className="flex min-w-0 shrink-0 items-center gap-2">
                      {member && (
                        <Avatar
                          src={getTeamMember(member.email)?.avatar ?? member.avatar_url}
                          fullName={member.full_name}
                          size="sm"
                        />
                      )}
                      <span className="w-36 truncate text-sm font-medium text-slate-700" title={displayName}>
                        {displayName}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-6 rounded bg-slate-600"
                        style={{
                          width: `${
                            totais.totalEmAberto > 0
                              ? Math.max(4, (item.valor / totais.totalEmAberto) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(item.valor)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Valor em aberto por área</h3>
          {valorEmAbertoPorArea.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado.</p>
          ) : (
            <div className="space-y-2">
              {valorEmAbertoPorArea.slice(0, 8).map((item: RankingItem) => (
                <div key={item.nome} className="flex items-center gap-2">
                  <span className="w-32 truncate text-sm font-medium text-slate-700">{item.nome}</span>
                  <div className="flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-6 rounded bg-slate-600"
                      style={{
                        width: `${
                          totais.totalEmAberto > 0
                            ? Math.max(4, (item.valor / totais.totalEmAberto) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(item.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function GraficoClasses({ a, b, c }: { a: number; b: number; c: number }) {
  const total = a + b + c || 1
  const pctA = (a / total) * 100
  const pctB = (b / total) * 100
  const pctC = (c / total) * 100

  return (
    <div className="flex h-full w-full items-end gap-1" aria-label="Gráfico total por classe">
      <div
        className="flex-1 rounded-t bg-blue-500 transition-all"
        style={{ height: `${Math.max(pctA, 2)}%` }}
        title={`Classe A: ${pctA.toFixed(0)}%`}
      />
      <div
        className="flex-1 rounded-t bg-amber-500 transition-all"
        style={{ height: `${Math.max(pctB, 2)}%` }}
        title={`Classe B: ${pctB.toFixed(0)}%`}
      />
      <div
        className="flex-1 rounded-t bg-red-500 transition-all"
        style={{ height: `${Math.max(pctC, 2)}%` }}
        title={`Classe C: ${pctC.toFixed(0)}%`}
      />
    </div>
  )
}
