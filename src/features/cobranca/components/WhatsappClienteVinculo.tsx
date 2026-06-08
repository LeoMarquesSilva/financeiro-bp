import { useEffect, useMemo, useState } from 'react'
import { Check, Link2, Loader2, Plus, Search, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { cobrancaService } from '../services/cobrancaService'
import { whatsappService } from '../services/whatsappService'
import { formatPhoneMasked } from '../utils/phoneMask'
import { formatCnpj } from '@/shared/utils/format'
import type { PessoaTelefoneMatch, WhatsappChatPessoa } from '../types/cobranca.types'

type PessoaOption = {
  id: string
  nome: string
  grupo_cliente: string | null
  telefone: string | null
  cpf_cnpj: string | null
}

interface Props {
  remoteJid: string
  vinculados: WhatsappChatPessoa[]
  vinculadosLoading?: boolean
  candidatos?: PessoaTelefoneMatch[]
  candidatosLoading?: boolean
  onChange: () => void
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function ClienteCard({
  nome,
  grupo,
  contatoNome,
  linked,
  disabled,
  onAction,
  actionLabel,
}: {
  nome: string
  grupo?: string | null
  contatoNome?: string | null
  linked?: boolean
  disabled?: boolean
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors',
        linked
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
          linked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
        )}
      >
        {iniciais(nome)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight text-slate-900">{nome}</p>
        {grupo && <p className="mt-0.5 truncate text-[11px] text-slate-500">{grupo}</p>}
        {contatoNome && contatoNome !== nome && (
          <p className="mt-0.5 truncate text-[10px] text-slate-400">Contato: {contatoNome}</p>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAction}
          title={actionLabel}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40',
            linked
              ? 'text-emerald-600 hover:bg-emerald-100'
              : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600',
          )}
        >
          {linked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

export function WhatsappClienteVinculo({
  remoteJid,
  vinculados,
  vinculadosLoading = false,
  candidatos = [],
  candidatosLoading = false,
  onChange,
}: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PessoaOption[]>([])
  const [buscando, setBuscando] = useState(false)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  const vinculadosIds = useMemo(
    () => new Set(vinculados.map((v) => v.pessoa_id)),
    [vinculados],
  )

  const candidatosPendentes = useMemo(
    () => candidatos.filter((c) => !vinculadosIds.has(c.pessoa_id)),
    [candidatos, vinculadosIds],
  )

  useEffect(() => {
    const term = busca.trim()
    if (term.length < 2) {
      setResultados([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const rows = await cobrancaService.searchPessoas(term)
        if (!cancelled) setResultados(rows)
      } finally {
        if (!cancelled) setBuscando(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [busca])

  const vincular = async (id: string) => {
    if (vinculadosIds.has(id)) return
    setSalvandoId(id)
    try {
      await whatsappService.addChatPessoa(remoteJid, id)
      onChange()
      setBusca('')
      setResultados([])
      toast.success('Cliente vinculado à conversa')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular cliente')
    } finally {
      setSalvandoId(null)
    }
  }

  const desvincular = async (id: string) => {
    setSalvandoId(id)
    try {
      await whatsappService.removeChatPessoa(remoteJid, id)
      onChange()
      toast.success('Vínculo removido')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desvincular')
    } finally {
      setSalvandoId(null)
    }
  }

  const loading = vinculadosLoading || candidatosLoading

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Link2 className="h-3.5 w-3.5" />
          Clientes vinculados
        </h4>
        {vinculados.length > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {vinculados.length}
          </Badge>
        )}
      </div>

      {loading && vinculados.length === 0 && candidatos.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando vínculos…
        </p>
      ) : vinculados.length > 0 ? (
        <ul className="space-y-1.5">
          {vinculados.map((v) => (
            <li key={v.pessoa_id}>
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <ClienteCard nome={v.nome} grupo={v.grupo_cliente} linked />
                </div>
                <button
                  type="button"
                  disabled={!!salvandoId}
                  onClick={() => desvincular(v.pessoa_id)}
                  title="Remover vínculo"
                  className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  {salvandoId === v.pessoa_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            Nenhum vínculo confirmado ainda.
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Os títulos abaixo podem já aparecer pelo telefone. Clique em{' '}
            <Plus className="inline h-3 w-3" aria-hidden /> para confirmar o cliente nesta conversa.
          </p>
        </div>
      )}

      {candidatosPendentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            Identificados pelo telefone
          </p>
          <ul className="space-y-1.5">
            {candidatosPendentes.map((c) => (
              <li key={c.pessoa_id}>
                <ClienteCard
                  nome={c.nome}
                  grupo={c.grupo_cliente}
                  contatoNome={c.contato_nome}
                  disabled={!!salvandoId}
                  onAction={() => vincular(c.pessoa_id)}
                  actionLabel="Vincular cliente"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-medium text-slate-500">Adicionar outro cliente</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou grupo…"
            className="h-9 pl-8 text-sm"
            disabled={!!salvandoId}
          />
        </div>

        {buscando && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Buscando…
          </p>
        )}

        {!buscando && resultados.length > 0 && (
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
            {resultados.map((p) => {
              const jaVinculado = vinculadosIds.has(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!!salvandoId || jaVinculado}
                    onClick={() => vincular(p.id)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors disabled:opacity-50',
                      jaVinculado ? 'bg-emerald-50/50' : 'hover:bg-emerald-50',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                      {iniciais(p.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{p.nome}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {[p.grupo_cliente, p.telefone ? formatPhoneMasked(p.telefone) : null, p.cpf_cnpj ? formatCnpj(p.cpf_cnpj) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {jaVinculado ? (
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : salvandoId === p.id ? (
                      <Loader2 className="mt-1 h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                    ) : (
                      <Plus className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
