import { supabase } from '@/lib/supabaseClient'
import type { LevantamentoFiltros } from './escritorioLevantamentoService'

/** Uma linha por grupo cliente (`receita_inadimplencia_chave_grupo`); sem grupo = razão social. */
export type RentabilidadeContratoLinha = {
  cliente: string
  razoes_sociais: string[]
  recebido_periodo: number
  previsto_periodo: number
  horas_minutos: number
  /** Recebido do grupo ÷ horas do grupo. Nulo sem horas. */
  valor_hora_efetivo: number | null
  /** Previsto/faturado do grupo ÷ horas do grupo. Não usa inadimplência. Nulo sem horas. */
  valor_hora_previsto: number | null
}

export type RentabilidadeContratos = {
  horas_minutos: number
  recebido_escritorio: number
  previsto_escritorio: number
  /** Recebido do escritório ÷ todas as horas do timesheet no período. */
  valor_hora_efetivo_escritorio: number | null
  /** Previsto/faturado do escritório ÷ as mesmas horas. Não usa inadimplência. */
  valor_hora_previsto_escritorio: number | null
  linhas: RentabilidadeContratoLinha[]
  data_inicio: string
  data_fim: string
  area: string | null
}

function numOrNull(v: unknown): number | null {
  return v != null ? Number(v) : null
}

function parseRentabilidade(raw: unknown): RentabilidadeContratos {
  const o = (raw ?? {}) as Record<string, unknown>
  const linhas = Array.isArray(o.linhas) ? o.linhas : []
  return {
    horas_minutos: Number(o.horas_minutos ?? 0),
    recebido_escritorio: Number(o.recebido_escritorio ?? 0),
    previsto_escritorio: Number(o.previsto_escritorio ?? 0),
    valor_hora_efetivo_escritorio: numOrNull(o.valor_hora_efetivo_escritorio),
    valor_hora_previsto_escritorio: numOrNull(o.valor_hora_previsto_escritorio),
    linhas: linhas.map((row) => {
      const r = row as Record<string, unknown>
      return {
        cliente: String(r.cliente ?? ''),
        razoes_sociais: Array.isArray(r.razoes_sociais) ? r.razoes_sociais.map(String) : [],
        recebido_periodo: Number(r.recebido_periodo ?? 0),
        previsto_periodo: Number(r.previsto_periodo ?? 0),
        horas_minutos: Number(r.horas_minutos ?? 0),
        valor_hora_efetivo: numOrNull(r.valor_hora_efetivo),
        valor_hora_previsto: numOrNull(r.valor_hora_previsto),
      }
    }),
    data_inicio: String(o.data_inicio ?? ''),
    data_fim: String(o.data_fim ?? ''),
    area: (o.area as string | null) ?? null,
  }
}

export const escritorioRentabilidadeService = {
  async fetchGruposComFaturamento(
    dataInicio: string,
    dataFim: string,
    area: string | null,
  ): Promise<string[]> {
    const { data, error } = await supabase.rpc(
      'escritorio_rentabilidade_grupos_com_faturamento' as never,
      {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_area: area,
      } as never,
    )
    if (error) throw error
    return ((data ?? []) as unknown[]).map(String)
  },

  async fetchContratos(filtros: LevantamentoFiltros): Promise<RentabilidadeContratos> {
    const { data, error } = await supabase.rpc(
      'escritorio_rentabilidade_contratos' as never,
      {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_grupos: null,
        p_area: filtros.area,
      } as never,
    )
    if (error) throw error
    return parseRentabilidade(data)
  },
}
