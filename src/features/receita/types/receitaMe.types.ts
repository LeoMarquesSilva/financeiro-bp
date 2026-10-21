/** Melhor estimativa (ME) contínua — tabelas `receita_me_*`. */

export type ReceitaMeAjusteTipo = 'nao_paga' | 'vai_pagar'

export type ReceitaMeAjuste = {
  id: string
  ano: number
  area_key: string
  grupo: string
  mes: number
  tipo: ReceitaMeAjusteTipo
  /** Valor em aberto no momento da marcação (se cair, o cliente pagou). */
  valor_marcado: number
  motivo: string | null
  updated_at: string | null
  updated_by: string | null
}

export type ReceitaMeOrigem = 'cliente_existente' | 'lead' | 'exito_acordo' | 'outro'
export type ReceitaMeRecorrencia = 'pontual' | 'mensal'
export type ReceitaMeChance = 'alta' | 'media' | 'baixa'

export type ReceitaMeNovaReceita = {
  id: string
  ano: number
  area_key: string
  nome: string
  grupo_cliente: string | null
  origem: ReceitaMeOrigem
  tipo_receita: string | null
  recorrencia: ReceitaMeRecorrencia
  mes_inicio: number
  mes_fim: number
  /** Valor por mês quando mensal. */
  valor: number
  chance: ReceitaMeChance
  observacao: string | null
  /** Meses em que virou título no VIOS e deixou de contar. */
  meses_baixados: number[]
  updated_at: string | null
  updated_by: string | null
}

export type ReceitaMeNovaReceitaInput = Omit<
  ReceitaMeNovaReceita,
  'id' | 'updated_at' | 'updated_by' | 'meses_baixados'
> & { id?: string; meses_baixados?: number[] }

export type ReceitaMeVisto = {
  ano: number
  area_key: string
  grupo: string
  mes: number
  valor_visto: number
}

export type ReceitaMeAreaStatus = {
  ano: number
  area_key: string
  confirmada_em: string | null
  confirmada_por: string | null
  confirmada_por_nome: string | null
  updated_at: string | null
  updated_by: string | null
}

export type ReceitaMeResponsavel = {
  id: string
  area_key: string
  nome: string
  email: string
  ativo: boolean
}

export type ReceitaMeHistoricoRow = {
  id: number
  ano: number | null
  area_key: string | null
  tabela: string
  operacao: 'INSERT' | 'UPDATE' | 'DELETE'
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  usuario_email: string | null
  usuario_nome: string | null
  created_at: string
}

export type ReceitaMeSnapshotRow = {
  ano: number
  mes_ref: number
  area_key: string
  mes: number
  base: 'realizado' | 'me'
  valor: number
  gerado_em?: string | null
}
