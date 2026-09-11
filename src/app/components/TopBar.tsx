import { RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { formatDateTime } from '@/shared/utils/format'
import { useReceitaUltimaAtualizacao } from '@/features/receita/hooks/useReceitaUltimaAtualizacao'

const LOGO_AZUL = '/team/logo-azul.png'

export function TopBar() {
  const { pathname } = useLocation()
  const isReceita = pathname.startsWith('/financeiro/receita')
  const { data: ultimaAtualizacao } = useReceitaUltimaAtualizacao(isReceita)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-3 border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-sm">
      {isReceita && ultimaAtualizacao && (
        <span
          className="flex items-center gap-1.5 text-xs text-slate-400"
          title="Última carga VIOS (parcelas e itens financeiros)"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Atualizado em {formatDateTime(ultimaAtualizacao)}
        </span>
      )}
      <img
        src={LOGO_AZUL}
        alt="Bismarchi Pires"
        className="h-7 w-auto shrink-0 object-contain"
      />
    </header>
  )
}
