import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileX2, History, Search, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/format'
import {
  exclusaoTitulosService,
  type TituloExcluido,
  type TituloParaExcluir,
} from '../services/exclusaoTitulosService'
import { parseNumerosTitulos, tituloAtendeNumero } from '../utils/parseNumerosTitulos'

const HISTORICO_KEY = ['exclusao-titulos', 'historico']
const MOTIVO_MIN = 5

type Busca = {
  numeros: string[]
  cliente: string | null
  avisos: string[]
}

function situacaoBadge(situacao: string) {
  const aberto = situacao === 'ABERTO'
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        aberto
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
    >
      {aberto ? 'Em aberto' : situacao === 'PAGO' ? 'Pago' : situacao}
    </span>
  )
}

export function ExclusaoTitulosPage() {
  const queryClient = useQueryClient()
  const [textoNumeros, setTextoNumeros] = useState('')
  const [textoCliente, setTextoCliente] = useState('')
  const [busca, setBusca] = useState<Busca | null>(null)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [motivo, setMotivo] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [restaurar, setRestaurar] = useState<TituloExcluido | null>(null)

  const resultado = useQuery({
    queryKey: ['exclusao-titulos', 'busca', busca?.numeros, busca?.cliente],
    queryFn: () => exclusaoTitulosService.buscar(busca!.numeros, busca!.cliente),
    enabled: !!busca && (busca.numeros.length > 0 || !!busca.cliente),
    staleTime: 0,
  })

  const historico = useQuery({
    queryKey: HISTORICO_KEY,
    queryFn: () => exclusaoTitulosService.historico(),
  })

  const encontrados: TituloParaExcluir[] | undefined = resultado.data
  const titulos: TituloParaExcluir[] = encontrados ?? []
  const historicoLista: TituloExcluido[] = historico.data ?? []

  const naoEncontrados = useMemo(() => {
    if (!busca || !encontrados) return []
    return busca.numeros.filter(
      (n) => !encontrados.some((t) => tituloAtendeNumero(t.nro_titulo, n)),
    )
  }, [busca, encontrados])

  const selecionaveis = titulos.filter((t) => t.situacao === 'ABERTO')
  const titulosSelecionados = titulos.filter((t) => selecionados.has(t.ci_titulo))
  const totalSelecionado = titulosSelecionados.reduce((acc, t) => acc + t.valor, 0)
  const motivoOk = motivo.trim().length >= MOTIVO_MIN
  const todosMarcados =
    selecionaveis.length > 0 && selecionaveis.every((t) => selecionados.has(t.ci_titulo))

  const buscar = async () => {
    const { numeros, avisos } = parseNumerosTitulos(textoNumeros)
    const cliente = textoCliente.trim()
    if (numeros.length === 0 && cliente.length < 3) {
      toast.error('Informe o número do título (ou pelo menos 3 letras do cliente).')
      return
    }
    const novaBusca: Busca = { numeros, cliente: cliente.length >= 3 ? cliente : null, avisos }
    setBusca(novaBusca)
    setSelecionados(new Set())
    // Busca por número já vem marcada (é o que a pessoa pediu); por cliente, não.
    if (numeros.length > 0) {
      try {
        const data: TituloParaExcluir[] = await queryClient.fetchQuery({
          queryKey: ['exclusao-titulos', 'busca', novaBusca.numeros, novaBusca.cliente],
          queryFn: () => exclusaoTitulosService.buscar(novaBusca.numeros, novaBusca.cliente),
          staleTime: 0,
        })
        setSelecionados(
          new Set(
            data
              .filter(
                (t) =>
                  t.situacao === 'ABERTO' &&
                  numeros.some((n) => tituloAtendeNumero(t.nro_titulo, n)),
              )
              .map((t) => t.ci_titulo),
          ),
        )
      } catch {
        // o erro aparece pelo useQuery
      }
    }
  }

  const excluir = useMutation({
    mutationFn: () =>
      exclusaoTitulosService.excluir(
        titulosSelecionados.map((t) => t.ci_titulo),
        motivo.trim(),
      ),
    onSuccess: ({ excluidos }: { excluidos: number }) => {
      toast.success(
        excluidos === 1 ? '1 título excluído do SIOE.' : `${excluidos} títulos excluídos do SIOE.`,
      )
      setSelecionados(new Set())
      setMotivo('')
      queryClient.invalidateQueries({ queryKey: ['exclusao-titulos'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const desfazer = useMutation({
    mutationFn: (item: TituloExcluido) => exclusaoTitulosService.restaurar(item.id),
    onSuccess: (_d: void, item: TituloExcluido) => {
      toast.success(`Título ${item.nro_titulo ?? item.ci_titulo} restaurado no SIOE.`)
      queryClient.invalidateQueries({ queryKey: ['exclusao-titulos'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const alternar = (t: TituloParaExcluir) => {
    if (t.situacao !== 'ABERTO') return
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(t.ci_titulo)) next.delete(t.ci_titulo)
      else next.add(t.ci_titulo)
      return next
    })
  }

  const alternarTodos = () => {
    setSelecionados(todosMarcados ? new Set() : new Set(selecionaveis.map((t) => t.ci_titulo)))
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <FileX2 className="h-6 w-6 shrink-0 text-red-600" aria-hidden />
          Exclusão de Títulos
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Tire do SIOE os títulos que foram excluídos no VIOS (contrato rescindido, valor que não será
          mais cobrado etc.). Cada exclusão fica registrada com o motivo e pode ser desfeita. A
          atualização do VIOS não traz o título de volta.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-slate-500" aria-hidden />
            1. Buscar títulos
          </CardTitle>
          <CardDescription>
            Cole os números como estiver na mensagem. Aceita faixas (“13412 a 13419”), número com
            parcela (“11742-1”) e ignora datas e valores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="numeros-titulos">Números dos títulos</Label>
              <Textarea
                id="numeros-titulos"
                rows={3}
                value={textoNumeros}
                onChange={(e) => setTextoNumeros(e.target.value)}
                placeholder={'Ex.: 13412 a 13419\n11742-1 · venc. 18/10/2026 - Americar\n16256'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente-titulos">ou cliente (só títulos em aberto)</Label>
              <Input
                id="cliente-titulos"
                value={textoCliente}
                onChange={(e) => setTextoCliente(e.target.value)}
                placeholder="Ex.: Compasa"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void buscar()
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => void buscar()} disabled={resultado.isFetching}>
              <Search aria-hidden />
              {resultado.isFetching ? 'Buscando…' : 'Buscar'}
            </Button>
            {busca && busca.numeros.length > 0 && (
              <span className="text-xs text-slate-500">
                {busca.numeros.length === 1
                  ? '1 número lido'
                  : `${busca.numeros.length} números lidos`}
                : {busca.numeros.slice(0, 12).join(', ')}
                {busca.numeros.length > 12 ? '…' : ''}
              </span>
            )}
          </div>
          {busca?.avisos.map((a) => (
            <p key={a} className="text-xs text-amber-700">
              {a}
            </p>
          ))}
        </CardContent>
      </Card>

      {busca && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-slate-500" aria-hidden />
              2. Conferir e excluir
            </CardTitle>
            <CardDescription>
              Confira cliente, vencimento e valor. Títulos pagos não podem ser excluídos por aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultado.isError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(resultado.error as Error).message}
              </p>
            )}

            {naoEncontrados.length > 0 && (
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Não estão no SIOE (já excluídos ou número errado):{' '}
                  <strong>{naoEncontrados.join(', ')}</strong>
                </span>
              </p>
            )}

            {resultado.isFetching ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ) : titulos.length === 0 ? (
              !resultado.isError && (
                <p className="text-sm text-slate-500">Nenhum título encontrado.</p>
              )
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          checked={todosMarcados}
                          indeterminate={!todosMarcados && selecionados.size > 0}
                          onCheckedChange={alternarTodos}
                          disabled={selecionaveis.length === 0}
                          aria-label="Marcar todos"
                        />
                      </th>
                      <th className="px-3 py-2">Título</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Situação</th>
                      <th className="px-3 py-2">Plano de contas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {titulos.map((t) => {
                      const marcado = selecionados.has(t.ci_titulo)
                      const bloqueado = t.situacao !== 'ABERTO'
                      return (
                        <tr
                          key={t.ci_titulo}
                          onClick={() => alternar(t)}
                          className={cn(
                            bloqueado ? 'bg-slate-50/60 text-slate-400' : 'cursor-pointer hover:bg-slate-50',
                            marcado && 'bg-red-50/60 hover:bg-red-50',
                          )}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={marcado}
                              disabled={bloqueado}
                              onCheckedChange={() => alternar(t)}
                              aria-label={`Selecionar título ${t.nro_titulo}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                            {t.nro_titulo}
                          </td>
                          <td className="px-3 py-2">{t.cliente}</td>
                          <td className="px-3 py-2 text-xs">{t.tipo === 'PAGAR' ? 'A pagar' : 'A receber'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatDate(t.data_vencimento)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.valor)}</td>
                          <td className="px-3 py-2">{situacaoBadge(t.situacao)}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{t.plano_contas ?? '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {titulos.length > 0 && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm text-slate-700">
                  <strong>{titulosSelecionados.length}</strong>{' '}
                  {titulosSelecionados.length === 1 ? 'título selecionado' : 'títulos selecionados'} ·{' '}
                  <strong>{formatCurrency(totalSelecionado)}</strong>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="motivo-exclusao">Motivo (obrigatório)</Label>
                  <Textarea
                    id="motivo-exclusao"
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: Contrato rescindido; só o acordo segue em andamento. / Valor não será mais devido, negociado com o Gustavo."
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={titulosSelecionados.length === 0 || !motivoOk || excluir.isPending}
                  onClick={() => setConfirmarExclusao(true)}
                >
                  <Trash2 aria-hidden />
                  {excluir.isPending
                    ? 'Excluindo…'
                    : titulosSelecionados.length === 1
                      ? 'Excluir 1 título'
                      : `Excluir ${titulosSelecionados.length} títulos`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-slate-500" aria-hidden />
            Histórico de exclusões
          </CardTitle>
          <CardDescription>Últimas 300 exclusões. “Desfazer” devolve o título ao SIOE como estava.</CardDescription>
        </CardHeader>
        <CardContent>
          {historico.isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ) : historico.isError ? (
            <p className="text-sm text-red-700">{(historico.error as Error).message}</p>
          ) : historicoLista.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma exclusão feita por aqui ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Excluído em</th>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historicoLista.map((h) => (
                    <tr key={h.id} className={cn(h.restaurado_em && 'text-slate-400')}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {formatDateTime(h.excluido_em)}
                        <div className="text-xs text-slate-400">{h.excluido_por_nome ?? h.excluido_por_email}</div>
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">{h.nro_titulo ?? h.ci_titulo}</td>
                      <td className="px-3 py-2">{h.cliente ?? '–'}</td>
                      <td className="px-3 py-2 tabular-nums">{formatDate(h.data_vencimento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {h.valor == null ? '–' : formatCurrency(h.valor)}
                      </td>
                      <td className="max-w-xs px-3 py-2 text-xs">{h.motivo}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {h.restaurado_em ? (
                          <>
                            Restaurado em {formatDateTime(h.restaurado_em)}
                            <div className="text-slate-400">{h.restaurado_por_nome ?? h.restaurado_por_email}</div>
                          </>
                        ) : (
                          <span className="font-semibold text-red-600">Excluído</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!h.restaurado_em && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={desfazer.isPending}
                            onClick={() => setRestaurar(h)}
                          >
                            <Undo2 aria-hidden />
                            Desfazer
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ModalConfirmacao
        open={confirmarExclusao}
        onClose={() => setConfirmarExclusao(false)}
        variant="destructive"
        title={
          titulosSelecionados.length === 1
            ? 'Excluir 1 título do SIOE?'
            : `Excluir ${titulosSelecionados.length} títulos do SIOE?`
        }
        description={`${titulosSelecionados
          .slice(0, 10)
          .map((t) => t.nro_titulo)
          .join(', ')}${titulosSelecionados.length > 10 ? '…' : ''} · total ${formatCurrency(
          totalSelecionado,
        )}. Eles saem dos painéis (inadimplência, cobrança, receita). Dá para desfazer pelo histórico.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          await excluir.mutateAsync().catch(() => undefined)
        }}
      />

      <ModalConfirmacao
        open={!!restaurar}
        onClose={() => setRestaurar(null)}
        title={`Desfazer a exclusão do título ${restaurar?.nro_titulo ?? ''}?`}
        description="O título volta para o SIOE como estava antes da exclusão e a atualização do VIOS volta a mexer nele."
        confirmLabel="Desfazer exclusão"
        onConfirm={async () => {
          if (restaurar) await desfazer.mutateAsync(restaurar).catch(() => undefined)
        }}
      />
    </div>
  )
}
