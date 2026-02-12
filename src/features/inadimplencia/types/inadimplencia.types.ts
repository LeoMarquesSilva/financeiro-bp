import { z } from 'zod'
import type { ClientInadimplenciaRow, InadimplenciaLogRow, InadimplenciaPagamentoRow } from '@/lib/database.types'
import type { InadimplenciaClasse, InadimplenciaTipoAcao } from '@/lib/database.types'

export type { ClientInadimplenciaRow, InadimplenciaLogRow, InadimplenciaPagamentoRow }
export type { InadimplenciaClasse, InadimplenciaTipoAcao }

export const classeSchema = z.enum(['A', 'B', 'C'])
export const tipoAcaoSchema = z.enum(['ligacao', 'email', 'reuniao', 'proposta', 'acordo', 'outro'])

export const clienteInadimplenciaFormSchema = z.object({
  razao_social: z.string().min(1, 'Razão social é obrigatória'),
  cnpj: z.string().optional().transform((s) => (s ? s.replace(/\D/g, '') : undefined)),
  contato: z.string().optional(),
  gestor: z.string().optional(),
  area: z.string().optional(),
  status_classe: classeSchema.default('A'),
  valor_em_aberto: z.coerce.number().min(0, 'Valor deve ser >= 0'),
  data_vencimento: z.string().min(1, 'Data de vencimento é obrigatória'),
})
export type ClienteInadimplenciaForm = z.infer<typeof clienteInadimplenciaFormSchema>

export const registroAcaoSchema = z.object({
  tipo: tipoAcaoSchema,
  descricao: z.string().optional(),
  data_acao: z.string().min(1, 'Data da ação é obrigatória'),
})
export type RegistroAcaoForm = z.infer<typeof registroAcaoSchema>

export const registroPagamentoSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  data_pagamento: z.string().min(1, 'Data do pagamento é obrigatória'),
  forma_pagamento: z.string().optional(),
  observacao: z.string().optional(),
})
export type RegistroPagamentoForm = z.infer<typeof registroPagamentoSchema>

export type PrioridadeTipo = 'urgente' | 'atencao' | 'controlado'

export interface FiltrosInadimplencia {
  busca: string
  gestor: string
  area: string
  classe: InadimplenciaClasse | ''
  prioridade: PrioridadeTipo | ''
}

export type OrderByInadimplencia = 'created_at' | 'dias_em_aberto' | 'valor_em_aberto' | 'razao_social'

export interface ListagemParams {
  busca?: string
  gestor?: string
  area?: string
  classe?: InadimplenciaClasse
  prioridade?: PrioridadeTipo
  page?: number
  pageSize?: number
  orderBy?: OrderByInadimplencia
  orderDesc?: boolean
}
