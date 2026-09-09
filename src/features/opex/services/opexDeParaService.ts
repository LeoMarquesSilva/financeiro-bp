import { supabase } from '@/lib/supabaseClient'
import type { OpexGrupoDePara } from '../types/opex.types'

function mapRow(row: Record<string, unknown>): OpexGrupoDePara {
  return {
    id: String(row.id ?? ''),
    anoOrigem: Number(row.ano_origem) || 0,
    nomeOrigem: String(row.nome_origem ?? ''),
    anoDestino: Number(row.ano_destino) || 0,
    nomeDestino: String(row.nome_destino ?? ''),
  }
}

export const opexDeParaService = {
  async list(anoOrigem: number, anoDestino: number): Promise<OpexGrupoDePara[]> {
    const { data, error } = await supabase
      .from('opex_grupo_de_para' as never)
      .select('id, ano_origem, nome_origem, ano_destino, nome_destino')
      .eq('ano_origem' as never, anoOrigem)
      .eq('ano_destino' as never, anoDestino)
      .order('nome_origem' as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow)
  },

  async upsert(input: {
    id?: string
    anoOrigem: number
    nomeOrigem: string
    anoDestino: number
    nomeDestino: string
  }): Promise<OpexGrupoDePara> {
    const payload = {
      ano_origem: input.anoOrigem,
      nome_origem: input.nomeOrigem.trim(),
      ano_destino: input.anoDestino,
      nome_destino: input.nomeDestino.trim(),
    }
    const query = input.id
      ? supabase.from('opex_grupo_de_para' as never).update(payload as never).eq('id' as never, input.id)
      : supabase.from('opex_grupo_de_para' as never).upsert(payload as never, {
          onConflict: 'ano_origem,nome_origem,ano_destino',
        })
    const { data, error } = await query.select('id, ano_origem, nome_origem, ano_destino, nome_destino').single()
    if (error) throw error
    return mapRow((data ?? {}) as Record<string, unknown>)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('opex_grupo_de_para' as never).delete().eq('id' as never, id)
    if (error) throw error
  },
}
