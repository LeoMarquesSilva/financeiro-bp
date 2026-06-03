import { Settings2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ReceitaMetasConfig } from './ReceitaMetasConfig'
import { ReceitaDepartamentoCoresConfig } from './ReceitaDepartamentoCoresConfig'
import type { ReceitaMetasConfig as ReceitaMetasConfigType } from '../types/receita.types'
import type { ReceitaDepartamentoCoresConfig as ReceitaDepartamentoCoresConfigType } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  metas: ReceitaMetasConfigType
  onSaveMetas: (config: ReceitaMetasConfigType) => Promise<void>
  isSavingMetas: boolean
  cores: ReceitaDepartamentoCoresConfigType
  onSaveCores: (config: ReceitaDepartamentoCoresConfigType) => Promise<void>
  isSavingCores: boolean
}

export function ReceitaConfiguracoesSheet({
  open,
  onOpenChange,
  metas,
  onSaveMetas,
  isSavingMetas,
  cores,
  onSaveCores,
  isSavingCores,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-500" aria-hidden />
            Configurações
          </SheetTitle>
          <SheetDescription>
            Metas, projeções e cores das áreas no gráfico de receita. Salvas globalmente no Supabase.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-10 overflow-y-auto px-6 pb-8">
          <ReceitaMetasConfig metas={metas} onSave={onSaveMetas} isSaving={isSavingMetas} />
          <ReceitaDepartamentoCoresConfig
            cores={cores}
            onSave={onSaveCores}
            isSaving={isSavingCores}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
