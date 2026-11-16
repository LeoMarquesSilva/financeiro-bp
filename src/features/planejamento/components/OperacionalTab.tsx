import { useState } from 'react'
import { useIndicadoresOperacionais } from '../hooks/useIndicadores'
import { MESES_ABREV, areaNome } from '../utils/areasPlanejamento'
import type { MetaOperacionalPremissa } from '../utils/planejamentoCalc'
import { AreaChips, Aviso, CarregandoBloco, ErroBloco, Secao } from './PlanUi'
import { TabelaIndicadores } from './TabelaIndicadores'

type Props = {
  ultimoMesFechado: number
  operacionais: Record<string, MetaOperacionalPremissa>
  nomeCenario: string | null
}

export function OperacionalTab({ ultimoMesFechado, operacionais, nomeCenario }: Props) {
  const [sel, setSel] = useState('escritorio')
  const dados = useIndicadoresOperacionais(sel, ultimoMesFechado)
  const rotulo26 = `2026 (jan–${(MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()})`
  const nome = sel === 'escritorio' ? 'Escritório' : areaNome(sel)

  return (
    <div className="space-y-4">
      <AreaChips value={sel} onChange={setSel} />
      {(sel === 'add' || sel === 'tributario') && (
        <Aviso tom="azul">O painel de Eficiência não tem indicadores por área para {nome}; aparecem só as horas do timesheet.</Aviso>
      )}
      <Secao
        titulo={`Indicadores operacionais — ${nome}`}
        subtitulo={`Mesmas contas do painel de Eficiência Operacional e de Operações Legais. Meta 2027: ${
          nomeCenario ? `cenário “${nomeCenario}”` : 'nenhum cenário selecionado'
        } (edite na aba Metas 2027).`}
      >
        {dados.error ? (
          <ErroBloco erro={dados.error} contexto="os indicadores operacionais" />
        ) : dados.isLoading ? (
          <CarregandoBloco />
        ) : (
          <TabelaIndicadores
            areaKey={sel}
            areaNome={nome}
            v25={dados.v25}
            v26={dados.v26}
            rotulo26={rotulo26}
            operacionais={operacionais}
          />
        )}
      </Secao>
    </div>
  )
}
