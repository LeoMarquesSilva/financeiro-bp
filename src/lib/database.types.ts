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
  is_active: boolean
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
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string
          area?: string
          avatar_url?: string | null
          role?: AppRole | null
          is_active?: boolean
          updated_at?: string
        }
      }
      app_settings: {
        Row: { key: string; value: unknown; updated_at?: string }
        Insert: { key: string; value?: unknown; updated_at?: string }
        Update: { value?: unknown; updated_at?: string }
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
          data_follow_up: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          providencia_id: string
          tipo: ProvidenciaFollowUpTipo
          texto?: string | null
          data_follow_up?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          tipo?: ProvidenciaFollowUpTipo
          texto?: string | null
          data_follow_up?: string | null
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
      pessoa_telefones_whatsapp: {
        Row: {
          id: string
          pessoa_id: string
          nome: string
          telefone: string
          ordem: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pessoa_id: string
          nome?: string
          telefone: string
          ordem?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          nome?: string
          telefone?: string
          ordem?: number
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
          valor_aberto: number | null
          valor_pago: number | null
          valor_em_atraso: number | null
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
      cobranca_eventos: {
        Row: {
          id: string
          parcela_id: string
          pessoa_id: string | null
          canal: 'whatsapp' | 'email'
          status: 'enviado' | 'erro'
          destino: string | null
          mensagem: string | null
          provider_message_id: string | null
          erro: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parcela_id: string
          pessoa_id?: string | null
          canal: 'whatsapp' | 'email'
          status?: 'enviado' | 'erro'
          destino?: string | null
          mensagem?: string | null
          provider_message_id?: string | null
          erro?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          status?: 'enviado' | 'erro'
          erro?: string | null
        }
      }
      cobranca_arquivamentos: {
        Row: {
          parcela_id: string
          motivo: string | null
          arquivado_by: string | null
          arquivado_at: string
        }
        Insert: {
          parcela_id: string
          motivo?: string | null
          arquivado_by?: string | null
          arquivado_at?: string
        }
        Update: {
          motivo?: string | null
        }
      }
      whatsapp_categorias: {
        Row: {
          id: string
          label: string
          color_scheme: string
          sort_order: number
          is_system: boolean
          created_at: string
        }
        Insert: {
          id: string
          label: string
          color_scheme?: string
          sort_order?: number
          is_system?: boolean
          created_at?: string
        }
        Update: {
          label?: string
          color_scheme?: string
          sort_order?: number
        }
      }
      whatsapp_chats: {
        Row: {
          remote_jid: string
          instance: string | null
          push_name: string | null
          profile_pic_url: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread_count: number
          categoria: string | null
          pessoa_id: string | null
          phone_jid: string | null
          updated_at: string
        }
        Insert: unknown
        Update: unknown
      }
      whatsapp_chat_pessoas: {
        Row: {
          id: string
          remote_jid: string
          pessoa_id: string
          created_at: string
        }
        Insert: {
          id?: string
          remote_jid: string
          pessoa_id: string
          created_at?: string
        }
        Update: {
          pessoa_id?: string
        }
      }
      whatsapp_mensagens: {
        Row: {
          id: string
          instance: string | null
          remote_jid: string
          message_id: string | null
          from_me: boolean
          tipo: string | null
          conteudo: string | null
          timestamp: string | null
          raw: Record<string, unknown> | null
          status: string | null
          reaction_to: string | null
          reactions: { emoji: string; fromMe?: boolean; pushName?: string | null }[]
          media_meta: {
            mimetype?: string
            fileName?: string
            seconds?: number
            caption?: string
            ptt?: boolean
            cachedAt?: string
          } | null
          created_at: string
        }
        Insert: unknown
        Update: unknown
      }
      whatsapp_group_participants: {
        Row: {
          group_jid: string
          participant_jid: string
          lid_id: string | null
          phone_number: string | null
          display_name: string | null
          profile_pic_url: string | null
          admin_role: string | null
          updated_at: string
        }
        Insert: unknown
        Update: unknown
      }
      /** View: painel de cobranca (parcelas vencidas D+1, nao arquivadas, com status por canal). */
      cobranca_painel: {
        Row: {
          parcela_id: string
          pessoa_id: string | null
          cliente: string
          nro_titulo: string | null
          parcela: string | null
          parcelas: string | null
          descricao: string | null
          plano_contas: string | null
          data_vencimento: string
          valor: number
          dias_atraso: number
          pessoa_nome: string | null
          grupo_cliente: string | null
          pessoa_telefone: string | null
          pessoa_email: string | null
          data_vencimento_efetivo: string | null
          data_prazo_d1: string | null
          tem_whatsapp: boolean
          tem_whatsapp_d1: boolean
          tem_email: boolean
          cobrancas_total: number
          ultima_cobranca_at: string | null
          concluido: boolean
        }
        Insert: unknown
        Update: unknown
      }
      /** View: todos os titulos em aberto por cliente (vencidos e a vencer). */
      cobranca_titulos_abertos: {
        Row: {
          parcela_id: string
          pessoa_id: string | null
          cliente: string
          nro_titulo: string | null
          parcela: string | null
          parcelas: string | null
          descricao: string | null
          plano_contas: string | null
          data_vencimento: string
          valor: number
          dias_atraso: number
          a_vencer: boolean
          pessoa_nome: string | null
          grupo_cliente: string | null
          pessoa_telefone: string | null
          pessoa_email: string | null
          telefone_digits: string
          tem_whatsapp: boolean
          tem_email: boolean
          cobrancas_total: number
          ultima_cobranca_at: string | null
          arquivado: boolean
        }
        Insert: unknown
        Update: unknown
      }
      /** View: indicador de Efetividade na Cobrança Inicial (D+1). */
      cobranca_kpi: {
        Row: {
          titulos_vencidos: number
          titulos_cobrados: number
          titulos_pendentes: number
          com_whatsapp: number
          com_email: number
          concluidos: number
          valor_vencido: number
          valor_cobrado: number
          valor_pendente: number
          efetividade_pct: number
        }
        Insert: unknown
        Update: unknown
      }
    }
  }
}

