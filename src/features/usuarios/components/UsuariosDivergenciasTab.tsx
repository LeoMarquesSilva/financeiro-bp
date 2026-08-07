import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { colaboradoresService } from '@/features/colaboradores/services/colaboradoresService'
import type { ColaboradorDivergencia, ColaboradorDivergenciaTipo } from '@/features/colaboradores/types'

const DIVERGENCIA_LABEL: Record<ColaboradorDivergenciaTipo, string> = {
  sem_conta_responsum: 'Sem conta RESPONSUM',
  sem_registro_orqestrai: 'Sem registro ORQESTRAI',
  area_diferente: 'Área diferente',
  status_diferente: 'Status diferente',
}

const DIVERGENCIA_BADGE_CLASS: Record<ColaboradorDivergenciaTipo, string> = {
  sem_conta_responsum: 'border-amber-200 bg-amber-50 text-amber-700',
  sem_registro_orqestrai: 'border-sky-200 bg-sky-50 text-sky-700',
  area_diferente: 'border-violet-200 bg-violet-50 text-violet-700',
  status_diferente: 'border-red-200 bg-red-50 text-red-700',
}

export function UsuariosDivergenciasTab({
  divergencias,
  isLoading,
  isError,
}: {
  divergencias: ColaboradorDivergencia[]
  isLoading: boolean
  isError: boolean
}) {
  const queryClient = useQueryClient()
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false)

  const pendentes = useMemo(() => divergencias.filter((d) => !d.resolvido), [divergencias])
  const visiveis = mostrarResolvidas ? divergencias : pendentes

  const resolverMutation = useMutation({
    mutationFn: ({ id, resolvido }: { id: string; resolvido: boolean }) =>
      colaboradoresService.resolverDivergencia(id, resolvido),
    onSuccess: (_data: void, { resolvido }: { id: string; resolvido: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores_divergencias'] })
      toast.success(resolvido ? 'Divergência marcada como resolvida' : 'Divergência reaberta')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao atualizar divergência')
    },
  })

  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Divergências ORQESTRAI × RESPONSUM ({visiveis.length})
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMostrarResolvidas((v) => !v)}
          >
            {mostrarResolvidas ? 'Ver só pendentes' : 'Ver também resolvidas'}
          </Button>
        </div>
        <p className="text-sm font-normal text-slate-500">
          Gerado a cada <code className="rounded bg-slate-100 px-1">npm run sync:colaboradores</code>.
          Marcar como resolvida só esconde o alerta aqui — não altera ORQESTRAI nem RESPONSUM.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
            Erro ao carregar divergências.
          </div>
        ) : visiveis.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="mt-2 text-sm text-slate-500">Nenhuma divergência pendente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Detalhe</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map((d) => (
                  <tr key={d.id} className={cn(d.resolvido && 'bg-slate-50/60 opacity-70')}>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={DIVERGENCIA_BADGE_CLASS[d.tipo]}>
                        {DIVERGENCIA_LABEL[d.tipo]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{d.detalhe ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={resolverMutation.isPending}
                        onClick={() =>
                          resolverMutation.mutate({ id: d.id, resolvido: !d.resolvido })
                        }
                      >
                        {d.resolvido ? (
                          'Reabrir'
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span className="ml-1">Resolver</span>
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
