import { useRef, useState } from 'react'
import { formatCurrency } from '@/shared/utils/format'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import { cn } from '@/lib/utils'
import { useSaldoDevedor } from '../hooks/useSaldoDevedor'
import { SaldoDevedorCopySlide } from './SaldoDevedorCopySlide'
import { SaldoDevedorTitulosSheet } from './SaldoDevedorTitulosSheet'
import {
  buildLeituraSaldoDevedor,
  formatSaldoDevedorInt,
  nomeExibicaoGrupo,
  periodoAbrevLabel,
  periodoPosicaoLabel,
  type ClienteSaldoDevedor,
  type EvolucaoSaldoDevedorData,
} from '../utils/saldoDevedor'

function splitColunas(clientes: ClienteSaldoDevedor[]): [ClienteSaldoDevedor[], ClienteSaldoDevedor[]] {
  const mid = Math.ceil(clientes.length / 2)
  return [clientes.slice(0, mid), clientes.slice(mid)]
}

function KpiCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string
  value: string
  hint: string
  accent: 'blue' | 'red' | 'green'
}) {
  const bar = {
    blue: 'bg-sky-600',
    red: 'bg-red-600',
    green: 'bg-emerald-600',
  }[accent]

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} />
      <p className="pl-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 pl-2 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 pl-2 text-[11px] leading-snug text-slate-400">{hint}</p>
    </div>
  )
}

function GeradoCell({ cliente }: { cliente: ClienteSaldoDevedor }) {
  const queda = cliente.saldoAnterior - cliente.acumulado
  if (queda > 0.5) {
    return (
      <span
        className="tabular-nums text-emerald-600"
        title="Saldo devedor menor que o fechamento anterior"
      >
        ▼ {formatSaldoDevedorInt(queda)}
      </span>
    )
  }
  if (cliente.geradoAno > 0.5) {
    return (
      <span className="tabular-nums text-red-600" title="Títulos do ano ainda em aberto">
        ▲ {formatSaldoDevedorInt(cliente.geradoAno)}
      </span>
    )
  }
  return <span className="tabular-nums text-slate-400">{formatSaldoDevedorInt(0)}</span>
}

