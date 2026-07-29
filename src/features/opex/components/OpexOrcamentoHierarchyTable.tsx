import { Fragment } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/shared/utils/format'
import { MESES_CURTOS } from '../constants'
import type { OpexOrcamentoLinha } from '../types/opex.types'
import {
  departamentosDoFornecedor,
  descricaoLinhaLabel,
  fornecedoresDoPlanoMicro,
  linhasPorDescricao,
  orcamentoPathKey,
  partitionDescricoesOrcamento,
  planosMicroDoGrupo,
  type PlanoContasResumo,
} from '../utils/opexOrcamentoGrouping'
import { OpexOrcamentoMesChart } from './OpexOrcamentoMesChart'

type Props = {
  grupos: PlanoContasResumo[]
  mesFiltro: number | null
  onMesSelect: (mes: number | null) => void
  planosContasAbertos: Set<string>
  planosMicroAbertos: Set<string>
  fornecedoresAbertos: Set<string>
  departamentosAbertos: Set<string>
  descricoesAbertas: Set<string>
  onTogglePlanoContas: (key: string) => void
  onTogglePlanoMicro: (key: string) => void
  onToggleFornecedor: (key: string) => void
  onToggleDepartamento: (key: string) => void
  onToggleDescricao: (key: string) => void
  onEditarValor: (linha: OpexOrcamentoLinha, titulo: string) => void
  onEditarValorGrupo: (
    linhas: OpexOrcamentoLinha[],
    tituloBase: string,
    opts?: { editarDepartamento?: boolean },
  ) => void
  onEditarDescricao: (linhas: OpexOrcamentoLinha[], descricao: string, tituloBase: string) => void
  onExcluir: (id: string) => void
}

function ChevronToggle({ expanded }: { expanded: boolean }) {
  return expanded ? (
    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
  )
}

