import { Fragment, type ReactNode } from 'react'
import { Building2, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { PREVISTO_SEM_VENCIMENTO_KEY } from '../utils/previstoGrupos'
import type {
  ReceitaInadMesGrupoAgg,
  ReceitaInadMesGrupoComVencAgg,
  ReceitaInadMesVencimentoAgg,
} from '../utils/previstoGrupos'
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
  /** Exportação: exibe todos os vencimentos abertos com grupos visíveis */
  expandAllVencimentos?: boolean
}

type RecebidoProps = VencRowProps & {
  variant: 'recebido'
  vencimentos: ReceitaRecebidoVencimentoGrupoAgg[]
}

type InadProps = VencRowProps & {
  variant: 'inad'
  vencimentos: ReceitaInadMesVencimentoAgg[]
  grupos?: ReceitaInadMesGrupoComVencAgg[]
  agruparPor?: 'vencimento' | 'grupo'
}

type Props = RecebidoProps | InadProps

function DrillHeaderRow({
  icon,
  title,
  subtitle,
  expandido,
  onToggle,
  accent,
  children,
}: {
  icon: 'calendar' | 'building'
  title: string
  subtitle: string
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
          {icon === 'building' ? (
            <Building2 className={`mt-0.5 h-4 w-4 shrink-0 ${vencIcon}`} aria-hidden />
          ) : (
            <Calendar className={`mt-0.5 h-4 w-4 shrink-0 ${vencIcon}`} aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
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

function InadVencimentoChildRow({
  grupoKey,
  row,
}: {
  grupoKey: string
  row: ReceitaInadMesGrupoAgg
}) {
  return (
    <tr key={`${grupoKey}::${row.data_vencimento}`} className="border-t border-slate-100 bg-slate-50/60">
      <td className="px-3 py-2 align-top pl-10">
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{labelVencimentoDrill(row.data_vencimento)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {row.qtd_clientes_inad} {row.qtd_clientes_inad === 1 ? 'cliente inad.' : 'clientes inad.'}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-slate-600">
        {formatCurrency(row.faturado)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-slate-600">
        {formatCurrency(row.recebido)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-red-700">
        {formatCurrency(row.inadimplencia)}
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
  const expandAll = props.expandAllVencimentos ?? false
  const agruparPorGrupo =
    props.variant === 'inad' && props.agruparPor === 'grupo' && (props.grupos?.length ?? 0) > 0
  const vazio =
    props.variant === 'inad' && agruparPorGrupo
      ? (props.grupos?.length ?? 0) === 0
      : props.vencimentos.length === 0

  if (vazio) {
    return <p className="py-4 text-center text-xs text-slate-500">Nenhum item nesta linha.</p>
  }

  const colunaPrincipal =
    props.variant === 'inad' && agruparPorGrupo ? 'Grupo / Vencimento' : 'Vencimento / Grupo'

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white/80">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{colunaPrincipal}</th>
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
                const expandido = expandAll || props.vencExpandido === venc.vencimentoKey
                return (
                  <Fragment key={venc.vencimentoKey}>
                    <DrillHeaderRow
                      icon="calendar"
                      title={labelVencimentoDrill(venc.vencimentoKey)}
                      subtitle={`${venc.qtd_grupos} ${venc.qtd_grupos === 1 ? 'grupo' : 'grupos'}`}
                      expandido={expandido}
                      onToggle={() => props.onToggleVenc(venc.vencimentoKey)}
                      accent={accent}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-sky-900">
                        {formatCurrency(venc.total)}
                      </td>
                    </DrillHeaderRow>
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
            : agruparPorGrupo
              ? (props.grupos ?? []).map((grupo) => {
                  const expandido = expandAll || props.vencExpandido === grupo.grupo_cliente
                  return (
                    <Fragment key={grupo.grupo_cliente}>
                      <DrillHeaderRow
                        icon="building"
                        title={grupo.grupo_cliente}
                        subtitle={`${grupo.qtd_vencimentos} ${grupo.qtd_vencimentos === 1 ? 'vencimento' : 'vencimentos'}`}
                        expandido={expandido}
                        onToggle={() => props.onToggleVenc(grupo.grupo_cliente)}
                        accent={accent}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-slate-700">
                          {formatCurrency(grupo.faturado)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(grupo.recebido)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold tabular-nums text-red-700">
                          {formatCurrency(grupo.inadimplencia)}
                        </td>
                      </DrillHeaderRow>
                      {expandido &&
                        grupo.vencimentos.map((row) => (
                          <InadVencimentoChildRow
                            key={`${grupo.grupo_cliente}::${row.data_vencimento}`}
                            grupoKey={grupo.grupo_cliente}
                            row={row}
                          />
                        ))}
                    </Fragment>
                  )
                })
              : props.vencimentos.map((venc) => {
                  const expandido = expandAll || props.vencExpandido === venc.vencimentoKey
                  return (
                    <Fragment key={venc.vencimentoKey}>
                      <DrillHeaderRow
                        icon="calendar"
                        title={labelVencimentoDrill(venc.vencimentoKey)}
                        subtitle={`${venc.qtd_grupos} ${venc.qtd_grupos === 1 ? 'grupo' : 'grupos'}`}
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
                      </DrillHeaderRow>
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
