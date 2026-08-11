import { Fragment, type ReactNode } from 'react'
import { Building2, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { PREVISTO_SEM_VENCIMENTO_KEY } from '../utils/previstoGrupos'
import type { ReceitaInadMesGrupoAgg, ReceitaInadMesVencimentoAgg } from '../utils/previstoGrupos'
import type { ReceitaRecebidoVencimentoGrupoAgg } from '../utils/recebidoClassificacao'
import type { ReceitaRecebidoGrupoAgg } from '../utils/recebidoGrupos'

export function labelVencimentoDrill(vencimentoKey: string): string {
  return vencimentoKey === PREVISTO_SEM_VENCIMENTO_KEY
    ? 'Sem data de vencimento'
    : formatDate(vencimentoKey)
}

type VencRowProps = {
  vencExpandido: string | null
  onToggleVenc: (key: string) => void
  accent?: 'sky' | 'red'
}

type RecebidoProps = VencRowProps & {
  variant: 'recebido'
  vencimentos: ReceitaRecebidoVencimentoGrupoAgg[]
}

type InadProps = VencRowProps & {
  variant: 'inad'
  vencimentos: ReceitaInadMesVencimentoAgg[]
}

type Props = RecebidoProps | InadProps

function VencimentoHeaderRow({
  vencimentoKey,
  qtdGrupos,
  expandido,
  onToggle,
  accent,
  children,
}: {
  vencimentoKey: string
  qtdGrupos: number
  expandido: boolean
  onToggle: () => void
  accent: 'sky' | 'red'
  children: ReactNode
}) {
  const vencBg = accent === 'red' ? 'bg-red-50/40 hover:bg-red-50/70' : 'bg-sky-50/40 hover:bg-sky-50/70'
  const vencIcon = accent === 'red' ? 'text-red-700' : 'text-sky-700'

  return (
    <tr
      className={`cursor-pointer border-t border-slate-200 ${vencBg}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={expandido}
    >
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-2">
          {expandido ? (
            <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 ${vencIcon}`} aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
          <Calendar className={`mt-0.5 h-4 w-4 shrink-0 ${vencIcon}`} aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{labelVencimentoDrill(vencimentoKey)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {qtdGrupos} {qtdGrupos === 1 ? 'grupo' : 'grupos'}
            </p>
          </div>
        </div>
      </td>
      {children}
    </tr>
  )
}

function RecebidoGrupoRow({
  vencimentoKey,
  grupo,
}: {
  vencimentoKey: string
  grupo: ReceitaRecebidoGrupoAgg
}) {
  return (
    <tr key={`${vencimentoKey}::${grupo.grupo}`} className="border-t border-slate-100 bg-slate-50/60">
      <td className="px-3 py-2 align-top pl-10">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{grupo.grupo}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {grupo.quantidadeTitulos} {grupo.quantidadeTitulos === 1 ? 'título' : 'títulos'}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-sky-800">
        {formatCurrency(grupo.total)}
      </td>
    </tr>
  )
}

function InadGrupoRow({
  vencimentoKey,
  grupo,
}: {
  vencimentoKey: string
  grupo: ReceitaInadMesGrupoAgg
}) {
  return (
    <tr
      key={`${vencimentoKey}::${grupo.grupo_cliente}`}
      className="border-t border-slate-100 bg-slate-50/60"
    >
      <td className="px-3 py-2 align-top pl-10">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{grupo.grupo_cliente}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {grupo.qtd_clientes_inad}{' '}
              {grupo.qtd_clientes_inad === 1 ? 'cliente inad.' : 'clientes inad.'}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-slate-600">
        {formatCurrency(grupo.faturado)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-slate-600">
        {formatCurrency(grupo.recebido)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-red-700">
        {formatCurrency(grupo.inadimplencia)}
      </td>
    </tr>
  )
}

export function ReceitaVencimentoGrupoDrillTable(props: Props) {
  const accent = props.variant === 'recebido' ? (props.accent ?? 'sky') : 'red'

  if (props.vencimentos.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-500">Nenhum item nesta linha.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white/80">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Vencimento / Grupo</th>
            {props.variant === 'inad' ? (
              <>
                <th className="px-3 py-2 text-right">Faturado</th>
                <th className="px-3 py-2 text-right">Recebido</th>
                <th className="px-3 py-2 text-right">Inadimplência</th>
              </>
            ) : (
              <th className="px-3 py-2 text-right">Valor</th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.variant === 'recebido'
            ? props.vencimentos.map((venc) => {
                const expandido = props.vencExpandido === venc.vencimentoKey
                return (
                  <Fragment key={venc.vencimentoKey}>
                    <VencimentoHeaderRow
                      vencimentoKey={venc.vencimentoKey}
                      qtdGrupos={venc.qtd_grupos}
                      expandido={expandido}
                      onToggle={() => props.onToggleVenc(venc.vencimentoKey)}
                      accent={accent}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-sky-900">
                        {formatCurrency(venc.total)}
                      </td>
                    </VencimentoHeaderRow>
                    {expandido &&
                      venc.grupos.map((grupo) => (
                        <RecebidoGrupoRow
                          key={`${venc.vencimentoKey}::${grupo.grupo}`}
                          vencimentoKey={venc.vencimentoKey}
                          grupo={grupo}
                        />
                      ))}
                  </Fragment>
                )
              })
            : props.vencimentos.map((venc) => {
                const expandido = props.vencExpandido === venc.vencimentoKey
                return (
                  <Fragment key={venc.vencimentoKey}>
                    <VencimentoHeaderRow
                      vencimentoKey={venc.vencimentoKey}
                      qtdGrupos={venc.qtd_grupos}
                      expandido={expandido}
                      onToggle={() => props.onToggleVenc(venc.vencimentoKey)}
                      accent={accent}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-slate-700">
                        {formatCurrency(venc.faturado)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(venc.recebido)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-red-700">
                        {formatCurrency(venc.inadimplencia)}
                      </td>
                    </VencimentoHeaderRow>
                    {expandido &&
                      venc.grupos.map((grupo) => (
                        <InadGrupoRow
                          key={`${venc.vencimentoKey}::${grupo.grupo_cliente}`}
                          vencimentoKey={venc.vencimentoKey}
                          grupo={grupo}
                        />
                      ))}
                  </Fragment>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
