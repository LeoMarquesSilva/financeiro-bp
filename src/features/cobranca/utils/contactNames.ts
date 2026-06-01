/** Nomes genéricos do escritório / instância WhatsApp — não são contatos de clientes. */
export function isInternalContactName(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  const n = raw.toLowerCase()

  if (n.includes('financeiro bp') || n.includes('selores')) return true
  if (n.includes('comitê de inadimplência') || n.includes('comite de inadimplencia')) return true

  const isEscritorio =
    n.includes('bismarchi') &&
    (n.includes('pires') || n.includes('sociedade') || n.includes('advogados') || n.includes('financeiro'))

  return isEscritorio
}

/** Escolhe o melhor rótulo entre nome da pessoa e razão social. */
export function pickContactLabel(
  pessoaNome: string | null | undefined,
  cliente: string | null | undefined,
  grupoCliente?: string | null,
): string | null {
  const candidatos = [pessoaNome, cliente, grupoCliente]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .filter((v) => !isInternalContactName(v))

  return candidatos[0] ?? null
}
