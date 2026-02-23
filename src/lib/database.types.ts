export type InadimplenciaClasse = 'A' | 'B' | 'C'

export type InadimplenciaTipoAcao =
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'proposta'
  | 'acordo'
  | 'outro'

/** Tipo de follow-up de uma providência (comitê de inadimplência) */
export type ProvidenciaFollowUpTipo = 'devolutiva' | 'cobranca' | 'acordo'

export interface TeamMemberRow {
  id: string
  email: string
  full_name: string
  area: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      team_members: {
        Row: TeamMemberRow
        Insert: {
          id?: string
          email: string
          full_name: string
          area: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string
          area?: string
          avatar_url?: string | null
          updated_at?: string
        }
      }
      clients_inadimplencia: {
        Row: {
          id: string
          razao_social: string
          cnpj: string | null
          contato: string | null
          gestor: string | null
          area: string | null
          status_classe: InadimplenciaClasse
          dias_em_aberto: number
          valor_em_aberto: number
          valor_mensal: number | null
          qtd_processos: number | null
          horas_total: number | null
          horas_por_ano: Record<string, number> | null
          prioridade: 'urgente' | 'atencao' | 'controlado' | null
          data_vencimento: string | null
          observacoes_gerais: string | null
          ultima_providencia: string | null
          data_providencia: string | null
          follow_up: string | null
          data_follow_up: string | null
          resolvido_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          cliente_escritorio_id: string | null
        }
        Insert: {
          id?: string
          razao_social: string
          cnpj?: string | null
          cliente_escritorio_id?: string | null
          contato?: string | null
          gestor?: string | null
          area?: string | null
          status_classe?: InadimplenciaClasse
          dias_em_aberto?: number
          valor_em_aberto?: number
          valor_mensal?: number | null
          qtd_processos?: number | null
          horas_total?: number | null
          horas_por_ano?: Record<string, number> | null
          data_vencimento?: string | null
          observacoes_gerais?: string | null
          ultima_providencia?: string | null
          data_providencia?: string | null
          follow_up?: string | null
          data_follow_up?: string | null
          resolvido_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          cliente_escritorio_id?: string | null
        }
        Update: {
          id?: string
          razao_social?: string
          cnpj?: string | null
          cliente_escritorio_id?: string | null
          contato?: string | null
          gestor?: string | null
          area?: string | null
          status_classe?: InadimplenciaClasse
          dias_em_aberto?: number
          valor_em_aberto?: number
          valor_mensal?: number | null
          qtd_processos?: number | null
          horas_total?: number | null
          horas_por_ano?: Record<string, number> | null
          data_vencimento?: string | null
          observacoes_gerais?: string | null
          ultima_providencia?: string | null
          data_providencia?: string | null
          follow_up?: string | null
          data_follow_up?: string | null
          resolvido_at?: string | null
          updated_at?: string
        }
      }
      providencias: {
        Row: {
          id: string
          cliente_inadimplencia_id: string
          texto: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          cliente_inadimplencia_id: string
          texto: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          texto?: string
          created_by?: string | null
        }
      }
      providencia_follow_ups: {
        Row: {
          id: string
          providencia_id: string
          tipo: ProvidenciaFollowUpTipo
          texto: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          providencia_id: string
          tipo: ProvidenciaFollowUpTipo
          texto?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          tipo?: ProvidenciaFollowUpTipo
          texto?: string | null
          created_by?: string | null
        }
      }
      inadimplencia_logs: {
        Row: {
          id: string
          client_id: string
          tipo: InadimplenciaTipoAcao
          descricao: string | null
          usuario: string | null
          data_acao: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          tipo?: InadimplenciaTipoAcao
          descricao?: string | null
          usuario?: string | null
          data_acao?: string
          created_at?: string
        }
        Update: {
          client_id?: string
          tipo?: InadimplenciaTipoAcao
          descricao?: string | null
          usuario?: string | null
          data_acao?: string
        }
      }
      inadimplencia_pagamentos: {
        Row: {
          id: string
          client_id: string
          valor_pago: number
          data_pagamento: string
          forma_pagamento: string | null
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          valor_pago: number
          data_pagamento: string
          forma_pagamento?: string | null
          observacao?: string | null
          created_at?: string
        }
        Update: {
          valor_pago?: number
          data_pagamento?: string
          forma_pagamento?: string | null
          observacao?: string | null
        }
      }
      clientes_escritorio: {
        Row: {
          id: string
          grupo_cliente: string | null
          razao_social: string
          cnpj: string | null
          qtd_processos: number | null
          horas_total: number | null
          horas_por_ano: Record<string, number> | null
          created_at: string
          updated_at: string
        }
        Insert: unknown
        Update: unknown
      }
      timesheets: {
        Row: {
          id: string
          data: string
          grupo_cliente: string | null
          cliente: string
          total_horas: number
          created_at: string
          updated_at: string
        }
        Insert: unknown
        Update: unknown
      }
      contagem_ci_por_grupo: {
        Row: {
          id: string
          grupo_cliente: string
          arquivado: number
          arquivado_definitivamente: number
          arquivado_provisoriamente: number
          ativo: number
          encerrado: number
          ex_cliente: number
          suspenso: number
          outros: number
          total_geral: number
          created_at: string
          updated_at: string
        }
        Insert: unknown
        Update: unknown
      }
      timesheets_resumo_por_grupo_ano: {
        Row: {
          grupo_cliente: string
          ano: number
          total_horas: number
        }
        Insert: unknown
        Update: unknown
      }
    }
  }
}

export type ClientInadimplenciaRow = Database['public']['Tables']['clients_inadimplencia']['Row']
export type ClienteEscritorioRow = Database['public']['Tables']['clientes_escritorio']['Row']
export type TimesheetRow = Database['public']['Tables']['timesheets']['Row']
export type ContagemCiPorGrupoRow = Database['public']['Tables']['contagem_ci_por_grupo']['Row']
export type ProvidenciaRow = Database['public']['Tables']['providencias']['Row']
export type ProvidenciaFollowUpRow = Database['public']['Tables']['providencia_follow_ups']['Row']
export type InadimplenciaLogRow = Database['public']['Tables']['inadimplencia_logs']['Row']
export type InadimplenciaPagamentoRow = Database['public']['Tables']['inadimplencia_pagamentos']['Row']
export type TeamMember = TeamMemberRow
