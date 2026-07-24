import { useEffect, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { useCobrancaSeguimentoCreateAcao } from '../hooks/useCobrancaSeguimento'
import { COBRANCA_SEGUIMENTO_TIPOS_ACAO } from '../utils/cobrancaSeguimentoLabels'
import type { CobrancaSeguimentoAcaoTipo } from '../types/cobrancaSeguimento.types'

interface Props {
  open: boolean
  onClose: () => void
  grupoChave: string
  onSuccess?: () => void
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export function CobrancaSeguimentoNovaAcaoModal({ open, onClose, grupoChave, onSuccess }: Props) {
  const { fullName } = useAuth()
  const createAcao = useCobrancaSeguimentoCreateAcao()
  const [tipo, setTipo] = useState<CobrancaSeguimentoAcaoTipo>('ligacao')
  const [descricao, setDescricao] = useState('')
  const [dataAcao, setDataAcao] = useState(hojeISO())
  const [dataFollowUp, setDataFollowUp] = useState('')

  useEffect(() => {
    if (open) {
      setDataAcao(hojeISO())
      setDataFollowUp('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const texto = descricao.trim()
    if (!texto) {
      toast.error('Informe o que foi conversado')
      return
    }

    try {
      await createAcao.mutateAsync({
        grupo_chave: grupoChave,
        tipo,
        descricao: texto,
        data_acao: dataAcao,
        data_follow_up: dataFollowUp || null,
        created_by: fullName ?? null,
      })
      toast.success('Ação de seguimento registrada')
      setDescricao('')
      setDataFollowUp('')
      onClose()
      onSuccess?.()
    } catch {
      toast.error('Erro ao registrar ação')
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="Registrar ação de seguimento"
      description={`Nova ação de cobrança pós-D+1 para ${grupoChave}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tipo-acao">Tipo de ação</Label>
          <select
            id="tipo-acao"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CobrancaSeguimentoAcaoTipo)}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            {COBRANCA_SEGUIMENTO_TIPOS_ACAO.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="data-acao">Data da ação</Label>
          <Input
            id="data-acao"
            type="date"
            value={dataAcao}
            onChange={(e) => setDataAcao(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao-acao">O que foi conversado</Label>
          <Textarea
            id="descricao-acao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Resumo da conversa, compromissos assumidos, pendências..."
            className="min-h-[100px]"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="follow-up">Próximo follow-up (opcional)</Label>
          <Input
            id="follow-up"
            type="date"
            value={dataFollowUp}
            onChange={(e) => setDataFollowUp(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createAcao.isPending}>
            {createAcao.isPending ? 'Salvando…' : 'Registrar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
