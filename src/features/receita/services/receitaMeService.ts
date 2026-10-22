import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import { receitaService } from './receitaService'
import { buildClienteGrupoMap, valorRecebidoItem } from '../utils/recebidoGrupos'
import { areaKeyForDepartamento, chaveGrupoRateio } from '../utils/receitaRateioConsulta'
import {
  itemVencimentoVencidoAteCorte,
  refDateCorteInadMes,
} from '../utils/receitaPrevistoFechamento'
import type { ReceitaMeItemPrevisto, ReceitaMeItemRecebido } from '../utils/receitaMeCalc'
import type {
  ReceitaMeAjuste,
  ReceitaMeAjusteTipo,
  ReceitaMeAreaStatus,
  ReceitaMeHistoricoRow,
  ReceitaMeNovaReceita,
  ReceitaMeNovaReceitaInput,
  ReceitaMeResponsavel,
  ReceitaMeSnapshotRow,
  ReceitaMeVisto,
} from '../types/receitaMe.types'

export type ReceitaMeBase = {
  previstos: ReceitaMeItemPrevisto[]
  recebidos: ReceitaMeItemRecebido[]
}

const AJUSTE_COLS = 'id, ano, area_key, grupo, mes, tipo, valor_marcado, motivo, updated_at, updated_by'
const NOVA_COLS =
  'id, ano, area_key, nome, grupo_cliente, origem, tipo_receita, recorrencia, mes_inicio, mes_fim, valor, chance, observacao, meses_baixados, updated_at, updated_by'

function temData(raw: string | null | undefined): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(raw?.trim() ?? '')
}

function mapAjuste(row: Record<string, unknown>): ReceitaMeAjuste {
  return {
    id: String(row.id),
    ano: Number(row.ano),
    area_key: String(row.area_key),
    grupo: String(row.grupo),
    mes: Number(row.mes),
    tipo: row.tipo as ReceitaMeAjusteTipo,
    valor_marcado: Number(row.valor_marcado) || 0,
    motivo: row.motivo != null ? String(row.motivo) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
  }
}

function mapNova(row: Record<string, unknown>): ReceitaMeNovaReceita {
  return {
    id: String(row.id),
    ano: Number(row.ano),
    area_key: String(row.area_key),
    nome: String(row.nome ?? ''),
    grupo_cliente: row.grupo_cliente != null ? String(row.grupo_cliente) : null,
    origem: row.origem as ReceitaMeNovaReceita['origem'],
    tipo_receita: row.tipo_receita != null ? String(row.tipo_receita) : null,
    recorrencia: row.recorrencia as ReceitaMeNovaReceita['recorrencia'],
    mes_inicio: Number(row.mes_inicio),
    mes_fim: Number(row.mes_fim),
    valor: Number(row.valor) || 0,
    chance: row.chance as ReceitaMeNovaReceita['chance'],
    observacao: row.observacao != null ? String(row.observacao) : null,
    meses_baixados: Array.isArray(row.meses_baixados) ? row.meses_baixados.map(Number) : [],
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
  }
}

