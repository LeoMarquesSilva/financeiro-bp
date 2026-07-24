import { useMemo, useState } from 'react'
import { Clock, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/shared/hooks/useDebounce'
import {
  useCobrancaSeguimentoDashboard,
  useCobrancaSeguimentoGruposAcima60,
} from '../hooks/useCobrancaSeguimento'
import { useInadimplenciaGruposIndex } from '@/features/escritorio/hooks/useInadimplenciaGruposIndex'
import {
  grupoChaveMatchesComite,
  grupoChaveNoComiteInadimplencia,
  type FiltroComite,
} from '@/features/escritorio/services/inadimplenciaGruposIndex'
import { CobrancaSeguimentoKPIs } from '../components/CobrancaSeguimentoKPIs'
import { CobrancaSeguimentoGruposTable } from '../components/CobrancaSeguimentoGruposTable'
import { CobrancaSeguimentoGrupoSheet } from '../components/CobrancaSeguimentoGrupoSheet'
import { CobrancaSeguimentoInadimplenciaAlert } from '../components/CobrancaSeguimentoInadimplenciaAlert'
import { CobrancaSeguimentoRevisaoComiteSheet } from '../components/CobrancaSeguimentoRevisaoComiteSheet'
import { calcularKpisFromGrupos } from '../utils/cobrancaSeguimentoKpis'
import type {
  CobrancaSeguimentoGrupo,
  CobrancaSeguimentoGrupoAcima60,
  FaixaAtrasoSeguimentoFiltro,
  StatusD1SeguimentoFiltro,
} from '../types/cobrancaSeguimento.types'

const SELECT_CLASS =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950'

export function CobrancaSeguimentoPage() {
  const { dashboard, loading, isFetching, refetch } = useCobrancaSeguimentoDashboard()
  const { data: acima60, loading: loadingAcima60, refetch: refetchAcima60 } =
    useCobrancaSeguimentoGruposAcima60()
  const { index: inadimplenciaIndex } = useInadimplenciaGruposIndex()
  const [buscaInput, setBuscaInput] = useState('')
  const busca = useDebounce(buscaInput, 300)
  const [faixa, setFaixa] = useState<FaixaAtrasoSeguimentoFiltro>('todos')
  const [statusD1, setStatusD1] = useState<StatusD1SeguimentoFiltro>('todos')
  const [filtroComite, setFiltroComite] = useState<FiltroComite>('fora_comite')
  const [grupoSelecionado, setGrupoSelecionado] = useState<CobrancaSeguimentoGrupo | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [revisaoComiteOpen, setRevisaoComiteOpen] = useState(false)

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return dashboard.grupos.filter((g: CobrancaSeguimentoGrupo) => {
      if (termo && !g.grupo_chave.toLowerCase().includes(termo)) return false
      if (faixa === '1-30' && g.max_dias_atraso > 30) return false
      if (faixa === '31-60' && g.max_dias_atraso <= 30) return false
      if (statusD1 === 'com_d1' && !g.cobranca_d1_realizada) return false
      if (statusD1 === 'sem_d1' && g.cobranca_d1_realizada) return false
      if (
        inadimplenciaIndex &&
        !grupoChaveMatchesComite(g.grupo_chave, inadimplenciaIndex, filtroComite)
      ) {
        return false
      }
      return true
    })
  }, [dashboard.grupos, busca, faixa, statusD1, filtroComite, inadimplenciaIndex])

  const kpisFiltrados = useMemo(
    () => calcularKpisFromGrupos(gruposFiltrados),
    [gruposFiltrados],
  )

  const gruposAcima60ForaComite = useMemo(() => {
    if (!inadimplenciaIndex) return []
    return acima60.grupos.filter(
      (g: CobrancaSeguimentoGrupoAcima60) =>
        !grupoChaveNoComiteInadimplencia(g.grupo_chave, inadimplenciaIndex),
    )
  }, [acima60.grupos, inadimplenciaIndex])

  const resumoAcima60ForaComite = useMemo(() => {
    let qtdTitulos = 0
    let valorTotal = 0
    for (const g of gruposAcima60ForaComite) {
      qtdTitulos += g.qtd_titulos
      valorTotal += g.valor_total
    }
    return { qtdTitulos, valorTotal }
  }, [gruposAcima60ForaComite])

  const handleOpenGrupo = (grupo: CobrancaSeguimentoGrupo) => {
    setGrupoSelecionado(grupo)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Clock className="h-6 w-6 text-slate-600" />
            Inadimplência Pontual
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Títulos vencidos de 1 a 60 dias após a cobrança D+1. Acima de 60 dias, incluir no Comitê
            de Inadimplência.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            void refetch()
            void refetchAcima60()
          }}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      <CobrancaSeguimentoInadimplenciaAlert
        grupos={gruposAcima60ForaComite}
        valorTotal={resumoAcima60ForaComite.valorTotal}
        qtdTitulos={resumoAcima60ForaComite.qtdTitulos}
        loading={loadingAcima60 || !inadimplenciaIndex}
        onRevisar={() => setRevisaoComiteOpen(true)}
      />

      <CobrancaSeguimentoRevisaoComiteSheet
        open={revisaoComiteOpen}
        onOpenChange={setRevisaoComiteOpen}
        grupos={gruposAcima60ForaComite}
        valorTotal={resumoAcima60ForaComite.valorTotal}
        qtdTitulos={resumoAcima60ForaComite.qtdTitulos}
        onIncluded={() => {
          void refetchAcima60()
        }}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Buscar grupo ou cliente..."
              className="pl-9"
            />
          </div>
          <select
            value={faixa}
            onChange={(e) => setFaixa(e.target.value as FaixaAtrasoSeguimentoFiltro)}
            className={SELECT_CLASS}
          >
            <option value="todos">Todas as faixas</option>
            <option value="1-30">1–30 dias</option>
            <option value="31-60">31–60 dias</option>
          </select>
          <select
            value={statusD1}
            onChange={(e) => setStatusD1(e.target.value as StatusD1SeguimentoFiltro)}
            className={SELECT_CLASS}
          >
            <option value="todos">D+1: todos</option>
            <option value="com_d1">Com cobrança D+1</option>
            <option value="sem_d1">Sem cobrança D+1</option>
          </select>
          <select
            value={filtroComite}
            onChange={(e) => setFiltroComite(e.target.value as FiltroComite)}
            className={SELECT_CLASS}
            disabled={!inadimplenciaIndex}
          >
            <option value="todos">Inadimplência: todos</option>
            <option value="comite">No Comitê</option>
            <option value="fora_comite">Fora do Comitê</option>
          </select>
        </div>

        <CobrancaSeguimentoKPIs kpis={kpisFiltrados} grupos={gruposFiltrados} loading={loading} />

        <CobrancaSeguimentoGruposTable
          grupos={gruposFiltrados}
          loading={loading}
          inadimplenciaIndex={inadimplenciaIndex}
          onOpenGrupo={handleOpenGrupo}
        />
      </div>

      <CobrancaSeguimentoGrupoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        grupo={grupoSelecionado}
      />
    </div>
  )
}
