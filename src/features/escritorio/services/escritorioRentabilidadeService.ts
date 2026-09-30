import { supabase } from '@/lib/supabaseClient'
import type { LevantamentoFiltros } from './escritorioLevantamentoService'

/** Uma linha por grupo cliente (`receita_inadimplencia_chave_grupo`); sem grupo = razão social. */
export type RentabilidadeContratoLinha = {
  cliente: string
  razoes_sociais: string[]
  recebido_periodo: number
  /** Saldo líquido do período (`receita_inadimplencia_grupos_periodo`), só vencidos até o corte. */
  inadimplencia_periodo: number
  valor_contrato_mensal: number
  valor_contrato_mensal_com_inadimplencia: number
  media_horas_mes_minutos: number
  valor_hora_recebido: number | null
  resultado_hora: number | null
  valor_hora_com_inadimplencia: number | null
  resultado_hora_com_inadimplencia: number | null
}

export type RentabilidadeContratos = {
  custo_hora_produtiva: number | null
  meses_periodo: number
  linhas: RentabilidadeContratoLinha[]
  requer_grupo: boolean
  data_inicio: string
  data_fim: string
  area: string | null
  inadimplencia_corte: string | null
  inadimplencia_multi_ano: boolean
}

function rpcGrupos(filtros: LevantamentoFiltros): string[] | null {
  return filtros.grupos.length > 0 ? filtros.grupos : null
}

function numOrNull(v: unknown): number | null {
  return v != null ? Number(v) : null
}

function parseRentabilidade(raw: unknown): RentabilidadeContratos {
  const o = (raw ?? {}) as Record<string, unknown>
  const linhas = Array.isArray(o.linhas) ? o.linhas : []
  return {
    custo_hora_produtiva: numOrNull(o.custo_hora_produtiva),
    meses_periodo: Number(o.meses_periodo ?? 0),
    linhas: linhas.map((row) => {
      const r = row as Record<string, unknown>
      return {
        cliente: String(r.cliente ?? ''),
        razoes_sociais: Array.isArray(r.razoes_sociais) ? r.razoes_sociais.map(String) : [],
        recebido_periodo: Number(r.recebido_periodo ?? 0),
        inadimplencia_periodo: Number(r.inadimplencia_periodo ?? 0),
        valor_contrato_mensal: Number(r.valor_contrato_mensal ?? 0),
        valor_contrato_mensal_com_inadimplencia: Number(
          r.valor_contrato_mensal_com_inadimplencia ?? r.valor_contrato_mensal ?? 0,
        ),
        media_horas_mes_minutos: Number(r.media_horas_mes_minutos ?? 0),
        valor_hora_recebido: numOrNull(r.valor_hora_recebido),
        resultado_hora: numOrNull(r.resultado_hora),
        valor_hora_com_inadimplencia: numOrNull(r.valor_hora_com_inadimplencia),
        resultado_hora_com_inadimplencia: numOrNull(r.resultado_hora_com_inadimplencia),
      }
    }),
    requer_grupo: Boolean(o.requer_grupo),
    data_inicio: String(o.data_inicio ?? ''),
    data_fim: String(o.data_fim ?? ''),
    area: (o.area as string | null) ?? null,
    inadimplencia_corte: o.inadimplencia_corte != null ? String(o.inadimplencia_corte) : null,
    inadimplencia_multi_ano: Boolean(o.inadimplencia_multi_ano),
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