function TabelaClientes({
  clientes,
  offset,
  ano,
  anoAnterior,
  onVerTitulos,
}: {
  clientes: ClienteSaldoDevedor[]
  offset: number
  ano: number
  anoAnterior: number
  onVerTitulos: (grupoNome: string) => void
}) {
  return (
    <table className="w-full text-left text-[12px]">
      <colgroup>
        <col className="w-[1%]" />
        <col className="w-[33%]" />
        <col className="w-[34%]" />
        <col className="w-[32%]" />
      </colgroup>
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-slate-500">
          <th className="whitespace-nowrap pb-2 pr-6 font-medium">Cliente</th>
          <th
            className="whitespace-nowrap pb-2 pl-6 text-right font-medium"
            title={`Posição de fechamento de ${anoAnterior}, sem baixa de pagamentos de ${ano}`}
          >
            Saldo {anoAnterior}
          </th>
          <th
            className="whitespace-nowrap pb-2 pl-6 text-right font-medium"
            title={`▲ dívida de ${ano} ainda em aberto. ▼ quanto o saldo caiu em relação a ${anoAnterior}.`}
          >
            Gerado {ano}
          </th>
          <th
            className="whitespace-nowrap pb-2 pl-6 text-right font-medium"
            title="Saldo em aberto agora. Desconto em título quitado não entra. Não é a soma das colunas anteriores."
          >
            Acumulado
          </th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((c, i) => {
          const rank = offset + i + 1
          const nome = nomeExibicaoGrupo(c.nome)
          const nomeLongo = nome.length > 28
          return (
            <tr key={c.grupoNorm} className="border-t border-slate-100">
              <td className="whitespace-nowrap py-1.5 pr-6 align-top">
                <span className="flex items-start gap-2">
                  <span className="mt-px w-5 shrink-0 text-right tabular-nums text-slate-400">
                    {rank}
                  </span>
                  <button
                    type="button"
                    onClick={() => onVerTitulos(c.nome)}
                    className={cn(
                      'text-left font-medium leading-snug text-slate-800 underline-offset-2 hover:text-sky-800 hover:underline',
                      nomeLongo && 'text-[11px]',
                    )}
                    title={`Ver títulos no saldo — ${c.nome}`}
                  >
                    {nome}
                  </button>
                </span>
              </td>
              <td className="whitespace-nowrap py-1.5 pl-6 text-right align-top tabular-nums text-slate-600">
                {formatSaldoDevedorInt(c.saldoAnterior)}
              </td>
              <td className="whitespace-nowrap py-1.5 pl-6 text-right align-top">
                <GeradoCell cliente={c} />
              </td>
              <td className="whitespace-nowrap py-1.5 pl-6 text-right align-top font-medium tabular-nums text-slate-900">
                {formatSaldoDevedorInt(c.acumulado)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Conteudo({ data }: { data: EvolucaoSaldoDevedorData }) {
  const exportRef = useRef<HTMLDivElement>(null)
  const [titulosGrupo, setTitulosGrupo] = useState<string | null>(null)
  const { totais, ano, anoAnterior, mesInicio, mesFim, clientes } = data
  const [colA, colB] = splitColunas(clientes)
  const leitura = buildLeituraSaldoDevedor(data)
  const abrev = periodoAbrevLabel(mesInicio, mesFim)
  const posicao = periodoPosicaoLabel(ano, mesInicio, mesFim)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-800">
            Evolução do saldo devedor por cliente
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Base de clientes ativos inadimplentes · do maior para o menor saldo acumulado · posição
            de {posicao}. Saldo {anoAnterior} é o fechamento daquele ano, mesmo se pago em {ano}.
            Acumulado é o saldo em aberto agora, não a soma das duas colunas. Desconto em
            título quitado não entra: o VIOS não gera outro título nesse caso.
          </p>
        </div>
        <ElementCopyButton
          containerRef={exportRef}
          label="Copiar"
          className="mt-0.5 shrink-0"
        />
      </header>

      <div
        ref={exportRef}
        aria-hidden
        data-chart-export-full-scroll
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 1280,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <SaldoDevedorCopySlide data={data} />
      </div>

      <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Saldo devedor acumulado"
          value={formatCurrency(totais.acumulado)}
          hint={`${totais.qtd} cliente${totais.qtd === 1 ? '' : 's'} · em aberto, sem desconto concedido`}
          accent="blue"
        />
        <KpiCard
          title={`Estoque de ${anoAnterior}`}
          value={formatCurrency(totais.saldoAnterior)}
          hint={`Fechamento de ${anoAnterior}`}
          accent="blue"
        />
        <KpiCard
          title={`Gerado em ${ano} (${abrev})`}
          value={formatCurrency(totais.geradoAno)}
          hint={`Em aberto com vencimento em ${ano}`}
          accent={totais.geradoAno >= 0 ? 'red' : 'green'}
        />
        <KpiCard
          title="Clientes que cresceram"
          value={`${totais.qtdCresceram} de ${totais.qtd}`}
          hint={`${formatCurrency(totais.dividaNova)} de dívida nova`}
          accent="red"
        />
        <KpiCard
          title="Clientes que reduziram"
          value={`${totais.qtdReduziram} de ${totais.qtd}`}
          hint={
            totais.amortizado > 0.5
              ? `${formatCurrency(totais.amortizado)} amortizados`
              : 'Sem dívida nova no ano'
          }
          accent="green"
        />
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum cliente inadimplente no período.</p>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid items-stretch lg:grid-cols-2 lg:divide-x lg:divide-slate-300">
              <div className="min-w-0 lg:pr-8">
                <TabelaClientes
                  clientes={colA}
                  offset={0}
                  ano={ano}
                  anoAnterior={anoAnterior}
                  onVerTitulos={setTitulosGrupo}
                />
              </div>
              {colB.length > 0 ? (
                <div className="mt-6 min-w-0 border-t border-slate-300 pt-6 lg:mt-0 lg:border-t-0 lg:pl-8 lg:pt-0">
                  <TabelaClientes
                    clientes={colB}
                    offset={colA.length}
                    ano={ano}
                    anoAnterior={anoAnterior}
                    onVerTitulos={setTitulosGrupo}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            <span className="font-semibold uppercase tracking-wide text-slate-800">
              Total da carteira · {totais.qtd} cliente{totais.qtd === 1 ? '' : 's'}
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
              <span>
                Saldo {anoAnterior}: {formatSaldoDevedorInt(totais.saldoAnterior)}
              </span>
              <span className={totais.geradoAno >= 0 ? 'text-red-600' : 'text-emerald-600'}>
                Gerado em {ano}: {totais.geradoAno >= 0 ? '▲' : '▼'}{' '}
                {formatSaldoDevedorInt(totais.geradoAno)}
              </span>
              <span className="font-semibold text-slate-900">
                Saldo acumulado: {formatSaldoDevedorInt(totais.acumulado)}
              </span>
            </div>
          </div>
        </>
      )}
      </div>

      <SaldoDevedorTitulosSheet
        open={titulosGrupo != null}
        onOpenChange={(o) => {
          if (!o) setTitulosGrupo(null)
        }}
        grupoNome={titulosGrupo}
        ano={ano}
        mesFim={mesFim}
      />

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Leitura</p>
        <ul className="space-y-1 text-[13px] leading-relaxed text-slate-700">
          {leitura.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function DashboardSaldoDevedorSection() {
  const { data, loading, error } = useSaldoDevedor()

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-6 w-80 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
      </section>
    )
  }

  if (error || !data) {
    return (
      <section>
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          Não foi possível carregar a evolução do saldo devedor.
        </p>
      </section>
    )
  }

  return (
    <section>
      <Conteudo data={data} />
    </section>
  )
}
