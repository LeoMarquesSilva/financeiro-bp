export type InadimplenciaClasse = 'A' | 'B' | 'C'

export type InadimplenciaTipoAcao =
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'proposta'
  | 'acordo'
  | 'outro'

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
          ultima_providencia: string | null
          data_providencia: string | null
          follow_up: string | null
          data_follow_up: string | null
          resolvido_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          razao_social: string
          cnpj?: string | null
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
          ultima_providencia?: string | null
          data_providencia?: string | null
          follow_up?: string | null
          data_follow_up?: string | null
          resolvido_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          razao_social?: string
          cnpj?: string | null
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
          ultima_providencia?: string | null
          data_providencia?: string | null
          follow_up?: string | null
          data_follow_up?: string | null
          resolvido_at?: string | null
          updated_at?: string
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
    }
  }
}

export type ClientInadimplenciaRow = Database['public']['Tables']['clients_inadimplencia']['Row']
export type InadimplenciaLogRow = Database['public']['Tables']['inadimplencia_logs']['Row']
export type InadimplenciaPagamentoRow = Database['public']['Tables']['inadimplencia_pagamentos']['Row']
export type TeamMember = TeamMemberRow
