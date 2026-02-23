import { useState } from 'react'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import type { GrupoEscritorio } from '../services/escritorioService'
import { GrupoEscritorioCard } from '../components/GrupoEscritorioCard'
import { ClienteEscritorioDetailSheet } from '../components/ClienteEscritorioDetailSheet'
import { useGruposEscritorio } from '../hooks/useGruposEscritorio'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Building2, Loader2, RefreshCw } from 'lucide-react'

function matchBusca(grupo: GrupoEscritorio, busca: string): boolean {
  const b = busca.toLowerCase().trim()
  if (!b) return true
  if (grupo.grupo_cliente.toLowerCase().includes(b)) return true
  return grupo.empresas.some((e) => e.razao_social.toLowerCase().includes(b))
}

export function EscritorioPage() {
  const [busca, setBusca] = useState('')
  const [selectedCliente, setSelectedCliente] = useState<ClienteEscritorioRow | null>(null)
  const { grupos, loading, fetching, error, refetch } = useGruposEscritorio()

  const filtrado = busca.trim() ? grupos.filter((g: GrupoEscritorio) => matchBusca(g, busca)) : grupos

  return (
    <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Building2 className="h-7 w-7 shrink-0 text-slate-600" />
          Clientes do escritório
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Por grupo: empresas (clientes_escritorio), total de processos (contagem_ci_por_grupo) e horas (TimeSheets). Atualizado diariamente pelo sync.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Buscar por grupo ou empresa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading || fetching}
          className="shrink-0"
        >
          {fetching && !loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5">Atualizar</span>
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && filtrado.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          {grupos.length === 0
            ? 'Nenhum grupo encontrado. Execute o sync do Processos Completo no vios-app.'
            : 'Nenhum grupo ou empresa corresponde à busca.'}
        </div>
      )}

      {!loading && !error && filtrado.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtrado.map((grupo: GrupoEscritorio) => (
            <GrupoEscritorioCard
              key={grupo.grupo_cliente}
              grupo={grupo}
              onSelectCliente={setSelectedCliente}
            />
          ))}
        </div>
      )}

      <ClienteEscritorioDetailSheet
        open={!!selectedCliente}
        onClose={() => setSelectedCliente(null)}
        cliente={selectedCliente}
      />
    </div>
  )
}
