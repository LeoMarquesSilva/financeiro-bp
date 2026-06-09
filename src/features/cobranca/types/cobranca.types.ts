/** Cobrança WhatsApp pendente: abre a conversa com mensagem editável antes do envio. */
export interface PendingWhatsappCobranca {
  parcela_id: string
  pessoa_id: string | null
  telefone: string
  nome: string
  mensagem: string
}

/** Abre conversa existente (ex.: título já cobrado no painel). */
export interface OpenWhatsappConversa {
  telefone: string
  nome: string
  parcela_id?: string
  message_id?: string | null
}

/** Telefone WhatsApp cadastrado para cobrança (com rótulo). */
export interface PessoaTelefoneWhatsapp {
  id: string
  pessoa_id: string
  nome: string
  telefone: string
  ordem: number
}

export interface PessoaTelefoneWhatsappInput {
  id?: string
  nome: string
  telefone: string
}

/** Cliente identificado pelo telefone da conversa (cadastro ou títulos). */
export interface PessoaTelefoneMatch {
  pessoa_id: string
  nome: string
  grupo_cliente: string | null
  contato_nome?: string | null
  fonte: 'telefone_whatsapp' | 'titulos'
}

/** Cliente vinculado manualmente à conversa WhatsApp. */
export interface WhatsappChatPessoa {
  pessoa_id: string
  nome: string
  grupo_cliente: string | null
}
