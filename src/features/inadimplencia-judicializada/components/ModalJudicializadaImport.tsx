import { useRef, useState } from 'react'
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/lib/AuthContext'
import { parsePlanilhaAjuizadosFile } from '../utils/judicializadaImport'
import type { ImportPreviewRow } from '../types/judicializada.types'
import { judicializadaService } from '../services/judicializadaService'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function StatusBadge({ status }: { status: ImportPreviewRow['status'] }) {
  if (status === 'ok') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        OK
      </Badge>
    )
  }
  if (status === 'aviso') {
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Aviso
      </Badge>
    )
  }
  if (status === 'duplicado') {
    return (
      <Badge variant="secondary">
        Duplicado
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 h-3 w-3" />
      Erro
    </Badge>
  )
}

export function ModalJudicializadaImport({ open, onClose, onSuccess }: Props) {
  const { fullName, role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const inputRef = useRef<HTMLInputElement>(null)

  const [arquivoNome, setArquivoNome] = useState('')
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importing, setImporting] = useState(false)

  const reset = () => {
    setArquivoNome('')
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (file: File) => {
    if (!canEdit) {
      toast.error('Sem permissão para importar.')
      return
    }
    setLoadingPreview(true)
    setArquivoNome(file.name)
    try {
      const rows = await parsePlanilhaAjuizadosFile(file)
      if (rows.length === 0) {
        toast.error('Nenhuma linha com CNJ válido encontrada na aba de ajuizados.')
        setPreview(null)
        return
      }
      const built = await judicializadaService.buildImportPreview(rows)
      setPreview(built)
      const erros = built.filter((r) => r.status === 'erro').length
      const ok = built.filter((r) => r.status === 'ok' || r.status === 'aviso').length
      toast.success(`${built.length} linha(s) lida(s): ${ok} pronta(s), ${erros} com erro.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ler planilha.')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleImport = async () => {
    if (!preview?.length) return
    setImporting(true)
    try {
      const result = await judicializadaService.importPlanilhaAjuizados(
        preview.filter((r) => r.status !== 'duplicado'),
        { arquivoNome, createdBy: fullName ?? null },
      )
      toast.success(
        `Importação concluída: ${result.importados} importado(s), ${result.erros} erro(s), ${result.ignorados} ignorado(s).`,
      )
      if (result.importados > 0) {
        onSuccess()
        handleClose()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na importação.')
    } finally {
      setImporting(false)
    }
  }

  const prontos = preview?.filter((r) => r.status === 'ok' || r.status === 'aviso').length ?? 0

  return (
    <ModalBase
      open={open}
      onClose={handleClose}
      title="Importar planilha de ajuizados"
      description="Vincula cada CNJ da planilha ao processo correspondente na base VIOS."
      className="max-w-4xl"
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">
            Planilha <strong>Relatório Ações BP</strong> — aba <strong>AJUIZADOS REC. CRED.</strong>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            O CNJ deve existir em <code className="text-xs">processos_completo</code> (VIOS). Grupo
            resolvido pela parte passiva.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={!canEdit || loadingPreview}
            onClick={() => inputRef.current?.click()}
          >
            {loadingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Selecionar arquivo Excel
          </Button>
          {arquivoNome && (
            <p className="mt-2 text-xs text-slate-500">{arquivoNome}</p>
          )}
        </div>

        {preview && preview.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {preview.length} processo(s) · {prontos} pronto(s) para importar
              </p>
              <Button
                type="button"
                disabled={importing || prontos === 0}
                onClick={() => void handleImport()}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Importar {prontos} caso(s)
              </Button>
            </div>

            <ScrollArea className="h-[min(420px,50vh)] rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>CNJ</TableHead>
                    <TableHead>Parte passiva</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Valor causa</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow
                      key={`${row.linha}-${row.cnjNormalizado}`}
                      className={cn(row.status === 'erro' && 'bg-red-50/50')}
                    >
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.cnj}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {row.partePassiva ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm font-medium">
                        {row.grupoCliente ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.valorCausa != null ? formatCurrency(row.valorCausa) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-slate-600">
                        {row.erro ?? (row.processoViosCliente ? `VIOS: ${row.processoViosCliente}` : '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </div>
    </ModalBase>
  )
}
