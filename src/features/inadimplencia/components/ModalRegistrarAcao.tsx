import { useState } from 'react'
import { TIPOS_ACAO } from '@/shared/constants/inadimplencia'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { registroAcaoSchema } from '../types/inadimplencia.types'
import { toast } from 'sonner'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

interface ModalRegistrarAcaoProps {
  open: boolean
  onClose: () => void
  clientId: string
  onSuccess: () => void
}

export function ModalRegistrarAcao({ open, onClose, clientId, onSuccess }: ModalRegistrarAcaoProps) {
  const { registrarAcao } = useInadimplenciaMutations()
  const [tipo, setTipo] = useState<string>('outro')
  const [descricao, setDescricao] = useState('')
  const [dataAcao, setDataAcao] = useState(() => new Date().toISOString().slice(0, 16))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const parsed = registroAcaoSchema.safeParse({
      tipo,
      descricao: descricao || undefined,
      data_acao: new Date(dataAcao).toISOString(),
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
    const { error } = await registrarAcao.mutateAsync({
      clientId,
      form: parsed.data,
    })
    if (error) {
      toast.error('Erro ao registrar ação')
      return
    }
    toast.success('Ação registrada')
    setTipo('outro')
    setDescricao('')
    setDataAcao(new Date().toISOString().slice(0, 16))
    onClose()
    onSuccess()
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Registrar ação">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={inputSelectClass}
          >
            {TIPOS_ACAO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Data da ação *</Label>
          <Input
            type="datetime-local"
            value={dataAcao}
            onChange={(e) => setDataAcao(e.target.value)}
          />
          {errors.data_acao && (
            <p className="text-xs text-red-600">{errors.data_acao}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={registrarAcao.isPending}>
            {registrarAcao.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
