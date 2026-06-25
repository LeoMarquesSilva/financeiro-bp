import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/shared/utils/format'
import { opexService, valorReferenciaTitulos } from '../services/opexService'
import { OpexTituloVinculoPicker } from './OpexTituloVinculoPicker'
import {
  OPEX_INICIATIVA_STATUS_LABELS,
  OPEX_INICIATIVA_TIPOS,
} from '../constants/metasEstrategicas'
import type { OpexIniciativa, OpexIniciativaStatus, OpexIniciativaTipo, OpexTituloVinculado } from '../types/opexMetas.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  tipo: OpexIniciativaTipo
  iniciativa?: OpexIniciativa | null
  onSave: (iniciativa: OpexIniciativa) => Promise<void>
  isSaving?: boolean
}

const tipoConfig = (tipo: OpexIniciativaTipo) =>
  OPEX_INICIATIVA_TIPOS.find((t) => t.tipo === tipo)!

export function OpexIniciativaDialog({
  open,
  onOpenChange,
  ano,
  tipo,
  iniciativa,
  onSave,
  isSaving,
}: Props) {
  const cfg = tipoConfig(tipo)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [contexto, setContexto] = useState('')
  const [titulosVinculados, setTitulosVinculados] = useState<OpexTituloVinculado[]>([])
  const [valorAnual, setValorAnual] = useState('')
  const [valorAuto, setValorAuto] = useState(true)
  const [status, setStatus] = useState<OpexIniciativaStatus>('planejada')
  const [dataInicio, setDataInicio] = useState('')
  const [dataConclusao, setDataConclusao] = useState('')
  const [validadoEm, setValidadoEm] = useState('')
  const [validadoPor, setValidadoPor] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loadingTitulos, setLoadingTitulos] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(iniciativa?.titulo ?? '')
    setDescricao(iniciativa?.descricao ?? '')
    setContexto(iniciativa?.contexto ?? '')
    setValorAnual(iniciativa ? String(iniciativa.valor_anual) : '')
    setValorAuto(!iniciativa)
    setStatus(iniciativa?.status ?? 'planejada')
    setDataInicio(iniciativa?.data_inicio ?? '')
    setDataConclusao(iniciativa?.data_conclusao ?? '')
    setValidadoEm(iniciativa?.validado_em ?? '')
    setValidadoPor(iniciativa?.validado_por ?? '')
    setObservacoes(iniciativa?.observacoes ?? '')
    setErro(null)
    setTitulosVinculados([])

    const ciItens = iniciativa?.ci_itens ?? []
    if (ciItens.length > 0) {
      setLoadingTitulos(true)
      void opexService
        .fetchTitulosCiItens(ciItens)
        .then(setTitulosVinculados)
        .finally(() => setLoadingTitulos(false))
    }
  }, [open, iniciativa])

  const handleTitulosChange = (titulos: OpexTituloVinculado[]) => {
    setTitulosVinculados(titulos)
    if (titulos.length > 0) {
      if (!titulo.trim() || titulo === iniciativa?.titulo) {
        setTitulo(titulos[0].descricao)
      }
      if (!contexto.trim() || contexto === iniciativa?.contexto) {
        setContexto(
          cfg.tipo === 'substituicao_ferramenta'
            ? titulos[0].fornecedor !== '—'
              ? titulos[0].fornecedor
              : titulos[0].plano_contas
            : titulos[0].plano_contas,
        )
      }
    }
  }

  const handleValorSugerido = (valor: number) => {
    if (valorAuto) setValorAnual(String(valor))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (titulosVinculados.length === 0) {
      setErro('Vincule pelo menos um título PAGAR do VIOS que comprove a economia ou o custo evitado.')
      return
    }
    const valor = Number(valorAnual.replace(/\./g, '').replace(',', '.')) || Number(valorAnual) || 0
    if (valor <= 0) {
      setErro('Informe o valor anual de economia ou custo evitado.')
      return
    }
    setErro(null)
    await onSave({
      id: iniciativa?.id ?? crypto.randomUUID(),
      ano,
      tipo,
      titulo: titulo.trim() || titulosVinculados[0].descricao,
      descricao: descricao.trim() || undefined,
      contexto: contexto.trim(),
      ci_itens: titulosVinculados.map((t) => t.ci_item),
      valor_anual: valor,
      status,
      data_inicio: dataInicio || null,
      data_conclusao: dataConclusao || null,
      validado_em: status === 'validada' ? validadoEm || new Date().toISOString().slice(0, 10) : validadoEm || null,
      validado_por: validadoPor.trim() || null,
      observacoes: observacoes.trim() || null,
    })
    onOpenChange(false)
  }

  const refTitulos = valorReferenciaTitulos(titulosVinculados)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{iniciativa ? 'Editar iniciativa' : 'Nova iniciativa'}</DialogTitle>
            <DialogDescription>
              {cfg.titulo} · {ano} · vinculada a título(s) real(is) do VIOS
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {loadingTitulos ? (
              <p className="text-xs text-slate-500">Carregando títulos vinculados…</p>
            ) : (
              <OpexTituloVinculoPicker
                ano={ano}
                selected={titulosVinculados}
                onChange={handleTitulosChange}
                onValorSugerido={handleValorSugerido}
              />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="opex-ini-titulo">Nome da iniciativa</Label>
              <Input
                id="opex-ini-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Preenchido automaticamente pelo título vinculado"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opex-ini-contexto">{cfg.contextoLabel}</Label>
              <Input
                id="opex-ini-contexto"
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                placeholder="Ferramenta substituída ou necessidade suprida"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="opex-ini-valor">{cfg.valorLabel}</Label>
                {refTitulos > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-violet-700 hover:underline"
                    onClick={() => {
                      setValorAnual(String(refTitulos))
                      setValorAuto(true)
                    }}
                  >
                    Usar {formatCurrency(refTitulos)} dos títulos
                  </button>
                )}
              </div>
              <Input
                id="opex-ini-valor"
                type="number"
                min={0}
                step={0.01}
                value={valorAnual}
                onChange={(e) => {
                  setValorAnual(e.target.value)
                  setValorAuto(false)
                }}
                placeholder="5000"
                required
              />
              {refTitulos > 0 && (
                <p className="text-[11px] text-slate-500">
                  Referência dos títulos vinculados: {formatCurrency(refTitulos)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opex-ini-status">Status</Label>
              <select
                id="opex-ini-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as OpexIniciativaStatus)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
              >
                {Object.entries(OPEX_INICIATIVA_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="opex-ini-inicio">Início</Label>
                <Input
                  id="opex-ini-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opex-ini-conclusao">Conclusão</Label>
                <Input
                  id="opex-ini-conclusao"
                  type="date"
                  value={dataConclusao}
                  onChange={(e) => setDataConclusao(e.target.value)}
                />
              </div>
            </div>

            {status === 'validada' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="opex-ini-validado-em">Validado em</Label>
                  <Input
                    id="opex-ini-validado-em"
                    type="date"
                    value={validadoEm}
                    onChange={(e) => setValidadoEm(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="opex-ini-validado-por">Validado por</Label>
                  <Input
                    id="opex-ini-validado-por"
                    value={validadoPor}
                    onChange={(e) => setValidadoPor(e.target.value)}
                    placeholder="Responsável pela validação"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="opex-ini-desc">Como a economia foi calculada</Label>
              <Textarea
                id="opex-ini-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Ex.: cancelamento da licença X; custo anterior vs. solução interna"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opex-ini-obs">Observações</Label>
              <Textarea
                id="opex-ini-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>

            {erro && <p className="text-xs text-red-600">{erro}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || loadingTitulos}>
              {isSaving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
