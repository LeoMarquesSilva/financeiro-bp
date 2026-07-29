import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import type {
  OpexOrcamentoAnoMeta,
  OpexOrcamentoImportLinha,
  OpexOrcamentoImportResult,
  OpexOrcamentoLinha,
} from '../types/opex.types'
import { reconstruirDescricaoOrcamento, parseFornecedorDescricao } from '../utils/opexOrcamentoGrouping'

function normTituloRefOrcamento(titulo: string): string {
  const s = titulo.trim()
  return s || '—'
}

function normDepartamentoOrcamento(departamento: string): string {
  const s = departamento.trim()
  return s || 'Sem departamento'
}

/** Mesma linha lógica entre meses (espelha chave do upsert no banco). */
function mesmaLinhaOrcamento(a: OpexOrcamentoLinha, b: OpexOrcamentoLinha): boolean {
  return (
    a.grupo_conta === b.grupo_conta &&
    a.plano_contas === b.plano_contas &&
    normTituloRefOrcamento(a.titulo_ref) === normTituloRefOrcamento(b.titulo_ref) &&
    normDepartamentoOrcamento(a.departamento) === normDepartamentoOrcamento(b.departamento) &&
    a.descricao.trim() === b.descricao.trim() &&
    a.conta_numero.trim() === b.conta_numero.trim()
  )
}

