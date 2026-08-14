import type { RelatorioDestinatario } from './fetchData.ts'

export type GrupoDestinatariosEnvio = {
  area_key: string | null
  destinatarios: RelatorioDestinatario[]
}

/** Uma mensagem por área meta — todos os cadastrados no Para. */
export function groupDestinatariosForEnvio(
  destinatarios: RelatorioDestinatario[],
): GrupoDestinatariosEnvio[] {
  const byArea = new Map<string | null, RelatorioDestinatario[]>()

  for (const d of destinatarios) {
    const key = d.area_key ?? null
    const list = byArea.get(key) ?? []
    list.push(d)
    byArea.set(key, list)
  }

  return [...byArea.entries()].map(([area_key, destinatariosGrupo]) => ({
    area_key,
    destinatarios: destinatariosGrupo,
  }))
}

export function uniqueEmailsFromGrupo(
  destinatarios: RelatorioDestinatario[],
  emailRegex: RegExp,
): { validos: string[]; invalidos: RelatorioDestinatario[] } {
  const validos: string[] = []
  const seen = new Set<string>()
  const invalidos: RelatorioDestinatario[] = []

  for (const d of destinatarios) {
    const email = d.email.trim().toLowerCase()
    if (!emailRegex.test(email)) {
      invalidos.push(d)
      continue
    }
    if (seen.has(email)) continue
    seen.add(email)
    validos.push(email)
  }

  return { validos, invalidos }
}
