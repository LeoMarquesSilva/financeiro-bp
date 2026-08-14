import { RECEITA_META_CONTRIBUICAO_AREA, RECEITA_DEPARTAMENTO_LABELS } from '../constants'
import type { RelatorioMensalDestinatario } from '../services/relatorioMensalService'

/** Área RH (colaboradores) → chave meta Receita. */
export const RH_AREA_TO_RECEITA_KEY: Record<string, string> = {
  Reestruturação: 'insolvencia',
  Trabalhista: 'trabalhista',
  Cível: 'civel',
  Contratos: 'contratos',
  'Recuperação de Crédito': 'recuperacao_de_credito',
}

export const LIDERANCA_GESTAO_VISTA = [
  { nome: 'Samuel Willian Silva', email: 'controladoria@bpplaw.com.br' },
  { nome: 'Gustavo Bismarchi', email: 'gustavo@bismarchipires.com.br' },
  { nome: 'Ricardo Viscardi Pires', email: 'ricardo@bismarchipires.com.br' },
  { nome: 'Felipe Camargo', email: 'felipe@bismarchipires.com.br' },
] as const

export type GerenteSugerido = {
  area_key: string
  nome: string
  email: string
}

/** Gerentes de área (RH colaboradores.nivel_hierarquico = gerente) — e-mails do cadastro Usuários. */
export const GERENTES_AREA_SUGERIDOS: GerenteSugerido[] = [
  {
    area_key: 'insolvencia',
    nome: 'Leonardo Loureiro Basso',
    email: 'leonardo@bismarchipires.com.br',
  },
  {
    area_key: 'trabalhista',
    nome: 'Daniel Pressatto Fernandes',
    email: 'daniel@bismarchipires.com.br',
  },
  {
    area_key: 'trabalhista',
    nome: 'Renato Vallim',
    email: 'renato@bismarchipires.com.br',
  },
  {
    area_key: 'civel',
    nome: 'Giancarlo Zotini',
    email: 'giancarlo@bismarchipires.com.br',
  },
  {
    area_key: 'contratos',
    nome: 'Wagner Armani',
    email: 'wagner.armani@bismarchipires.com.br',
  },
]

export function areaDestinatarioLabel(areaKey: string | null): string {
  if (!areaKey) return 'Escritório — todas as áreas (1 e-mail)'
  return RECEITA_DEPARTAMENTO_LABELS[areaKey] ?? areaKey
}

export function buildDestinatariosPadrao(): Array<
  Omit<RelatorioMensalDestinatario, 'created_at' | 'updated_at'>
> {
  const rows: Array<Omit<RelatorioMensalDestinatario, 'created_at' | 'updated_at'>> = []
  const seen = new Set<string>()

  const push = (nome: string, email: string, area_key: string) => {
    const key = `${email.trim().toLowerCase()}::${area_key}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      id: crypto.randomUUID(),
      nome,
      email: email.trim().toLowerCase(),
      area_key,
      ativo: true,
    })
  }

  for (const area of RECEITA_META_CONTRIBUICAO_AREA) {
    for (const l of LIDERANCA_GESTAO_VISTA) {
      push(l.nome, l.email, area.key)
    }
  }

  for (const g of GERENTES_AREA_SUGERIDOS) {
    push(g.nome, g.email, g.area_key)
  }

  return rows
}

export type DestinatariosPorArea = {
  area_key: string | null
  label: string
  items: RelatorioMensalDestinatario[]
}

export function groupDestinatariosPorArea(
  destinatarios: RelatorioMensalDestinatario[],
): DestinatariosPorArea[] {
  const ativos = destinatarios.filter((d) => d.ativo)
  const groups: DestinatariosPorArea[] = []

  const digest = ativos.filter((d) => !d.area_key)
  if (digest.length > 0) {
    groups.push({ area_key: null, label: areaDestinatarioLabel(null), items: digest })
  }

  for (const area of RECEITA_META_CONTRIBUICAO_AREA) {
    const items = ativos
      .filter((d) => d.area_key === area.key)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    groups.push({
      area_key: area.key,
      label: areaDestinatarioLabel(area.key),
      items,
    })
  }

  const outros = ativos.filter(
    (d) => d.area_key && !RECEITA_META_CONTRIBUICAO_AREA.some((a) => a.key === d.area_key),
  )
  if (outros.length > 0) {
    groups.push({ area_key: '__outros__', label: 'Outras áreas', items: outros })
  }

  return groups
}