function mapLinha(row: Record<string, unknown>): OpexOrcamentoLinha {
  return {
    id: String(row.id ?? ''),
    ano: Number(row.ano) || 0,
    mes: Number(row.mes) || 0,
    grupo_conta: String(row.grupo_conta ?? ''),
    plano_contas: String(row.plano_contas ?? ''),
    conta_numero: String(row.conta_numero ?? ''),
    titulo_ref: String(row.titulo_ref ?? ''),
    descricao: String(row.descricao ?? ''),
    departamento: String(row.departamento ?? 'Sem departamento'),
    valor: Number(row.valor) || 0,
    fixo: Boolean(row.fixo),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function mapAnoMeta(raw: Record<string, unknown>): OpexOrcamentoAnoMeta {
  return {
    ano: Number(raw.ano) || new Date().getFullYear(),
    importado: Boolean(raw.importado),
    congelado_em: raw.congelado_em ? String(raw.congelado_em) : null,
    congelado_por: raw.congelado_por ? String(raw.congelado_por) : null,
    origem: raw.origem ? String(raw.origem) : null,
    observacao: raw.observacao ? String(raw.observacao) : null,
    total_ano: raw.total_ano != null ? Number(raw.total_ano) : undefined,
    qtd_linhas: raw.qtd_linhas != null ? Number(raw.qtd_linhas) : undefined,
  }
}

export const opexOrcamentoService = {
  async fetchAnoMeta(ano: number): Promise<OpexOrcamentoAnoMeta> {
    const { data, error } = await supabase.rpc(
      'opex_orcamento_get_ano' as never,
      { p_ano: ano } as never,
    )
    if (error) throw error
    return mapAnoMeta((data ?? {}) as Record<string, unknown>)
  },

  async listLinhas(
    ano: number,
    opts?: { mes?: number | null; grupo?: string | null; busca?: string | null },
  ): Promise<OpexOrcamentoLinha[]> {
    const rows = await collectPaginatedRows<Record<string, unknown>>(async (from, to) =>
      supabase
        .rpc(
          'opex_orcamento_list' as never,
          {
            p_ano: ano,
            p_mes: opts?.mes ?? null,
            p_grupo: opts?.grupo ?? null,
            p_busca: opts?.busca ?? null,
          } as never,
        )
        .range(from, to),
    )
    return rows.map(mapLinha)
  },

  async importReplace(
    ano: number,
    linhas: OpexOrcamentoImportLinha[],
    opts?: { origem?: string; observacao?: string; congeladoPor?: string },
  ): Promise<OpexOrcamentoImportResult> {
    const { data, error } = await supabase.rpc(
      'opex_orcamento_import_replace' as never,
      {
        p_ano: ano,
        p_linhas: linhas,
        p_origem: opts?.origem ?? 'import',
        p_observacao: opts?.observacao ?? null,
        p_congelado_por: opts?.congeladoPor ?? null,
      } as never,
    )
    if (error) throw error
    const raw = (data ?? {}) as Record<string, unknown>
    return {
      ano: Number(raw.ano) || ano,
      qtd_linhas: Number(raw.qtd_linhas) || 0,
      total: Number(raw.total) || 0,
    }
  },

  async upsertLinha(input: {
    id?: string | null
    ano?: number
    mes?: number
    grupo_conta?: string
    plano_contas?: string
    conta_numero?: string
    titulo_ref?: string
    descricao?: string
    departamento?: string
    valor?: number
  }): Promise<string> {
    const { data, error } = await supabase.rpc(
      'opex_orcamento_upsert_linha' as never,
      {
        p_id: input.id ?? null,
        p_ano: input.ano ?? null,
        p_mes: input.mes ?? null,
        p_grupo_conta: input.grupo_conta ?? null,
        p_plano_contas: input.plano_contas ?? null,
        p_conta_numero: input.conta_numero ?? null,
        p_titulo_ref: input.titulo_ref ?? null,
        p_descricao: input.descricao ?? null,
        p_departamento: input.departamento ?? null,
        p_valor: input.valor ?? null,
      } as never,
    )
    if (error) throw error
    return String(data ?? '')
  },

  async deleteLinha(id: string): Promise<void> {
    const { error } = await supabase.rpc(
      'opex_orcamento_delete_linha' as never,
      { p_id: id } as never,
    )
    if (error) throw error
  },

  async updateDescricaoLinhas(
    linhas: OpexOrcamentoLinha[],
    novaDescricaoDetalhe: string,
  ): Promise<void> {
    const desc = novaDescricaoDetalhe.trim()
    if (!desc || !linhas.length) return

    await Promise.all(
      linhas.map((linha) => {
        const temSeparadorFornecedor = linha.descricao.includes(' · ')
        const novaDescricao = temSeparadorFornecedor
          ? reconstruirDescricaoOrcamento(linha, desc)
          : desc
        // Sem separador, o rótulo na hierarquia vem de titulo_ref — manter sincronizado.
        const syncTituloRef =
          !temSeparadorFornecedor ||
          parseFornecedorDescricao(linha).descricaoDetalhe === linha.titulo_ref.trim()

        return this.upsertLinha({
          id: linha.id,
          descricao: novaDescricao,
          ...(syncTituloRef ? { titulo_ref: desc } : {}),
        })
      }),
    )
  },

  async updateValorComReplicacao(
    linha: OpexOrcamentoLinha,
    valor: number,
    opts?: {
      replicarProximosMeses?: boolean
      todasLinhas?: OpexOrcamentoLinha[]
      grupo_conta?: string
      plano_contas?: string
      departamento?: string
      linhasGrupo?: OpexOrcamentoLinha[]
    },
  ): Promise<void> {
    const grupo = opts?.grupo_conta?.trim() || linha.grupo_conta
    const plano = opts?.plano_contas?.trim() || linha.plano_contas
    const departamento =
      opts?.departamento?.trim() || normDepartamentoOrcamento(linha.departamento)
    const planoMudou = grupo !== linha.grupo_conta || plano !== linha.plano_contas
    const deptMudou =
      normDepartamentoOrcamento(departamento) !==
      normDepartamentoOrcamento(linha.departamento)

    if ((planoMudou || deptMudou) && opts?.linhasGrupo?.length) {
      await Promise.all(
        opts.linhasGrupo.map((l) =>
          this.upsertLinha({
            id: l.id,
            ...(planoMudou ? { grupo_conta: grupo, plano_contas: plano } : {}),
            ...(deptMudou ? { departamento } : {}),
          }),
        ),
      )
    }

    await this.upsertLinha({
      id: linha.id,
      grupo_conta: grupo,
      plano_contas: plano,
      departamento,
      valor,
    })

    if (!opts?.replicarProximosMeses || linha.mes >= 12) return

    const todas = opts?.todasLinhas ?? []
    const alvos = new Map<string, OpexOrcamentoLinha>()

    for (const l of todas) {
      if (l.mes > linha.mes && mesmaLinhaOrcamento(l, linha)) {
        alvos.set(l.id, l)
      }
    }
    for (const l of opts?.linhasGrupo ?? []) {
      if (l.mes > linha.mes && mesmaLinhaOrcamento(l, linha)) {
        alvos.set(l.id, l)
      }
    }

    const tasks: Promise<string>[] = []

    for (const alvo of alvos.values()) {
      tasks.push(
        this.upsertLinha({
          id: alvo.id,
          grupo_conta: grupo,
          plano_contas: plano,
          departamento,
          valor,
        }),
      )
    }

    for (let mes = linha.mes + 1; mes <= 12; mes++) {
      const jaExiste = [...alvos.values()].some((l) => l.mes === mes)
      if (jaExiste) continue

      tasks.push(
        this.upsertLinha({
          ano: linha.ano,
          mes,
          grupo_conta: grupo,
          plano_contas: plano,
          conta_numero: linha.conta_numero,
          titulo_ref: normTituloRefOrcamento(linha.titulo_ref),
          descricao: linha.descricao,
          departamento,
          valor,
        }),
      )
    }

    await Promise.all(tasks)
  },
}
