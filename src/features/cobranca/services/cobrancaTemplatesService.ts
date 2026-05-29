import { supabase } from '@/lib/supabaseClient'

export interface CobrancaTemplates {
  whatsapp: string
  emailAssunto: string
  emailCorpo: string
}

const KEY_WHATSAPP = 'cobranca_template_whatsapp'
const KEY_EMAIL_ASSUNTO = 'cobranca_template_email_assunto'
const KEY_EMAIL_CORPO = 'cobranca_template_email_corpo'

export const DEFAULT_TEMPLATES: CobrancaTemplates = {
  whatsapp:
    'Olá, {{nome}}\n\nNão identificamos o pagamento do honorário referente aos serviços advocatícios no valor de {{valor}}, com vencimento em {{vencimento}}.\n\nCaso já tenha realizado o pagamento, peço que nos encaminhe o respectivo comprovante para identificação.\n\nAtenciosamente, Bismarchi Pires Advogados.\n\n{{usuario}}',
  emailAssunto: 'Cobrança - Título {{titulo}} vencido em {{vencimento}}',
  emailCorpo:
    'Prezado(a) {{nome}},\n\nIdentificamos em nosso sistema o título {{titulo}} ({{descricao}}), no valor de {{valor}}, com vencimento em {{vencimento}}, atualmente com {{dias_atraso}} dia(s) em atraso.\n\nSolicitamos a regularização do pagamento. Caso já tenha efetuado, por favor desconsidere este e-mail.\n\nAtenciosamente,\nBismarchi Pires Advogados',
}

function asText(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  return fallback
}

export const cobrancaTemplatesService = {
  async get(): Promise<CobrancaTemplates> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [KEY_WHATSAPP, KEY_EMAIL_ASSUNTO, KEY_EMAIL_CORPO])

    if (error || !data) return { ...DEFAULT_TEMPLATES }

    const map = new Map(data.map((r) => [(r as { key: string }).key, (r as { value: unknown }).value]))
    return {
      whatsapp: asText(map.get(KEY_WHATSAPP), DEFAULT_TEMPLATES.whatsapp),
      emailAssunto: asText(map.get(KEY_EMAIL_ASSUNTO), DEFAULT_TEMPLATES.emailAssunto),
      emailCorpo: asText(map.get(KEY_EMAIL_CORPO), DEFAULT_TEMPLATES.emailCorpo),
    }
  },

  async save(templates: CobrancaTemplates): Promise<void> {
    const rows = [
      { key: KEY_WHATSAPP, value: templates.whatsapp },
      { key: KEY_EMAIL_ASSUNTO, value: templates.emailAssunto },
      { key: KEY_EMAIL_CORPO, value: templates.emailCorpo },
    ]
    const { error } = await supabase
      .from('app_settings')
      .upsert(rows as never, { onConflict: 'key' })
    if (error) throw error
  },
}
