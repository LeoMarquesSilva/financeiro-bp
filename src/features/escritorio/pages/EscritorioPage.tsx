import { useEffect, useMemo, useState } from 'react'
import { Building2, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LevantamentoFiltros } from '../components/LevantamentoFiltros'
import { LevantamentoKpiCards } from '../components/LevantamentoKpiCards'
import { LevantamentoRacionalSheet } from '../components/LevantamentoRacionalSheet'
import {
  useLevantamentoFiltrosOpcoes,
  useLevantamentoGruposPeriodo,
  useLevantamentoResumo,
} from '../hooks/useEscritorioLevantamento'
import {
  defaultMesCorrente,
  type LevantamentoBloco,
  type LevantamentoFiltros as Filtros,
  type LevantamentoSituacaoRow,
} from '../services/escritorioLevantamentoService'
import { mesContainingIso } from '../utils/levantamentoAreas'
import { LEVANTAMENTO_AREA_OPCOES } from '../utils/levantamentoAreaFiltro'
import { exportLevantamentoRelatorioCompleto } from '../utils/levantamentoExport'

export function EscritorioPage() {
  const mes = defaultMesCorrente()
  const [dataInicio, setDataInicio] = useState(mes.dataInicio)
  const [dataFim, setDataFim] = useState(mes.dataFim)
  const [periodoInicializado, setPeriodoInicializado] = useState(false)
  const [gruposSelecionados, setGruposSelecionados] = useState<string[]>([])
  const [area, setArea] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [racionalBloco, setRacionalBloco] = useState<LevantamentoBloco | null>(null)

  const filtros: Filtros = useMemo(
    () => ({ dataInicio, dataFim, grupos: gruposSelecionados, area }),
    [dataInicio, dataFim, gruposSelecionados, area],
  )

  const { data: opcoes } = useLevantamentoFiltrosOpcoes()
  const { data: grupos = [], isLoading: loadingGrupos } = useLevantamentoGruposPeriodo(
    dataInicio,
    dataFim,
  )
  const { data: resumo, isLoading, error, refetch, isFetching } = useLevantamentoResumo(filtros)

  useEffect(() => {
    if (periodoInicializado || !opcoes?.timesheetDataMax) return
    if (mes.dataInicio > opcoes.timesheetDataMax) {
      const periodo = mesContainingIso(opcoes.timesheetDataMax)
      setDataInicio(periodo.dataInicio)
      setDataFim(periodo.dataFim)
    }
    setPeriodoInicializado(true)
  }, [opcoes?.timesheetDataMax, periodoInicializado, mes.dataInicio])

  async function handleBaixarRelatorio() {
    if (!resumo || exportando) return
    setExportando(true)
    try {
      const { truncado } = await exportLevantamentoRelatorioCompleto(resumo, filtros)
      toast.success(
        truncado
          ? 'Relatório baixado (algumas abas truncadas em 5.000 linhas)'
          : 'Relatório baixado',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar relatório')
    } finally {
      setExportando(false)
    }
  }

  const timesheetAteLabel = opcoes?.timesheetDataMax
    ? opcoes.timesheetDataMax.split('-').reverse().join('/')
    : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Building2 className="h-6 w-6 text-slate-600" />
            Escritório
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Levantamento e visualização — publicações, timesheet, processos e tarefas
            {timesheetAteLabel ? ` · timesheet até ${timesheetAteLabel}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            disabled={isLoading || isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Atualizar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5"
            disabled={!resumo || exportando}
            onClick={() => void handleBaixarRelatorio()}
          >
            {exportando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Baixar relatório
          </Button>
        </div>
      </header>

      <LevantamentoFiltros
        dataInicio={dataInicio}
        dataFim={dataFim}
        gruposSelecionados={gruposSelecionados}
        area={area}
        grupos={grupos}
        gruposLoading={loadingGrupos}
        areas={[...LEVANTAMENTO_AREA_OPCOES]}
        onChange={(next) => {
          if (next.dataInicio !== undefined) setDataInicio(next.dataInicio)
          if (next.dataFim !== undefined) setDataFim(next.dataFim)
          if (next.gruposSelecionados !== undefined) setGruposSelecionados(next.gruposSelecionados)
          if (next.area !== undefined) setArea(next.area)
        }}
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error instanceof Error ? error.message : 'Erro ao carregar resumo'}
        </p>
      ) : null}

      <LevantamentoKpiCards
        resumo={resumo}
        loading={isLoading}
        onRacional={setRacionalBloco}
      />

      {resumo?.processos_por_situacao?.length ? (
        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Processos por situação</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {resumo.processos_por_situacao.map((s: LevantamentoSituacaoRow) => (
              <div
                key={s.situacao}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <p className="truncate text-xs text-slate-500">{s.situacao}</p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">
                  {s.qtd.toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <LevantamentoRacionalSheet
        bloco={racionalBloco}
        filtros={filtros}
        onClose={() => setRacionalBloco(null)}
      />
    </div>
  )
}
