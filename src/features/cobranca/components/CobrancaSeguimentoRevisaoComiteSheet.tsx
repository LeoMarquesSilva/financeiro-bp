import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/AuthContext'
import { ModalCadastro } from '@/features/inadimplencia/components/ModalCadastro'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { CobrancaSeguimentoGrupoAcima60 } from '../types/cobrancaSeguimento.types'
import { incluirGrupoNoComiteInadimplencia } from '../utils/cobrancaSeguimentoInadimplencia'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupos: CobrancaSeguimentoGrupoAcima60[]
  valorTotal: number
  qtdTitulos: number
  onIncluded?: () => void
}

export function CobrancaSeguimentoRevisaoComiteSheet({
  open,
  onOpenChange,
  grupos,
  valorTotal,
  qtdTitulos,
  onIncluded,
}: Props) {
  const { fullName } = useAuth()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [incluindo, setIncluindo] = useState<Set<string>>(new Set())
  const [cadastroOpen, setCadastroOpen] = useState(false)
  const [cadastroGrupo, setCadastroGrupo] = useState<CobrancaSeguimentoGrupoAcima60 | null>(null)

  const grupoKeys = useMemo(() => grupos.map((g) => g.grupo_chave), [grupos])
  const allSelected = grupoKeys.length > 0 && grupoKeys.every((k) => selected.has(k))
  const someSelected = grupoKeys.some((k) => selected.has(k))

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(grupoKeys) : new Set())
  }

  const toggleOne = (grupoChave: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(grupoChave)
      else next.delete(grupoChave)
      return next
    })
  }

  const invalidateAfterInclude = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cobranca', 'seguimento', 'grupos-acima-60'] }),
      queryClient.invalidateQueries({ queryKey: ['inadimplencia', 'grupos-index'] }),
      queryClient.invalidateQueries({ queryKey: ['inadimplencia'] }),
    ])
    onIncluded?.()
  }

  const incluirGrupo = async (grupo: CobrancaSeguimentoGrupoAcima60) => {
    setIncluindo((prev) => new Set(prev).add(grupo.grupo_chave))
    try {
      const result = await incluirGrupoNoComiteInadimplencia(grupo, { createdBy: fullName })
      if (!result.ok) {
        toast.error(`Erro ao incluir ${grupo.grupo_chave}: ${result.error}`)
        return
      }
      toast.success(`${grupo.grupo_chave} incluído no Comitê`)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(grupo.grupo_chave)
        return next
      })
      await invalidateAfterInclude()
    } finally {
      setIncluindo((prev) => {
        const next = new Set(prev)
        next.delete(grupo.grupo_chave)
        return next
      })
    }
  }

  const incluirSelecionados = async () => {
    const lista = grupos.filter((g) => selected.has(g.grupo_chave))
    if (lista.length === 0) return

    let ok = 0
    let fail = 0
    for (const grupo of lista) {
      setIncluindo((prev) => new Set(prev).add(grupo.grupo_chave))
      const result = await incluirGrupoNoComiteInadimplencia(grupo, { createdBy: fullName })
      setIncluindo((prev) => {
        const next = new Set(prev)
        next.delete(grupo.grupo_chave)
        return next
      })
      if (result.ok) ok++
      else fail++
    }

    if (ok > 0) {
      toast.success(`${ok} grupo${ok !== 1 ? 's' : ''} incluído${ok !== 1 ? 's' : ''} no Comitê`)
      setSelected(new Set())
      await invalidateAfterInclude()
    }
    if (fail > 0) {
      toast.error(`${fail} grupo${fail !== 1 ? 's' : ''} não pôde${fail !== 1 ? 'ram' : ''} ser incluído${fail !== 1 ? 's' : ''}`)
    }
  }

  const openCadastroCompleto = (grupo: CobrancaSeguimentoGrupoAcima60) => {
    setCadastroGrupo(grupo)
    setCadastroOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
          <SheetHeader className="border-b border-slate-200 px-6 py-4">
            <SheetTitle>Revisão — Comitê de Inadimplência</SheetTitle>
            <SheetDescription>
              {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} · {qtdTitulos} título
              {qtdTitulos !== 1 ? 's' : ''} · {formatCurrency(valorTotal)} em aberto (atraso &gt; 60
              dias)
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={(v) => toggleAll(v)}
              />
              Selecionar todos
            </label>
            <Button
              size="sm"
              className="ml-auto gap-1.5"
              disabled={selected.size === 0 || incluindo.size > 0}
              onClick={() => void incluirSelecionados()}
            >
              {incluindo.size > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Incluir selecionados ({selected.size})
            </Button>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {grupos.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhum grupo pendente de inclusão no Comitê.
              </p>
            ) : (
              <div className="space-y-4 pb-4">
                {grupos.map((grupo) => {
                  const loadingGrupo = incluindo.has(grupo.grupo_chave)
                  return (
                    <section
                      key={grupo.grupo_chave}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-4 py-3">
                        <Checkbox
                          checked={selected.has(grupo.grupo_chave)}
                          onCheckedChange={(v) => toggleOne(grupo.grupo_chave, v)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{grupo.grupo_chave}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {grupo.qtd_titulos} título{grupo.qtd_titulos !== 1 ? 's' : ''}
                            {grupo.qtd_razoes > 1 ? ` · ${grupo.qtd_razoes} razões sociais` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                            {grupo.max_dias_atraso} dias
                          </Badge>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(grupo.valor_total)}
                          </span>
                        </div>
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:ml-0">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingGrupo}
                            onClick={() => openCadastroCompleto(grupo)}
                          >
                            Cadastro completo
                          </Button>
                          <Button
                            size="sm"
                            disabled={loadingGrupo}
                            onClick={() => void incluirGrupo(grupo)}
                          >
                            {loadingGrupo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="mr-1.5 h-4 w-4" />
                                Incluir no Comitê
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-8 text-xs">Título</TableHead>
                              <TableHead className="h-8 text-xs">Cliente</TableHead>
                              <TableHead className="h-8 text-xs">Vencimento</TableHead>
                              <TableHead className="h-8 text-right text-xs">Dias</TableHead>
                              <TableHead className="h-8 text-right text-xs">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grupo.titulos.map((t) => (
                              <TableRow key={t.parcela_id} className="text-xs">
                                <TableCell className="py-2 font-medium text-slate-800">
                                  {t.nro_titulo ?? '—'}
                                  {t.parcela ? ` / ${t.parcela}` : ''}
                                </TableCell>
                                <TableCell className="max-w-[180px] truncate py-2 text-slate-600">
                                  {t.pessoa_nome ?? t.cliente ?? '—'}
                                </TableCell>
                                <TableCell className="py-2 text-slate-600">
                                  {formatDate(t.data_vencimento)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'py-2 text-right font-medium',
                                    t.dias_atraso > 90 ? 'text-red-700' : 'text-amber-700',
                                  )}
                                >
                                  {t.dias_atraso}
                                </TableCell>
                                <TableCell className="py-2 text-right font-medium text-slate-900">
                                  {formatCurrency(t.valor)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ModalCadastro
        open={cadastroOpen}
        onClose={() => {
          setCadastroOpen(false)
          setCadastroGrupo(null)
        }}
        onSuccess={() => {
          setCadastroOpen(false)
          setCadastroGrupo(null)
          void invalidateAfterInclude()
        }}
        initialGrupo={cadastroGrupo?.grupo_chave}
        initialValor={cadastroGrupo?.valor_total}
        initialPessoaId={cadastroGrupo?.pessoa_id_principal}
        initialClasse="C"
      />
    </>
  )
}
