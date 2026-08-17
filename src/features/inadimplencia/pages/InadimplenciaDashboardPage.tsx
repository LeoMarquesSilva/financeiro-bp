import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { useOfficialPhotos } from '@/lib/OfficialPhotosProvider'
import { Avatar } from '@/shared/components/Avatar'
import type { RankingItem } from '../services/dashboardService'
import { useDashboard } from '../hooks/useDashboard'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useExibirTaxaRecuperacaoComite } from '@/features/configuracoes/hooks/useExibirTaxaRecuperacaoComite'
import {
  DashboardCarteiraCard,
  carteiraCurrency,
} from '../components/DashboardCarteiraCard'
import { DashboardComposicaoBar } from '../components/DashboardComposicaoBar'
import { AlertTriangle, Clock, Scale } from 'lucide-react'

export function InadimplenciaDashboardPage() {
  useOfficialPhotos()
  const { data, loading, error } = useDashboard()
  const { allTeamMembers } = useTeamMembers()
  const { exibirTaxaRecuperacaoComite } = useExibirTaxaRecuperacaoComite()

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Estratégico</h1>
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Estratégico</h1>
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar o dashboard. Verifique a conexão com o Supabase.
        </p>
      </div>
    )
  }

  const {
    totais,
    carteiras,
    taxaRecuperacaoComite,
    rankingGestores,
    rankingAreas,
    valorEmAbertoPorGestor,
    valorEmAbertoPorArea,
    tempoMedioRecuperacaoDias,
  } = data

  const barDenominatorOperacional = totais.totalEmAbertoOperacional

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Estratégico</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão consolidada das três carteiras de inadimplência
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Carteiras de inadimplência</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <DashboardCarteiraCard
            to="/financeiro/cobranca/seguimento"
            title="Inadimplência Pontual"
            description="Títulos vencidos de 1 a 60 dias após a cobrança D+1 (fora do comitê)."
            icon={Clock}
            accentClass="bg-amber-100 text-amber-700"
            stats={[
              { label: 'Valor em aberto', value: carteiraCurrency(carteiras.pontual.valorEmAberto) },
              { label: 'Grupos devedores', value: String(carteiras.pontual.qtdGrupos) },
              {
                label: 'Faixa 31–60 dias',
                value: carteiraCurrency(carteiras.pontual.valorFaixa31_60),
                hint: `${carteiras.pontual.mediaDiasAtraso} dias (média)`,
              },
            ]}
          />
          <DashboardCarteiraCard
            to="/financeiro/inadimplencia"
            title="Inadimplência Recorrente"
            description="Clientes com atraso recorrente e classes A/B/C."
            icon={AlertTriangle}
            accentClass="bg-red-100 text-red-700"
            stats={[
              { label: 'Valor em aberto', value: carteiraCurrency(carteiras.recorrente.valorEmAberto) },
              { label: 'Clientes ativos', value: String(carteiras.recorrente.qtdClientes) },
              {
                label: 'Classes A / B / C',
                value: `${carteiraCurrency(carteiras.recorrente.classeA)} / ${carteiraCurrency(carteiras.recorrente.classeB)} / ${carteiraCurrency(carteiras.recorrente.classeC)}`,
              },
            ]}
          />
          <DashboardCarteiraCard
            to="/financeiro/inadimplencia/judicializada"
            title="Inadimplência Judicializada"
            description="Casos antigos ajuizados, com processo VIOS e correção INPC + juros TJSP."
            icon={Scale}
            accentClass="bg-slate-200 text-slate-700"
            stats={[
              {
                label: 'Valor de ajuizamento',
                value: carteiraCurrency(carteiras.judicializada.totalValorCausa),
                hint: 'Soma valor da causa (planilha)',
              },
              {
                label: 'Lançamento VIOS (grupo)',
                value: carteiraCurrency(carteiras.judicializada.totalLancamentoVios),
                hint: 'Saldo financeiro do grupo devedor',
              },
              {
                label: 'Valor corrigido',
                value: carteiraCurrency(carteiras.judicializada.valorEmAberto),
                hint: 'INPC + juros TJSP',
              },
            ]}
          />
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Composição do total em aberto
          </p>
          <DashboardComposicaoBar
            total={totais.totalEmAberto}
            items={[
              {
                key: 'pontual',
                label: 'Pontual',
                valor: carteiras.pontual.valorEmAberto,
                colorClass: 'bg-amber-500',
              },
              {
                key: 'recorrente',
                label: 'Recorrente',
                valor: carteiras.recorrente.valorEmAberto,
                colorClass: 'bg-red-500',
              },
              {
                key: 'judicializada',
                label: 'Judicializada',
                valor: carteiras.judicializada.valorEmAberto,
                colorClass: 'bg-slate-600',
              },
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Resumo</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total em aberto</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totais.totalEmAberto)}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Pontual {formatCurrency(carteiras.pontual.valorEmAberto)} · Recorrente{' '}
              {formatCurrency(carteiras.recorrente.valorEmAberto)} · Judicializada{' '}
              {formatCurrency(carteiras.judicializada.valorEmAberto)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total recuperado no mês</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totais.totalRecuperadoMes)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">% Recuperação</p>
            <p className="text-2xl font-bold text-slate-900">{formatPercent(totais.percentualRecuperacao)}</p>
            <p className="mt-1 text-[11px] text-slate-400">Recorrente + Pontual (mês corrente)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Tempo médio de recuperação</p>
            <p className="text-2xl font-bold text-slate-900">
              {tempoMedioRecuperacaoDias != null ? `${tempoMedioRecuperacaoDias} dias` : '–'}
            </p>
          </div>
        </div>
      </section>

      {exibirTaxaRecuperacaoComite && (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Taxa de recuperação (Recorrente / Comitê)</h2>
        <p className="mb-1 text-sm text-slate-500">
          Pagamentos a partir de 05/02/2026 entram na porcentagem. O valor total em aberto no início é reconstruído (em aberto atual + total pago desde 05/02).
        </p>
        <p className="mb-3 text-xs font-medium text-slate-400">
          Data de corte do comitê: 05/02/2026.
        </p>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total recuperado desde 05/02</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(taxaRecuperacaoComite.totalRecuperadoDesdeComite)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Valor total em aberto (início comitê)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxaRecuperacaoComite.valorTotalEmAbertoInicioComite)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">% Recuperação comitê</p>
            <p className="text-2xl font-bold text-slate-900">{formatPercent(taxaRecuperacaoComite.percentualRecuperacaoComite)}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Total recuperado desde 05/02 por gestor</h3>
            {taxaRecuperacaoComite.recuperadoPorGestor.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum dado.</p>
            ) : (
              <ul className="space-y-2">
                {taxaRecuperacaoComite.recuperadoPorGestor.slice(0, 8).map((item: RankingItem, i: number) => {
                  const member = resolveTeamMember(item.nome, allTeamMembers)
                  return (
                    <li key={`comite-gestor-${i}-${item.nome}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
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
                      <span className="shrink-0 font-medium text-emerald-700">{formatCurrency(item.valor)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Total recuperado desde 05/02 por área</h3>
            {taxaRecuperacaoComite.recuperadoPorArea.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum dado.</p>
            ) : (
              <ul className="space-y-2">
                {taxaRecuperacaoComite.recuperadoPorArea.slice(0, 8).map((item: RankingItem, i: number) => (
                  <li key={`comite-area-${i}-${item.nome}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{i + 1}. {item.nome}</span>
                    <span className="font-medium text-emerald-700">{formatCurrency(item.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-semibold text-slate-800">Total por classe (em aberto)</h3>
          <p className="mb-3 text-xs text-slate-500">
            Recorrente (Comitê) e Inadimplência Pontual. Judicializada não usa classes A/B/C.
          </p>
          <div className="flex flex-col gap-2">
            <ClasseTotalRow
              label="Classe A"
              total={totais.totalClasseA}
              comite={totais.comiteClasseA}
              pontual={totais.pontualClasseA}
              tone="blue"
            />
            <ClasseTotalRow
              label="Classe B"
              total={totais.totalClasseB}
              comite={totais.comiteClasseB}
              pontual={totais.pontualClasseB}
              tone="amber"
            />
            <ClasseTotalRow
              label="Classe C"
              total={totais.totalClasseC}
              comite={totais.comiteClasseC}
              pontual={0}
              tone="red"
            />
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
                const member = resolveTeamMember(item.nome, allTeamMembers)
                return (
                  <li key={`gestor-${i}-${item.nome}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
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
              <li key={`area-${i}-${item.nome}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2">
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
          <h3 className="mb-3 font-semibold text-slate-800">Valor em aberto por gestor (Recorrente + Pontual)</h3>
          {valorEmAbertoPorGestor.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado.</p>
          ) : (
            <div className="space-y-2">
              {valorEmAbertoPorGestor.slice(0, 8).map((item: RankingItem, i: number) => {
                const member = resolveTeamMember(item.nome, allTeamMembers)
                const displayName = member ? `${member.full_name} (${member.area})` : item.nome
                return (
                  <div key={`aberto-gestor-${i}-${item.nome}`} className="flex items-center gap-2">
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
                            barDenominatorOperacional > 0
                              ? Math.max(4, (item.valor / barDenominatorOperacional) * 100)
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
          <h3 className="mb-3 font-semibold text-slate-800">Valor em aberto por área (Recorrente + Pontual)</h3>
          {valorEmAbertoPorArea.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado.</p>
          ) : (
            <div className="space-y-2">
              {valorEmAbertoPorArea.slice(0, 8).map((item: RankingItem, i: number) => (
                <div key={`aberto-area-${i}-${item.nome}`} className="flex items-center gap-2">
                  <span className="w-32 truncate text-sm font-medium text-slate-700">{item.nome}</span>
                  <div className="flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-6 rounded bg-slate-600"
                      style={{
                        width: `${
                          barDenominatorOperacional > 0
                            ? Math.max(4, (item.valor / barDenominatorOperacional) * 100)
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

function ClasseTotalRow({
  label,
  total,
  comite,
  pontual,
  tone,
}: {
  label: string
  total: number
  comite: number
  pontual: number
  tone: 'blue' | 'amber' | 'red'
}) {
  const tones = {
    blue: {
      box: 'bg-blue-50',
      title: 'text-blue-900',
      detail: 'text-blue-800/75',
    },
    amber: {
      box: 'bg-amber-50',
      title: 'text-amber-900',
      detail: 'text-amber-800/75',
    },
    red: {
      box: 'bg-red-50',
      title: 'text-red-900',
      detail: 'text-red-800/75',
    },
  }[tone]

  return (
    <div className={`rounded px-3 py-2 ${tones.box}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${tones.title}`}>{label}</span>
        <span className={`font-bold ${tones.title}`}>{formatCurrency(total)}</span>
      </div>
      {(comite > 0 || pontual > 0) && (
        <p className={`mt-0.5 text-[11px] ${tones.detail}`}>
          Recorrente {formatCurrency(comite)}
          {pontual > 0 ? ` · Pontual ${formatCurrency(pontual)}` : ''}
        </p>
      )}
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
        title={`Classe A: ${formatPercent(pctA)}`}
      />
      <div
        className="flex-1 rounded-t bg-amber-500 transition-all"
        style={{ height: `${Math.max(pctB, 2)}%` }}
        title={`Classe B: ${formatPercent(pctB)}`}
      />
      <div
        className="flex-1 rounded-t bg-red-500 transition-all"
        style={{ height: `${Math.max(pctC, 2)}%` }}
        title={`Classe C: ${formatPercent(pctC)}`}
      />
    </div>
  )
}
