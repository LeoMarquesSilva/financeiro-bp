import { useState } from 'react'
import { FileSpreadsheet, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IndicadoresResultadoDialog } from './IndicadoresResultadoDialog'
import { AmostraChamadosDialog } from './AmostraChamadosDialog'

type Props = {
  ano: number
}

function mesPadrao(): number {
  const m = new Date().getMonth() + 1
  return m
}

export function IndicadoresResultadoActions({ ano }: Props) {
  const [mes, setMes] = useState(mesPadrao)
  const [openExcel, setOpenExcel] = useState(false)
  const [openAmostra, setOpenAmostra] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenExcel(true)}
        >
          <FileSpreadsheet />
          Indicadores Resultado
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenAmostra(true)}
        >
          <Ticket />
          Amostra Chamados
        </Button>
      </div>

      <IndicadoresResultadoDialog
        open={openExcel}
        onOpenChange={setOpenExcel}
        ano={ano}
        mes={mes}
        onMesChange={setMes}
      />
      <AmostraChamadosDialog
        open={openAmostra}
        onOpenChange={setOpenAmostra}
        ano={ano}
        mes={mes}
        onMesChange={setMes}
      />
    </>
  )
}
