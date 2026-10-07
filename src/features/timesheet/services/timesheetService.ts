import { supabase } from '@/lib/supabaseClient'

export type TimesheetFatia = {
  nome: string
  minutos: number
  lancamentos: number
}

export type TimesheetMes = {
  mes: number
  minutos: number
  lancamentos: number
}

export type TimesheetVisao = {
  minutos: number
  lancamentos: number
  colaboradores: number
  grupos: number
  por_mes: TimesheetMes[]
  por_colaborador: TimesheetFatia[]
  por_tipo_apontamento: TimesheetFatia[]
  por_tipo_tarefa: TimesheetFatia[]
  por_grupo: TimesheetFatia[]
  por_area: TimesheetFatia[]
  responsaveis: string[]
}

const VAZIO: TimesheetVisao = {
  minutos: 0,
  lancamentos: 0,
  colaboradores: 0,
  grupos: 0,
  por_mes: [],
  por_colaborador: [],
  por_tipo_apontamento: [],
  por_tipo_tarefa: [],
  por_grupo: [],
  por_area: [],
  responsaveis: [],
}

function asFatia(raw: unknown): TimesheetFatia[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    const item = row as Record<string, unknown>
    return {
      nome: String(item.nome ?? ''),
      minutos: Number(item.minutos ?? 0),
      lancamentos: Number(item.lancamentos ?? 0),
    }
  })
}

export async function fetchTimesheetVisao(
  ano: number,
  areas: string[] | null,
  meses: number[] | null,
  colaborador: string | null,
): Promise<TimesheetVisao> {
  const { data, error } = await supabase.rpc('timesheet_visao' as never, {
    p_ano: ano,
    p_areas: areas,
    p_meses: meses,
    p_colaborador: colaborador,
  } as never)
  if (error) throw error
  const row = (data ?? VAZIO) as Record<string, unknown>
  return {
    minutos: Number(row.minutos ?? 0),
    lancamentos: Number(row.lancamentos ?? 0),
    colaboradores: Number(row.colaboradores ?? 0),
    grupos: Number(row.grupos ?? 0),
    por_mes: Array.isArray(row.por_mes)
      ? row.por_mes.map((item) => {
          const mes = item as Record<string, unknown>
          return {
            mes: Number(mes.mes ?? 0),
            minutos: Number(mes.minutos ?? 0),
            lancamentos: Number(mes.lancamentos ?? 0),
          }
        })
      : [],
    por_colaborador: asFatia(row.por_colaborador),
    por_tipo_apontamento: asFatia(row.por_tipo_apontamento),
    por_tipo_tarefa: asFatia(row.por_tipo_tarefa),
    por_grupo: asFatia(row.por_grupo),
    por_area: asFatia(row.por_area),
    responsaveis: Array.isArray(row.responsaveis)
      ? row.responsaveis.map((nome) => String(nome ?? '').trim()).filter(Boolean)
      : [],
  }
}
