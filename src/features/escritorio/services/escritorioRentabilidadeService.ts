import { supabase } from '@/lib/supabaseClient'
import type { LevantamentoFiltros } from './escritorioLevantamentoService'

export type RentabilidadeContratoLinha = {
  cliente: string
  valor_contrato_mensal: number
  media_horas_mes_minutos: number
  valor_hora_recebido: number | null
  resultado_hora: number | null
}

export type RentabilidadeContratos = {
  custo_hora_produtiva: number | null
  meses_periodo: number
  linhas: RentabilidadeContratoLinha[]
  requer_grupo: boolean
  data_inicio: string
  data_fim: string
  area: string | null
}

function rpcGrupos(filtros: LevantamentoFiltros): string[] | null {
  return filtros.grupos.length > 0 ? filtros.grupos : null
}

function parseRentabilidade(raw: unknown): RentabilidadeContratos {
  const o = (raw ?? {}) as Record<string, unknown>
  const linhas = Array.isArray(o.linhas) ? o.linhas : []
  return {
    custo_hora_produtiva:
      o.custo_hora_produtiva != null ? Number(o.custo_hora_produtiva) : null,
    meses_periodo: Number(o.meses_periodo ?? 0),
    linhas: linhas.map((row) => {
      const r = row as Record<string, unknown>
      return {
        cliente: String(r.cliente ?? ''),
        valor_contrato_mensal: Number(r.valor_contrato_mensal ?? 0),
        media_horas_mes_minutos: Number(r.media_horas_mes_minutos ?? 0),
        valor_hora_recebido:
          r.valor_hora_recebido != null ? Number(r.valor_hora_recebido) : null,
        resultado_hora: r.resultado_hora != null ? Number(r.resultado_hora) : null,
      }
    }),
    requer_grupo: Boolean(o.requer_grupo),
    data_inicio: String(o.data_inicio ?? ''),
    data_fim: String(o.data_fim ?? ''),
    area: (o.area as string | null) ?? null,
  }
}

export const escritorioRentabilidadeService = {
  async fetchContratos(filtros: LevantamentoFiltros): Promise<RentabilidadeContratos> {
    const { data, error } = await supabase.rpc(
      'escritorio_rentabilidade_contratos' as never,
      {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_grupos: rpcGrupos(filtros),
        p_area: filtros.area,
      } as never,
    )
    if (error) throw error
    return parseRentabilidade(data)
  },
}