export type CobrancaPainelRow = Database['public']['Tables']['cobranca_painel']['Row']
export type CobrancaTituloAbertoRow = Database['public']['Tables']['cobranca_titulos_abertos']['Row']
export type CobrancaKpiRow = Database['public']['Tables']['cobranca_kpi']['Row']
export type CobrancaEventoRow = Database['public']['Tables']['cobranca_eventos']['Row']
export type WhatsappChatRow = Database['public']['Tables']['whatsapp_chats']['Row']
export type WhatsappMensagemRow = Database['public']['Tables']['whatsapp_mensagens']['Row']

export type ClientInadimplenciaRow = Database['public']['Tables']['clients_inadimplencia']['Row']
export type TimesheetRow = Database['public']['Tables']['timesheets']['Row']
export type ContagemCiPorGrupoRow = Database['public']['Tables']['contagem_ci_por_grupo']['Row']
export type RelatorioFinanceiroRow = Database['public']['Tables']['relatorio_financeiro']['Row']
export type ProvidenciaRow = Database['public']['Tables']['providencias']['Row']
export type ProvidenciaFollowUpRow = Database['public']['Tables']['providencia_follow_ups']['Row']
export type InadimplenciaLogRow = Database['public']['Tables']['inadimplencia_logs']['Row']
export type InadimplenciaPagamentoRow = Database['public']['Tables']['inadimplencia_pagamentos']['Row']
export type PessoaRow = Database['public']['Tables']['pessoas']['Row']
/** Empresa com processos, timesheets e financeiro (view escritorio_empresas_por_grupo). */
export type EscritorioEmpresaRow = Database['public']['Tables']['escritorio_empresas_por_grupo']['Row']
/** @deprecated Use PessoaRow ou EscritorioEmpresaRow; mantido para compatibilidade durante migração. */
export type ClienteEscritorioRow = PessoaRow
export type TeamMember = TeamMemberRow
