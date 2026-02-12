import { useState } from 'react'
import { FORMAS_PAGAMENTO } from '@/shared/constants/inadimplencia'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { registroPagamentoSchema } from '../types/inadimplencia.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

interface ModalRegistrarPagamentoProps {
  open: boolean
  onClose: () => void
  clientId: string
  onSuccess: () => void
}

export function ModalRegistrarPagamento({ open, onClose, clientId, onSuccess }: ModalRegistrarPagamentoProps) {
  const { registrarPagamento } = useInadimplenciaMutations()
  const [valorPago, setValorPago] = useState('')
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10))
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const parsed = registroPagamentoSchema.safeParse({
      valor_pago: valorPago === '' ? 0 : Number(valorPago),
      data_pagamento: dataPagamento,
      forma_pagamento: formaPagamento || undefined,
      observacao: observacao || undefined,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as string
        if (path && err.message) fieldErrors[path] = err.message
      })
      setErrors(fieldErrors)
      return
    }
    const { error } = await registrarPagamento.mutateAsync({
      clientId,
      form: parsed.data,
    })
    if (error) {
      toast.error('Erro ao registrar pagamento')
      return
    }
    toast.success('Pagamento registrado')
    setValorPago('')
    setDataPagamento(new Date().toISOString().slice(0, 10))
    setFormaPagamento('')
    setObservacao('')
    onClose()
    onSuccess()
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Registrar pagamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Valor pago *</Label>
          <Input
            type="number"
            step={0.01}
            min={0.01}
            value={valorPago}
            onChange={(e) => setValorPago(e.target.value)}
          />
          {errors.valor_pago && (
            <p className="text-xs text-red-600">{errors.valor_pago}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Data do pagamento *</Label>
          <Input
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
          />
          {errors.data_pagamento && (
            <p className="text-xs text-red-600">{errors.data_pagamento}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className={inputSelectClass}
          >
            <option value="">Selecione</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Observação</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={registrarPagamento.isPending}>
            {registrarPagamento.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
