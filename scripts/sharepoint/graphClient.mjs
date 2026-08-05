/**
 * Cliente Microsoft Graph (client credentials) para leitura de SharePoint Lists
 * e download de arquivos em bibliotecas de documentos.
 *
 * Requer no .env / .env.local:
 *   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
 * App registration com permissões application-level: Sites.Read.All, Files.Read.All
 * (ver scripts/README_SHAREPOINT_SYNC.md).
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'

let cachedToken = null
let cachedTokenExp = 0

export async function getGraphToken() {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExp - 60_000) return cachedToken

  const tenant = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Faltam MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET no .env')
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Token Graph falhou: ${res.status} ${await res.text()}`)
  const json = await res.json()
  cachedToken = json.access_token
  cachedTokenExp = now + json.expires_in * 1000
  return cachedToken
}

async function graphGet(url) {
  const token = await getGraphToken()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Graph GET ${url} falhou: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Resolve o siteId a partir do hostname + caminho (ex.: 'bpplaw2.sharepoint.com', '/sites/CONTROLADORIAJURDICA'). */
export async function getSiteId(hostname, sitePath) {
  const json = await graphGet(`${GRAPH}/sites/${hostname}:${sitePath}`)
  return json.id
}

/**
 * Busca todos os itens de uma lista (com fields expandidos), seguindo @odata.nextLink.
 * @param {string} filter OData filter opcional sobre campos do item (ex.: "createdDateTime ge 2025-01-01T00:00:00Z").
 *   Usa metadados do sistema (createdDateTime), que são sempre indexados — seguro mesmo em listas grandes.
 * @param {string | null} fieldSelect Campos explícitos no $expand=fields($select=...).
 *   Necessário para colunas Pessoa (ex.: Colaborador) — o expand genérico só traz *LookupId.
 */
export async function fetchListItems(siteId, listId, filter = null, fieldSelect = null) {
  const items = []
  const filterQs = filter ? `&$filter=${encodeURIComponent(filter)}` : ''
  const expand = fieldSelect ? `fields($select=${fieldSelect})` : 'fields'
  let url = `${GRAPH}/sites/${siteId}/lists/${listId}/items?expand=${expand}&$top=500${filterQs}`
  while (url) {
    const json = await graphGet(url)
    for (const item of json.value ?? []) {
      // Campos "Pessoa" genéricos só trazem LookupId; inclua o nome no fieldSelect quando precisar.
      // O metadado createdBy do próprio item já vem resolvido (nome + email) sem custo extra.
      items.push({ ...item.fields, _CreatedByDisplayName: item.createdBy?.user?.displayName ?? null })
    }
    url = json['@odata.nextLink'] ?? null
  }
  return items
}

/**
 * Baixa um arquivo de biblioteca de documentos pelo caminho relativo ao drive raiz do site.
 * Ex.: fetchDriveFile(siteId, 'Núcleo de Cadastro/Bases Atualizacoes/Tarefas.csv')
 * Retorna Buffer.
 */
export async function fetchDriveFile(siteId, filePath) {
  const token = await getGraphToken()
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(`${GRAPH}/sites/${siteId}/drive/root:/${encoded}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Download ${filePath} falhou: ${res.status} ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Lista arquivos de uma pasta do drive do site (para combinar Historico/*.csv). */
export async function listDriveFolder(siteId, folderPath) {
  const encoded = folderPath.split('/').map(encodeURIComponent).join('/')
  const json = await graphGet(`${GRAPH}/sites/${siteId}/drive/root:/${encoded}:/children?$top=500`)
  return (json.value ?? []).map((f) => ({ name: f.name, path: `${folderPath}/${f.name}` }))
}

/** Expande campo User/UserMulti do SharePoint para string de nomes separados por vírgula. */
export function expandUserField(value) {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'object' ? v.title ?? v.LookupValue ?? v.displayName ?? '' : String(v)))
      .filter(Boolean)
      .join(', ') || null
  }
  if (typeof value === 'object') return value.title ?? value.LookupValue ?? value.displayName ?? null
  return String(value)
}
