import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cobrancaService } from '../services/cobrancaService'
import { useTelefonesWhatsapp } from '../hooks/useTelefonesWhatsapp'
import { formatPhoneMasked, parsePhoneForStorage } from '../utils/phoneMask'
import { PhoneInputCountry } from './PhoneInputCountry'

const NEW_OPTION = '__new__'

export interface TelefoneWhatsappPickerHandle {
  /** Retorna o telefone selecionado; persiste número novo se necessário. */
  resolve: () => Promise<{ telefone: string; nome: string } | null>
}

interface Props {
  pessoaId: string | null
  pessoaNome?: string | null
  fallbackTelefone?: string | null
  value: string
  onChange: (telefone: string, meta?: { nome?: string }) => void
  disabled?: boolean
}

export const TelefoneWhatsappPicker = forwardRef<TelefoneWhatsappPickerHandle, Props>(
  function TelefoneWhatsappPicker(
    { pessoaId, pessoaNome, fallbackTelefone, value, onChange, disabled },
    ref,
  ) {
    const { data: cadastrados = [], isLoading } = useTelefonesWhatsapp(pessoaId)
    const [mode, setMode] = useState<'select' | 'new'>('select')
    const [newNome, setNewNome] = useState('')
    const [newTelefone, setNewTelefone] = useState('')

    const opcoes = useMemo(() => {
      const list = [...cadastrados]
      if (
        fallbackTelefone?.trim() &&
        !list.some((t) => t.telefone === fallbackTelefone.trim())
      ) {
        list.unshift({
          id: 'fallback',
          pessoa_id: pessoaId ?? '',
          nome: pessoaNome?.trim() || 'Cadastro',
          telefone: fallbackTelefone.trim(),
          ordem: -1,
        })
      }
      return list
    }, [cadastrados, fallbackTelefone, pessoaId, pessoaNome])

    useEffect(() => {
      if (!pessoaId) return
      if (value) return
      if (opcoes.length > 0) {
        onChange(opcoes[0].telefone, { nome: opcoes[0].nome })
      }
    }, [pessoaId, opcoes, value, onChange])

    useImperativeHandle(ref, () => ({
      async resolve() {
        if (mode === 'new') {
          const tel = parsePhoneForStorage(newTelefone)
          if (!tel) return null
          const nome = newNome.trim() || pessoaNome?.trim() || 'WhatsApp'
          if (pessoaId) {
            const saved = await cobrancaService.addTelefoneWhatsapp(pessoaId, {
              nome,
              telefone: tel,
            })
            if (saved) return { telefone: saved.telefone, nome: saved.nome }
          }
          return { telefone: tel, nome }
        }
        const sel = opcoes.find((o) => o.telefone === value)
        if (!value) return null
        return { telefone: value, nome: sel?.nome ?? pessoaNome ?? 'Cliente' }
      },
    }))

    if (!pessoaId) {
      return (
        <Input
          readOnly
          value={formatPhoneMasked(fallbackTelefone) || fallbackTelefone || 'Sem telefone'}
          className="bg-slate-50 text-slate-500"
        />
      )
    }

    if (isLoading) {
      return <Input readOnly value="Carregando telefones…" className="bg-slate-50 text-slate-500" />
    }

    const selectValue = mode === 'new' ? NEW_OPTION : value || opcoes[0]?.telefone || ''

    return (
      <div className="space-y-2">
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === NEW_OPTION) {
              setMode('new')
              setNewNome('')
              setNewTelefone('')
              return
            }
            setMode('select')
            const opt = opcoes.find((o) => o.telefone === e.target.value)
            onChange(e.target.value, { nome: opt?.nome })
          }}
          className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {opcoes.length === 0 && (
            <option value="">Nenhum telefone cadastrado</option>
          )}
          {opcoes.map((t) => (
            <option key={`${t.id}-${t.telefone}`} value={t.telefone}>
              {t.nome} · {formatPhoneMasked(t.telefone) || t.telefone}
            </option>
          ))}
          <option value={NEW_OPTION}>➕ Adicionar novo número…</option>
        </select>

        {mode === 'new' && (
          <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do contato</Label>
              <Input
                value={newNome}
                disabled={disabled}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Ex.: Juliana (Financeiro)"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone (WhatsApp)</Label>
              <PhoneInputCountry
                value={newTelefone}
                disabled={disabled}
                onChange={setNewTelefone}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="gap-1"
              onClick={() => {
                const tel = parsePhoneForStorage(newTelefone)
                if (!tel) return
                onChange(tel, { nome: newNome.trim() || 'WhatsApp' })
                setMode('select')
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Usar este número
            </Button>
          </div>
        )}
      </div>
    )
  },
)