export const receitaMeService = {
  /**
   * Carteira (títulos com vencimento nos meses do horizonte) e caixa do mês corrente,
   * já com grupo (Sem grupo → razão social) e área pelo departamento VIOS do item.
   */
  async carregarBase(ano: number, meses: number[], mesCorrente: number | null): Promise<ReceitaMeBase> {
    if (meses.length === 0) return { previstos: [], recebidos: [] }
    const [listasPrevisto, recebidoMes, empresas] = await Promise.all([
      Promise.all(meses.map((m) => receitaService.fetchPrevistoMesItens(ano, m))),
      mesCorrente != null
        ? receitaService.fetchRecebidoClassificacaoMes(ano, mesCorrente)
        : Promise.resolve([]),
      receitaService.fetchEmpresasNomeGrupo(),
    ])
    const grupoMap = buildClienteGrupoMap(empresas)

    const previstos: ReceitaMeItemPrevisto[] = []
    listasPrevisto.forEach((lista, idx) => {
      const mes = meses[idx]
      const corte = refDateCorteInadMes(ano, mes)
      for (const item of lista) {
        const valor = Number(item.valor_item) || 0
        if (valor === 0) continue
        const pago = temData(item.data_pagamento)
        previstos.push({
          areaKey: areaKeyForDepartamento(item.departamento),
          grupo: chaveGrupoRateio(item.cliente, grupoMap),
          mes,
          valor,
          pago,
          vencido: !pago && itemVencimentoVencidoAteCorte(item.data_vencimento, corte),
        })
      }
    })

    const recebidos: ReceitaMeItemRecebido[] = recebidoMes
      .map((item) => ({
        areaKey: areaKeyForDepartamento(item.departamento),
        grupo: chaveGrupoRateio(item.cliente, grupoMap),
        valor: valorRecebidoItem(item),
      }))
      .filter((r) => r.valor !== 0)

    return { previstos, recebidos }
  },

  /** Recebido por área e mês (meses fechados entram pelo realizado). */
  async carregarRealizadoPorArea(ano: number): Promise<Record<string, Record<number, number>>> {
    const rows = await receitaService.fetchRecebidoPorDepartamento(ano)
    const out: Record<string, Record<number, number>> = {}
    for (const row of rows) {
      const area = areaKeyForDepartamento(row.departamento)
      const porMes = (out[area] ??= {})
      porMes[row.mes] = (porMes[row.mes] ?? 0) + row.total
    }
    return out
  },

  async minhasAreas(): Promise<string[]> {
    const { data, error } = await supabase.rpc('receita_me_minhas_areas' as never)
    if (error) throw error
    return ((data ?? []) as unknown[]).map((v) =>
      typeof v === 'string' ? v : String((v as Record<string, unknown>).receita_me_minhas_areas ?? ''),
    ).filter(Boolean)
  },

  async listResponsaveis(): Promise<ReceitaMeResponsavel[]> {
    const { data, error } = await supabase
      .from('receita_me_responsaveis' as never)
      .select('id, area_key, nome, email, ativo')
      .order('area_key')
      .order('nome')
    if (error) throw error
    return (data ?? []) as unknown as ReceitaMeResponsavel[]
  },

  async saveResponsavel(input: Omit<ReceitaMeResponsavel, 'id'> & { id?: string }): Promise<void> {
    const payload = {
      area_key: input.area_key,
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      ativo: input.ativo,
    }
    const query = input.id
      ? supabase.from('receita_me_responsaveis' as never).update(payload as never).eq('id', input.id)
      : supabase.from('receita_me_responsaveis' as never).insert(payload as never)
    const { error } = await query
    if (error) throw error
  },

  async deleteResponsavel(id: string): Promise<void> {
    const { error } = await supabase.from('receita_me_responsaveis' as never).delete().eq('id', id)
    if (error) throw error
  },

  async listAreaStatus(ano: number): Promise<ReceitaMeAreaStatus[]> {
    const { data, error } = await supabase
      .from('receita_me_area_status' as never)
      .select('ano, area_key, confirmada_em, confirmada_por, confirmada_por_nome, updated_at, updated_by')
      .eq('ano', ano)
    if (error) throw error
    return (data ?? []) as unknown as ReceitaMeAreaStatus[]
  },

  async listVistos(ano: number): Promise<ReceitaMeVisto[]> {
    const data = await collectPaginatedRows<Record<string, unknown>>(async (from, to) =>
      supabase
        .from('receita_me_vistos' as never)
        .select('ano, area_key, grupo, mes, valor_visto')
        .eq('ano', ano)
        .order('area_key')
        .order('grupo')
        .order('mes')
        .range(from, to),
    )
    return data.map((r) => ({
      ano: Number(r.ano),
      area_key: String(r.area_key),
      grupo: String(r.grupo),
      mes: Number(r.mes),
      valor_visto: Number(r.valor_visto) || 0,
    }))
  },

  async marcarVistos(rows: ReceitaMeVisto[]): Promise<void> {
    if (rows.length === 0) return
    for (let i = 0; i < rows.length; i += 500) {
      const lote = rows.slice(i, i + 500).map((r) => ({
        ...r,
        valor_visto: Math.round(r.valor_visto * 100) / 100,
        visto_em: new Date().toISOString(),
      }))
      const { error } = await supabase
        .from('receita_me_vistos' as never)
        .upsert(lote as never, { onConflict: 'ano,area_key,grupo,mes' })
      if (error) throw error
    }
  },

  async confirmarArea(input: {
    ano: number
    areaKey: string
    email: string | null
    nome: string | null
    vistos: ReceitaMeVisto[]
  }): Promise<void> {
    await this.marcarVistos(input.vistos)
    const { error } = await supabase.from('receita_me_area_status' as never).upsert(
      {
        ano: input.ano,
        area_key: input.areaKey,
        confirmada_em: new Date().toISOString(),
        confirmada_por: input.email,
        confirmada_por_nome: input.nome,
      } as never,
      { onConflict: 'ano,area_key' },
    )
    if (error) throw error
  },

  async listAjustes(ano: number): Promise<ReceitaMeAjuste[]> {
    const data = await collectPaginatedRows<Record<string, unknown>>(async (from, to) =>
      supabase
        .from('receita_me_ajustes' as never)
        .select(AJUSTE_COLS)
        .eq('ano', ano)
        .order('id')
        .range(from, to),
    )
    return data.map(mapAjuste)
  },

  async salvarAjustes(
    rows: Array<{
      ano: number
      area_key: string
      grupo: string
      mes: number
      tipo: ReceitaMeAjusteTipo
      valor_marcado: number
    }>,
  ): Promise<void> {
    if (rows.length === 0) return
    const { error } = await supabase
      .from('receita_me_ajustes' as never)
      .upsert(
        rows.map((r) => ({ ...r, valor_marcado: Math.round(r.valor_marcado * 100) / 100 })) as never,
        { onConflict: 'ano,area_key,grupo,mes' },
      )
    if (error) throw error
  },

  async removerAjustes(
    chaves: Array<{ ano: number; area_key: string; grupo: string; mes: number }>,
  ): Promise<void> {
    for (const c of chaves) {
      const { error } = await supabase
        .from('receita_me_ajustes' as never)
        .delete()
        .eq('ano', c.ano)
        .eq('area_key', c.area_key)
        .eq('grupo', c.grupo)
        .eq('mes', c.mes)
      if (error) throw error
    }
  },

  async listNovasReceitas(ano: number): Promise<ReceitaMeNovaReceita[]> {
    const { data, error } = await supabase
      .from('receita_me_novas_receitas' as never)
      .select(NOVA_COLS)
      .eq('ano', ano)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapNova)
  },

  async salvarNovaReceita(input: ReceitaMeNovaReceitaInput): Promise<void> {
    const payload = {
      ano: input.ano,
      area_key: input.area_key,
      nome: input.nome.trim(),
      grupo_cliente: input.grupo_cliente?.trim() || null,
      origem: input.origem,
      tipo_receita: input.tipo_receita?.trim() || null,
      recorrencia: input.recorrencia,
      mes_inicio: input.mes_inicio,
      mes_fim: input.recorrencia === 'pontual' ? input.mes_inicio : input.mes_fim,
      valor: Math.round(input.valor * 100) / 100,
      chance: input.chance,
      observacao: input.observacao?.trim() || null,
      ...(input.meses_baixados ? { meses_baixados: input.meses_baixados } : {}),
    }
    const query = input.id
      ? supabase.from('receita_me_novas_receitas' as never).update(payload as never).eq('id', input.id)
      : supabase.from('receita_me_novas_receitas' as never).insert(payload as never)
    const { error } = await query
    if (error) throw error
  },

  async baixarMesesNovaReceita(id: string, meses: number[]): Promise<void> {
    const { error } = await supabase
      .from('receita_me_novas_receitas' as never)
      .update({ meses_baixados: [...new Set(meses)].sort((a, b) => a - b) } as never)
      .eq('id', id)
    if (error) throw error
  },

  async removerNovaReceita(id: string): Promise<void> {
    const { error } = await supabase.from('receita_me_novas_receitas' as never).delete().eq('id', id)
    if (error) throw error
  },

  async listHistorico(ano: number, limit = 200): Promise<ReceitaMeHistoricoRow[]> {
    const { data, error } = await supabase
      .from('receita_me_historico' as never)
      .select('id, ano, area_key, tabela, operacao, antes, depois, usuario_email, usuario_nome, created_at')
      .or(`ano.eq.${ano},ano.is.null`)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as ReceitaMeHistoricoRow[]
  },

  async listSnapshots(ano: number): Promise<ReceitaMeSnapshotRow[]> {
    const { data, error } = await supabase
      .from('receita_me_snapshot_mensal' as never)
      .select('ano, mes_ref, area_key, mes, base, valor, gerado_em')
      .eq('ano', ano)
      .order('mes_ref')
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      ano: Number(r.ano),
      mes_ref: Number(r.mes_ref),
      area_key: String(r.area_key),
      mes: Number(r.mes),
      base: r.base as ReceitaMeSnapshotRow['base'],
      valor: Number(r.valor) || 0,
      gerado_em: r.gerado_em != null ? String(r.gerado_em) : null,
    }))
  },

  /** Foto do mês: só grava se ainda não existir (primeiro acesso do mês). */
  async registrarSnapshot(rows: ReceitaMeSnapshotRow[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await supabase
      .from('receita_me_snapshot_mensal' as never)
      .upsert(
        rows.map((r) => ({ ...r, valor: Math.round(r.valor * 100) / 100 })) as never,
        { onConflict: 'ano,mes_ref,area_key,mes', ignoreDuplicates: true },
      )
    if (error) throw error
  },
}
