export type AppRole = 'admin' | 'financeiro' | 'comite'

export type InadimplenciaClasse = 'A' | 'B' | 'C'

export type InadimplenciaTipoAcao =
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'proposta'
  | 'acordo'
  | 'outro'

/** Tipo de follow-up de uma providência (comitê de inadimplência) */
export type ProvidenciaFollowUpTipo = 'devolutiva' | 'cobranca' | 'acordo' | 'validar_acordo_comite' | 'avaliar_devolutiva_comite' | 'andamento_negociacao'

export interface TeamMemberRow {
  id: string
  email: string
  full_name: string
  area: string
  avatar_url: string | null
  role: AppRole | null
  password_changed: boolean
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
          role?: AppRole | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string
          area?: string
          avatar_url?: string | null
          role?: AppRole | null
          updated_at?: string
        }
      }
      clients_inadimplencia: {
        Row: {
          id: string
          razao_social: string
          cnpj: string | null
          contato: string | null
          gestor: string[] | null
          area: string[] | null
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
          reaberto_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          pessoa_id: string | null
        }
        Insert: {
          id?: string
          razao_social: string
          cnpj?: string | null
          pessoa_id?: string | null
          contato?: string | null
          gestor?: string[] | null
          area?: string[] | null
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
          reaberto_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          razao_social?: string
          cnpj?: string | null
          pessoa_id?: string | null
          contato?: string | null
          gestor?: string[] | null
          area?: string[] | null
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
          reaberto_at?: string | null
          updated_at?: string
        }
      }
      providencias: {
        Row: {
          id: string
          cliente_inadimplencia_id: string
          texto: string
          data_providencia: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          cliente_inadimplencia_id: string
          texto: string
          data_providencia?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          texto?: string
          data_providencia?: string | null
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
      timesheets: {
        Row: {
          id: string
          data: string
          grupo_cliente: string | null
          cliente: string
          total_horas: number
          total_horas_decimal: number | null
          pessoa_id: string | null
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
      relatorio_financeiro: {
        Row: {
          id: string
          ci_titulo: number
          ci_parcela: number
          data_vencimento: string
          nro_titulo: string
          cliente: string
          pessoa_id: string | null
          descricao: string | null
          valor: number
          situacao: string
          data_baixa: string | null
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
      pessoas: {
        Row: {
          id: string
          ci: string | null
          cpf_cnpj: string | null
          nome: string
          grupo_cliente: string | null
          categoria: string | null
          qtd_processos: number | null
          horas_total: number | null
          horas_por_ano: Record<string, number> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ci?: string | null
          cpf_cnpj?: string | null
          nome: string
          grupo_cliente?: string | null
          categoria?: string | null
          qtd_processos?: number | null
          horas_total?: number | null
          horas_por_ano?: Record<string, number> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          ci?: string | null
          cpf_cnpj?: string | null
          nome?: string
          grupo_cliente?: string | null
          categoria?: string | null
          qtd_processos?: number | null
          horas_total?: number | null
          horas_por_ano?: Record<string, number> | null
          updated_at?: string
        }
      }
      relatorio_financeiro_resumo_por_cliente: {
        Row: {
          pessoa_id: string
          parcelas_abertas: number
          parcelas_pagas: number
          parcelas_em_atraso: number
          valor_aberto: number
          valor_pago: number
          valor_em_atraso: number
        }
        Insert: unknown
        Update: unknown
      }
      /** View: pessoas + qtd_processos, horas_total, horas_por_ano (de processos_completo e timesheets). */
      pessoas_escritorio: {
        Row: {
          id: string
          ci: string | null
          grupo_cliente: string | null
          nome: string
          cpf_cnpj: string | null
          categoria: string | null
          created_at: string
          updated_at: string
          qtd_processos: number | null
          horas_total: number | null
          horas_por_ano: Record<string, number> | null
        }
        Insert: unknown
        Update: unknown
      }
      /** View: empresas por grupo; grupo_cliente de pessoas ou, se vazio, de processos_completo. */
      escritorio_empresas_por_grupo: {
        Row: {
          id: string
          ci: string | null
          grupo_cliente: string | null
          nome: string
          cpf_cnpj: string | null
          categoria: string | null
          created_at: string
          updated_at: string
          qtd_processos: number | null
          horas_total: number | null
          horas_por_ano: Record<string, number> | null
        }
        Insert: unknown
        Update: unknown
      }
      /** View: um resumo por grupo (total_empresas, total_geral, horas, valores) para paginação. */
      escritorio_grupos_resumo: {
        Row: {
          grupo_cliente: string
          total_empresas: number
          total_geral: number
          horas_total: number
          valor_aberto: number
          valor_pago: number
          valor_em_atraso: number
        }
        Insert: unknown
        Update: unknown
      }
    }
  }
}

export type ClientInadimplenciaRow = Database['public']['Tables']['clients_inadimplencia']['Row']
export type TimesheetRow = Database['public']['Tables']['timesheets']['Row']
export type ContagemCiPorGrupoRow = Database['public']['Tables']['contagem_ci_por_grupo']['Row']
export type RelatorioFinanceiroRow = Database['public']['Tables']['relatorio_financeiro']['Row']
export type ProvidenciaRow = Database['public']['Tables']['providencias']['Row']
export type ProvidenciaFollowUpRow = Database['public']['Tables']['providencia_follow_ups']['Row']
export type InadimplenciaLogRow = Database['public']['Tables']['inadimplencia_logs']['Row']
export type InadimplenciaPagamentoRow = Database['public']['Tables']['inadimplencia_pagamentos']['Row']
export type PessoaRow = Database['public']['Tables']['pessoas']['Row']
/** @deprecated Use PessoaRow; mantido para compatibilidade durante migração. */
export type ClienteEscritorioRow = PessoaRow
export type TeamMember = TeamMemberRow
