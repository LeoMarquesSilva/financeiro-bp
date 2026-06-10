import { useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  WHATSAPP_COLOR_SCHEMES,
  slugFromCategoriaLabel,
  type WhatsappColorScheme,
} from '../constants/whatsappCategorias'
import type { CreateWhatsappCategoriaInput } from '../services/whatsappCategoriasService'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (input: CreateWhatsappCategoriaInput) => Promise<void>
  isCreating?: boolean
}

export function ModalNovaWhatsappCategoria({ open, onClose, onCreate, isCreating }: Props) {
  const [label, setLabel] = useState('')
  const [colorScheme, setColorScheme] = useState<WhatsappColorScheme>('slate')
  const [erro, setErro] = useState<string | null>(null)

  const slugPreview = label.trim() ? slugFromCategoriaLabel(label) : ''

  const reset = () => {
    setLabel('')
    setColorScheme('slate')
    setErro(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    try {
      await onCreate({ label: label.trim(), colorScheme })
      reset()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar categoria')
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={handleClose}
      title="Nova categoria"
      description="Crie um tipo de categoria para classificar conversas no painel WhatsApp."
      className="max-w-md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="categoria-nome">Nome</Label>
          <Input
            id="categoria-nome"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Fornecedor, Parceiro..."
            maxLength={60}
            autoFocus
          />
          {slugPreview && (
            <p className="text-[11px] text-slate-500">
              Identificador: <span className="font-mono">{slugPreview}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Cor</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WHATSAPP_COLOR_SCHEMES.map((scheme) => (
              <button
                key={scheme.id}
                type="button"
                onClick={() => setColorScheme(scheme.id)}
                className={cn(
                  'rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors',
                  colorScheme === scheme.id
                    ? scheme.chipActive
                    : cn(scheme.chipIdle, 'opacity-90 hover:opacity-100'),
                )}
              >
                {scheme.label}
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isCreating || label.trim().length < 2}>
            {isCreating ? 'Criando…' : 'Criar categoria'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
