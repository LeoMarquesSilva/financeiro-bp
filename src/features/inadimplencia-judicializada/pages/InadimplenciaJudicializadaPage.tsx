import { useMemo, useState } from 'react'
import { Scale, Plus, RefreshCw, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/shared/utils/format'
import { useAuth } from '@/lib/AuthContext'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { judicializadaService } from '../services/judicializadaService'
import { normalizarNomeGrupo } from '@/features/escritorio/services/escritorioService'
import { useJudicializadaList } from '../hooks/useJudicializada'
import { JudicializadaGruposTable } from '../components/JudicializadaGruposTable'
import { ModalJudicializadaCadastro } from '../components/ModalJudicializadaCadastro'
import { ModalJudicializadaImport } from '../components/ModalJudicializadaImport'
import { JudicializadaDetailSheet } from '../components/JudicializadaDetailSheet'
import type { InadimplenciaJudicializadaRow } from '../types/judicializada.types'

export function InadimplenciaJudicializadaPage() {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'

  const [incluirEncerrados, setIncluirEncerrados] = useState(false)
  const [buscaInput, setBuscaInput] = useState('')
  const busca = useDebounce(buscaInput, 300)
  const [cadastroOpen, setCadastroOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<InadimplenciaJudicializadaRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [focusAndamentos, setFocusAndamentos] = useState(false)

  const { data: rows = [], isLoading, isFetching, refetch } = useJudicializadaList(incluirEncerrados)

  const filtradas = useMemo(() => {
    const termo = busca.trim()
    if (!termo) return rows
    const buscaNorm = normalizarNomeGrupo(termo)
    return rows.filter((r: InadimplenciaJudicializadaRow) => {
      const haystack = [
        r.grupo_cliente,
        r.nro_cnj,
        r.acao,
        r.area,
        r.situacao_processo,
        r.advogado_responsavel,
      ]
        .filter(Boolean)
        .join(' ')
      const haystackNorm = normalizarNomeGrupo(haystack)
      return (
        haystackNorm.includes(buscaNorm) ||
        buscaNorm.includes(haystackNorm) ||
        haystack.toLowerCase().includes(termo.toLowerCase())
      )
    })
  }, [rows, busca])

  const abrirCadastro = () => setCadastroOpen(true)

  const kpis = useMemo(() => judicializadaService.calcularKpis(rows), [rows])

  const handleOpenRow = (row: InadimplenciaJudicializadaRow) => {
    setSelectedRow(row)
    setFocusAndamentos(false)
    setSheetOpen(true)
  }

  const handleOpenAndamentos = (row: InadimplenciaJudicializadaRow) => {
    setSelectedRow(row)
    setFocusAndamentos(true)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) setFocusAndamentos(false)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Scale className="h-6 w-6 text-slate-600" />
            Inadimplência Judicializada
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Casos antigos judicializados — grupo vinculado ao processo VIOS
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {canEdit && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar planilha
              </Button>
              <Button type="button" size="sm" onClick={abrirCadastro}>
                <Plus className="mr-2 h-4 w-4" />
                Incluir caso
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Valor corrigido (ativos)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(kpis.totalEmAberto)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">INPC + juros TJSP (1% a.m.)</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Valor de ajuizamento</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(kpis.totalValorCausa)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Soma valor da causa na planilha</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Lançamento VIOS (grupo)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(kpis.totalLancamentoVios)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Saldo financeiro vinculado ao grupo</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Processos / grupos</p>
          <p className="text-2xl font-bold text-slate-900">{kpis.qtdProcessos}</p>
          <p className="mt-0.5 text-xs text-slate-400">{kpis.qtdGrupos} grupo(s) distintos</p>
        </div>
      </section>

      {kpis.porArea.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-slate-500">Por área (top 3)</p>
          <ul className="space-y-1 text-sm">
            {kpis.porArea.slice(0, 3).map((item) => (
              <li key={item.area} className="flex justify-between gap-2">
                <span className="truncate text-slate-700">{item.area}</span>
                <span className="shrink-0 font-medium">{formatCurrency(item.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar casos cadastrados (grupo, CNJ, ação)…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="encerrados"
            checked={incluirEncerrados}
            onCheckedChange={(v) => setIncluirEncerrados(v === true)}
          />
          <Label htmlFor="encerrados" className="text-sm text-slate-600">
            Mostrar encerrados
          </Label>
        </div>
      </section>

      <JudicializadaGruposTable
        rows={filtradas}
        loading={isLoading}
        onOpenRow={handleOpenRow}
        onOpenAndamentos={handleOpenAndamentos}
        buscaAtiva={busca.trim()}
        onIncluirCaso={canEdit ? abrirCadastro : undefined}
      />

      <ModalJudicializadaImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => refetch()}
      />

      <ModalJudicializadaCadastro
        open={cadastroOpen}
        onClose={() => setCadastroOpen(false)}
        onSuccess={() => refetch()}
        initialGrupoSearch={buscaInput.trim()}
      />

      <JudicializadaDetailSheet
        row={selectedRow}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onUpdated={() => refetch()}
        focusAndamentos={focusAndamentos}
      />
    </div>
  )
}