function OrcamentoMesLinhas({
  linhas,
  tituloBase,
  onEditarValor,
  onExcluir,
  ciLabel,
}: {
  linhas: OpexOrcamentoLinha[]
  tituloBase: string
  onEditarValor: (linha: OpexOrcamentoLinha, titulo: string) => void
  onExcluir: (id: string) => void
  ciLabel?: boolean
}) {
  return (
    <ul className="space-y-1 border-t border-slate-100 bg-slate-50/50 px-2 py-2">
      {linhas.map((l) => {
        const editTitulo = `${tituloBase} · ${MESES_CURTOS[l.mes - 1]}`
        return (
          <li
            key={l.id}
            className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md border border-slate-100 bg-white px-2.5 py-1.5 text-xs sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
          >
            <span className="font-medium uppercase text-slate-500">{MESES_CURTOS[l.mes - 1]}</span>
            <button
              type="button"
              onClick={() => onEditarValor(l, editTitulo)}
              className="min-w-0 text-left tabular-nums font-medium text-slate-800 transition-colors hover:text-violet-800"
              title="Editar valor"
            >
              {ciLabel ? (
                <span className="block truncate">
                  <span className="text-slate-500">{l.titulo_ref.trim() || descricaoLinhaLabel(l)} · </span>
                  {formatCurrency(l.valor)}
                </span>
              ) : (
                formatCurrency(l.valor)
              )}
            </button>
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Editar valor"
                onClick={() => onEditarValor(l, editTitulo)}
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700"
                onClick={() => onExcluir(l.id)}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function OpexOrcamentoHierarchyTable({
  grupos,
  mesFiltro,
  onMesSelect,
  planosContasAbertos,
  planosMicroAbertos,
  fornecedoresAbertos,
  departamentosAbertos,
  descricoesAbertas,
  onTogglePlanoContas,
  onTogglePlanoMicro,
  onToggleFornecedor,
  onToggleDepartamento,
  onToggleDescricao,
  onEditarValor,
  onEditarValorGrupo,
  onEditarDescricao,
  onExcluir,
}: Props) {
  return (
    <tbody>
      {grupos.map((g) => {
        const grupoExpandido = planosContasAbertos.has(g.grupoConta)
        const micros = planosMicroDoGrupo(g.linhas, mesFiltro)
        return (
          <Fragment key={g.grupoConta}>
            <tr className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/80">
              <td className="px-4 py-2.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => onTogglePlanoContas(g.grupoConta)}
                  aria-expanded={grupoExpandido}
                  className="flex w-full items-center gap-2 text-left font-medium text-slate-800 transition-colors hover:text-violet-800"
                >
                  {grupoExpandido ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <span className="min-w-0">{g.grupoConta}</span>
                </button>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500">
                {g.qtdMicro} micro · {g.linhas.length} linhas
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                {formatCurrency(g.total)}
              </td>
              <td className="px-4 py-2.5" />
            </tr>
            {grupoExpandido && (
              <tr>
                <td colSpan={4} className="border-b border-slate-100 bg-white p-0">
                  <div className="border-t border-slate-100/80 bg-slate-50/30 px-4 py-3 sm:px-5">
                    <OpexOrcamentoMesChart
                      linhas={g.linhas}
                      mesSelecionado={mesFiltro}
                      onMesSelect={onMesSelect}
                      compact
                      className="mb-3"
                    />
                    {!micros.length ? (
                      <p className="py-2 text-xs text-slate-500">Nenhum plano micro para o mês selecionado.</p>
                    ) : (
                      <ul className="space-y-2">
                        {micros.map((m) => {
                          const microKey = orcamentoPathKey(g.grupoConta, m.planoMicro)
                          const microExpandido = planosMicroAbertos.has(microKey)
                          const fornecedores = fornecedoresDoPlanoMicro(m.linhas, mesFiltro)
                          return (
                            <li
                              key={microKey}
                              className="overflow-hidden rounded-lg border border-slate-200/80 bg-white"
                            >
                              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-slate-100 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                                <button
                                  type="button"
                                  onClick={() => onTogglePlanoMicro(microKey)}
                                  aria-expanded={microExpandido}
                                  className="flex items-center gap-2 text-left text-sm font-medium text-slate-800 transition-colors hover:text-violet-800"
                                >
                                  <ChevronToggle expanded={microExpandido} />
                                  <span className="min-w-0">
                                    <span className="block">{m.planoMicro}</span>
                                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                                      Plano de contas micro · {m.qtdFornecedores} fornecedores
                                    </span>
                                  </span>
                                </button>
                                <span className="hidden text-[11px] text-slate-500 sm:inline">
                                  {m.linhas.length} linhas
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onEditarValorGrupo(
                                      m.linhas,
                                      `${g.grupoConta} · ${m.planoMicro}`,
                                    )
                                  }
                                  className="tabular-nums text-sm font-semibold text-slate-900 transition-colors hover:text-violet-800"
                                >
                                  {formatCurrency(m.total)}
                                </button>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Editar valor"
                                    onClick={() =>
                                      onEditarValorGrupo(
                                        m.linhas,
                                        `${g.grupoConta} · ${m.planoMicro}`,
                                      )
                                    }
                                  >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  </Button>
                                </div>
                              </div>
                              {microExpandido && (
                                <ul className="space-y-2 bg-slate-50/50 px-3 py-2">
                                  {fornecedores.map((f) => {
                                    const fornKey = orcamentoPathKey(g.grupoConta, m.planoMicro, f.fornecedor)
                                    const fornExpandido = fornecedoresAbertos.has(fornKey)
                                    const departamentos = departamentosDoFornecedor(f.linhas, mesFiltro)
                                    return (
                                      <li
                                        key={fornKey}
                                        className="overflow-hidden rounded-lg border border-slate-200/70 bg-white"
                                      >
                                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2">
                                          <button
                                            type="button"
                                            onClick={() => onToggleFornecedor(fornKey)}
                                            aria-expanded={fornExpandido}
                                            className="flex items-center gap-2 text-left text-sm font-medium text-slate-800 transition-colors hover:text-violet-800"
                                          >
                                            <ChevronToggle expanded={fornExpandido} />
                                            <span className="min-w-0">
                                              <span className="block">{f.fornecedor}</span>
                                              <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                                                Fornecedor · {f.qtdDepartamentos} departamentos
                                              </span>
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onEditarValorGrupo(
                                                f.linhas,
                                                `${g.grupoConta} · ${m.planoMicro} · ${f.fornecedor}`,
                                              )
                                            }
                                            className="tabular-nums text-sm font-semibold text-slate-900 transition-colors hover:text-violet-800"
                                          >
                                            {formatCurrency(f.total)}
                                          </button>
                                          <div className="flex justify-end gap-1">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              title="Editar valor"
                                              onClick={() =>
                                                onEditarValorGrupo(
                                                  f.linhas,
                                                  `${g.grupoConta} · ${m.planoMicro} · ${f.fornecedor}`,
                                                )
                                              }
                                            >
                                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                                            </Button>
                                          </div>
                                        </div>
                                        {fornExpandido && (
                                          <ul className="space-y-2 border-t border-slate-100 bg-slate-50/40 px-3 py-2">
                                            {departamentos.map((d) => {
                                              const deptKey = orcamentoPathKey(
                                                g.grupoConta,
                                                m.planoMicro,
                                                f.fornecedor,
                                                d.departamento,
                                              )
                                              const deptExpandido = departamentosAbertos.has(deptKey)
                                              const descricoes = linhasPorDescricao(d.linhas)
                                              const { descricoesNormais, linhasCiFlat } =
                                                partitionDescricoesOrcamento(descricoes)
                                              const tituloBaseDept = `${g.grupoConta} · ${m.planoMicro} · ${f.fornecedor} · ${d.departamento}`
                                              const editarDeptOpts = { editarDepartamento: true as const }
                                              const qtdCi = new Set(
                                                linhasCiFlat.map((l) => l.titulo_ref.trim() || descricaoLinhaLabel(l)),
                                              ).size
                                              const deptDetalhe =
                                                descricoesNormais.length > 0 && qtdCi > 0
                                                  ? `${descricoesNormais.length} descrições · ${qtdCi} CI`
                                                  : descricoesNormais.length > 0
                                                    ? `${descricoesNormais.length} descrições`
                                                    : qtdCi > 0
                                                      ? `${linhasCiFlat.length} lançamentos`
                                                      : 'Sem lançamentos'
                                              return (
                                                <li
                                                  key={deptKey}
                                                  className="overflow-hidden rounded-lg border border-slate-200/60 bg-white"
                                                >
                                                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => onToggleDepartamento(deptKey)}
                                                      aria-expanded={deptExpandido}
                                                      className="flex items-center gap-2 text-left text-sm font-medium text-slate-800 transition-colors hover:text-violet-800"
                                                    >
                                                      <ChevronToggle expanded={deptExpandido} />
                                                      <span className="min-w-0">
                                                        <span className="block">{d.departamento}</span>
                                                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                                                          Departamento · {deptDetalhe}
                                                        </span>
                                                      </span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        onEditarValorGrupo(
                                                          d.linhas,
                                                          tituloBaseDept,
                                                          editarDeptOpts,
                                                        )
                                                      }
                                                      className="tabular-nums text-sm font-semibold text-slate-900 transition-colors hover:text-violet-800"
                                                    >
                                                      {formatCurrency(d.total)}
                                                    </button>
                                                    <div className="flex justify-end gap-1">
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Editar departamento e valor"
                                                        onClick={() =>
                                                          onEditarValorGrupo(
                                                            d.linhas,
                                                            tituloBaseDept,
                                                            editarDeptOpts,
                                                          )
                                                        }
                                                      >
                                                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  {deptExpandido && (
                                                    <ul className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-2 py-2">
                                                      {linhasCiFlat.length > 0 && (
                                                        <OrcamentoMesLinhas
                                                          linhas={linhasCiFlat}
                                                          tituloBase={tituloBaseDept}
                                                          onEditarValor={onEditarValor}
                                                          onExcluir={onExcluir}
                                                          ciLabel={qtdCi > 1}
                                                        />
                                                      )}
                                                      {descricoesNormais.map((desc) => {
                                                        const linhaRef = desc.linhas[0]!
                                                        const descKey = orcamentoPathKey(
                                                          g.grupoConta,
                                                          m.planoMicro,
                                                          f.fornecedor,
                                                          d.departamento,
                                                          desc.descricao,
                                                          linhaRef.titulo_ref,
                                                        )
                                                        const descExpandida = descricoesAbertas.has(descKey)
                                                        const tituloBase = `${g.grupoConta} · ${m.planoMicro} · ${f.fornecedor} · ${d.departamento} · ${desc.descricao}`
                                                        return (
                                                          <li
                                                            key={descKey}
                                                            className="overflow-hidden rounded-lg border border-slate-200/80 bg-white"
                                                          >
                                                            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                                                              <button
                                                                type="button"
                                                                onClick={() => onToggleDescricao(descKey)}
                                                                aria-expanded={descExpandida}
                                                                className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-violet-800"
                                                              >
                                                                <ChevronToggle expanded={descExpandida} />
                                                                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                                                                  {desc.descricao}
                                                                </span>
                                                              </button>
                                                              <span className="hidden text-[11px] text-slate-500 sm:inline">
                                                                {desc.qtdMeses} meses
                                                              </span>
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  onEditarValorGrupo(
                                                                    desc.linhas,
                                                                    tituloBase,
                                                                  )
                                                                }
                                                                className="tabular-nums text-sm font-semibold text-slate-900 transition-colors hover:text-violet-800"
                                                              >
                                                                {formatCurrency(desc.total)}
                                                              </button>
                                                              <div className="flex justify-end gap-1">
                                                                <Button
                                                                  type="button"
                                                                  variant="ghost"
                                                                  size="icon"
                                                                  className="h-8 w-8"
                                                                  title="Editar descrição"
                                                                  onClick={() =>
                                                                    onEditarDescricao(
                                                                      desc.linhas,
                                                                      desc.descricao,
                                                                      tituloBase,
                                                                    )
                                                                  }
                                                                >
                                                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                                                </Button>
                                                              </div>
                                                            </div>
                                                            {descExpandida && (
                                                              <OrcamentoMesLinhas
                                                                linhas={desc.linhas}
                                                                tituloBase={tituloBase}
                                                                onEditarValor={onEditarValor}
                                                                onExcluir={onExcluir}
                                                              />
                                                            )}
                                                          </li>
                                                        )
                                                      })}
                                                    </ul>
                                                  )}
                                                </li>
                                              )
                                            })}
                                          </ul>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </tbody>
  )
}
