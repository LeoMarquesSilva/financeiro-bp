import { formatCurrency, formatDate } from '@/shared/utils/format'

export interface TemplateVars {
  nome: string
  titulo: string
  descricao: string
  valor: string
  vencimento: string
  dias_atraso: string
  /** Nome do usuário logado (assinatura da cobrança). */
  usuario: string
}

/** Campos mínimos necessários para montar a mensagem (painel ou títulos em aberto). */
export interface TemplateSource {
  pessoa_nome?: string | null
  cliente?: string | null
  nro_titulo?: string | null
  descricao?: string | null
  valor?: number | null
  data_vencimento?: string | null
  dias_atraso?: number | null
}

/** Monta as variáveis de template a partir de uma linha de cobrança. */
export function buildTemplateVars(row: TemplateSource, usuario?: string | null): TemplateVars {
  return {
    nome: row.pessoa_nome || row.cliente || 'Cliente',
    titulo: row.nro_titulo || '-',
    descricao: row.descricao || '-',
    valor: formatCurrency(Number(row.valor ?? 0)),
    vencimento: row.data_vencimento ? formatDate(row.data_vencimento) : '-',
    dias_atraso: String(row.dias_atraso ?? 0),
    usuario: usuario?.trim() || 'Bismarchi Pires Advogados',
  }
}

/** Primeiro nome de um nome completo (ex.: "Leonardo Marques" -> "Leonardo"). */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? '').trim()
  if (!limpo) return ''
  return limpo.split(/\s+/)[0]
}

/** Prefixo de identificação do atendente em mensagens de WhatsApp: "*Nome:*". */
export function prefixoAtendente(nome: string | null | undefined): string {
  const primeiro = primeiroNome(nome)
  return primeiro ? `*${primeiro}:*\n\n` : ''
}

/** Substitui os placeholders {{chave}} do template pelas variáveis fornecidas. */
export function applyTemplate(template: string, vars: TemplateVars): string {
  const dict = vars as unknown as Record<string, string>
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const v = dict[key]
    return v != null ? v : `{{${key}}}`
  })
}

/** Mensagem consolidada para cobrança de um grupo de títulos do mesmo cliente. */
export function buildMensagemGrupoWhatsApp(
  rows: Array<
    Pick<
      TemplateSource,
      'pessoa_nome' | 'cliente' | 'nro_titulo' | 'descricao' | 'valor' | 'data_vencimento' | 'dias_atraso'
    >
  >,
  usuario?: string | null,
  cargoUsuario?: string | null,
  nomeContatoOverride?: string | null,
): string {
  const nome = nomeContatoOverride?.trim() || rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente'
  const assinaturaUsuario = usuario?.trim() || 'Equipe Financeira'
  const total = rows.reduce((sum, r) => sum + Number(r.valor ?? 0), 0)
  const cargoAssinatura = cargoUsuario?.trim()

  const linhas = rows
    .map((r) => {
      const descricao = r.descricao?.trim() || 'Sem descrição'
      const vencimento = r.data_vencimento ? formatDate(r.data_vencimento) : '-'
      const valor = formatCurrency(Number(r.valor ?? 0))
      const atraso = Number(r.dias_atraso ?? 0)
      return [
        `• *${descricao}*`,
        `  Vencimento: ${vencimento}`,
        `  Valor: *${valor}*`,
        `  Atraso: ${atraso} dia(s)`,
      ].join('\n')
    })
    .join('\n')

  return [
    `Olá, ${nome}. Tudo bem?`,
    '',
    '*Identificamos os seguintes títulos em aberto:*',
    linhas,
    '',
    `*Total em aberto: ${formatCurrency(total)}*`,
    '',
    'Se já houver pagamento, por favor desconsidere esta mensagem e, se possível, compartilhe o comprovante.',
    '',
    '---',
    `*Atenciosamente,*`,
    `*${assinaturaUsuario}*`,
    ...(cargoAssinatura ? [`_${cargoAssinatura}_`] : []),
    `_Bismarchi | Pires Sociedade de Advogados_`,
  ].join('\n')
}
