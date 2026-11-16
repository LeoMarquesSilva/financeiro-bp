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

const GRAPH_TENTATIVAS = 6
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * fetch com nova tentativa em erro de rede ("fetch failed") e em 429/5xx (só para GET e para o
 * token, que são idempotentes). Devolve a última resposta; quem chama trata status não-ok.
 */
async function fetchComRetry(url, init, rotulo) {
  let ultimoErro = null
  for (let tentativa = 1; tentativa <= GRAPH_TENTATIVAS; tentativa++) {
    const ultima = tentativa === GRAPH_TENTATIVAS
    let res
    try {
      res = await fetch(url, init)
    } catch (e) {
      ultimoErro = e
      if (ultima) break
      const causa = e?.cause ? ` (${e.cause.code ?? e.cause.message ?? e.cause})` : ''
      const espera = 2000 * 2 ** (tentativa - 1)
      console.warn(`[graph] ${rotulo}: ${e.message}${causa} — tentativa ${tentativa}/${GRAPH_TENTATIVAS}, nova em ${espera / 1000}s`)
      await sleep(espera)
      continue
    }
    if ((res.status === 429 || res.status >= 500) && !ultima) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const espera =
        res.status === 429
          ? (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 3) * 1000 * tentativa
          : 2000 * 2 ** (tentativa - 1)
      console.warn(`[graph] ${rotulo}: HTTP ${res.status} — tentativa ${tentativa}/${GRAPH_TENTATIVAS}, nova em ${espera / 1000}s`)
      await res.body?.cancel().catch(() => {})
      await sleep(espera)
      continue
    }
    return res
  }
  const causa = ultimoErro?.cause ? ` (${ultimoErro.cause.code ?? ultimoErro.cause.message ?? ultimoErro.cause})` : ''
  throw new Error(`${rotulo}: ${ultimoErro?.message ?? 'falhou'}${causa} (após ${GRAPH_TENTATIVAS} tentativas)`)
}

export async function getGraphToken() {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExp - 60_000) return cachedToken

  const tenant = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Faltam MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET no .env')
  }

  const res = await fetchComRetry(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
    'token Graph',
  )
  if (!res.ok) throw new Error(`Token Graph falhou: ${res.status} ${await res.text()}`)
  const json = await res.json()
  cachedToken = json.access_token
  cachedTokenExp = now + json.expires_in * 1000
  return cachedToken
}

async function graphGet(url) {
  const token = await getGraphToken()
  const res = await fetchComRetry(url, { headers: { Authorization: `Bearer ${token}` } }, `Graph GET ${url}`)
  if (!res.ok) throw new Error(`Graph GET ${url} falhou: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Resolve o siteId a partir do hostname + caminho (ex.: 'bpplaw2.sharepoint.com', '/sites/CONTROLADORIAJURDICA'). */
export async function getSiteId(hostname, sitePath) {
  const json = await graphGet(`${GRAPH}/sites/${hostname}:${sitePath}`)
  return json.id
}

function mapListItem(item) {
  return {
    ...item.fields,
    _CreatedByDisplayName: item.createdBy?.user?.displayName ?? null,
  }
}

/**
 * Busca itens de uma lista (com fields expandidos), seguindo @odata.nextLink.
 * @param {string} filter OData filter opcional. Em listas grandes (>5k) $filter/$orderby
 *   costuma falhar (400/422 — limiar de vista); use `createdSince` para não acumular tudo.
 * @param {string | null} fieldSelect Campos explícitos no $expand=fields($select=...).
 * @param {{ createdSince?: Date, skipAfterId?: number }} [opts]
 *   `createdSince` descarta itens mais antigos.
 *   `skipAfterId` inicia a paginação depois desse ID (skiptoken SharePoint; evita varrer 2023+).
 */
export async function fetchListItems(siteId, listId, filter = null, fieldSelect = null, opts = {}) {
  const items = []
  const createdSince = opts.createdSince instanceof Date ? opts.createdSince : null
  const filterQs = filter ? `&$filter=${encodeURIComponent(filter)}` : ''
  const expand = fieldSelect ? `fields($select=${fieldSelect})` : 'fields'
  const skipAfterId = Number(opts.skipAfterId)
  const skipQs =
    Number.isFinite(skipAfterId) && skipAfterId > 0
      ? `&$skiptoken=${Buffer.from(`Paged=TRUE&p_ID=${Math.floor(skipAfterId)}&ix_Paged=TRUE&ix_ID=${Math.floor(skipAfterId)}`).toString('base64')}`
      : ''
  let url = `${GRAPH}/sites/${siteId}/lists/${listId}/items?expand=${expand}&$top=500${filterQs}${skipQs}`
  let pages = 0
  let seen = 0
  while (url) {
    const json = await graphGet(url)
    const page = json.value ?? []
    seen += page.length
    pages += 1
    for (const item of page) {
      if (createdSince) {
        const created = item.createdDateTime ? new Date(item.createdDateTime) : null
        if (!created || created < createdSince) continue
      }
      items.push(mapListItem(item))
    }
    if (pages % 10 === 0) {
      console.log(
        `[graph] lista ${listId.slice(0, 8)}… p.${pages} lidos=${seen} na janela=${items.length}`,
      )
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
  const url = `${GRAPH}/sites/${siteId}/drive/root:/${encoded}:/content`
  const init = { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' }
  // A conexão pode cair no meio do corpo (CSV grande); aí o download inteiro recomeça.
  for (let tentativa = 1; ; tentativa++) {
    const res = await fetchComRetry(url, init, `Download ${filePath}`)
    if (!res.ok) throw new Error(`Download ${filePath} falhou: ${res.status} ${await res.text()}`)
    try {
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      if (tentativa >= 3) throw new Error(`Download ${filePath}: ${e.message} (corpo, após ${tentativa} tentativas)`)
      console.warn(`[graph] Download ${filePath}: corpo interrompido (${e.message}) — nova tentativa`)
      await sleep(3000 * tentativa)
    }
  }
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
