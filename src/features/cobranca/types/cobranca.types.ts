/** Cobrança WhatsApp pendente: abre a conversa com mensagem editável antes do envio. */
export interface PendingWhatsappCobranca {
  parcela_id: string
  pessoa_id: string | null
  telefone: string
  nome: string
  mensagem: string
}
