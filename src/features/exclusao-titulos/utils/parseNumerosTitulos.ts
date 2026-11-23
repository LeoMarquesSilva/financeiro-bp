/** Maior faixa aceita em "13412 a 13419" (evita buscar milhares de títulos por engano). */
export const MAX_FAIXA_TITULOS = 200

export type ParseNumerosTitulos = {
  /** Números a buscar: "13412" (todas as parcelas) ou "11742-1" (exato). */
  numeros: string[]
  avisos: string[]
}

/**
 * Lê o texto colado pela pessoa e tira os números de título.
 *
 * Aceita a mensagem do jeito que ela escreve, por exemplo:
 * "13412 a 13419 ... (vencimentos novembro/26 a junho/2027)"
 * "título 16256 em nome da Lira, no valor de R$ 616,32, vencimento 05/11"
 * "11742-1 · venc. 18/10/2026 - Americar"
 *
 * Datas (05/11, 18/10/2026) e valores (R$ 616,32) são ignorados.
 * Faixas: "a", "até", "ao" ou "..". O hífen é sempre a parcela ("11742-1"), nunca faixa.
 */
export function parseNumerosTitulos(texto: string): ParseNumerosTitulos {
  const avisos: string[] = []
  const numeros = new Set<string>()

  let resto = ` ${texto} `
    // datas: 05/11, 18/10/2026, novembro/26
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/[a-zç]+\/\d{2,4}\b/gi, ' ')
    // valores: R$ 616,32 / 1.234,56 / 616,32
    .replace(/R\$\s*[\d.]+(?:,\d{1,2})?/gi, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b/g, ' ')
    .replace(/\b\d+,\d{1,2}\b/g, ' ')

  const faixa = /\b(\d{4,})(?:-\d{1,3})?\s*(?:a|até|ate|ao|\.\.)\s*(\d{4,})(?:-\d{1,3})?\b/gi
  resto = resto.replace(faixa, (_m, de: string, ate: string) => {
    const ini = Number(de)
    const fim = Number(ate)
    if (fim < ini) {
      avisos.push(`Faixa invertida ignorada: ${de} a ${ate}`)
    } else if (fim - ini + 1 > MAX_FAIXA_TITULOS) {
      avisos.push(`Faixa grande demais ignorada (${de} a ${ate}). Máximo: ${MAX_FAIXA_TITULOS} títulos.`)
    } else {
      for (let n = ini; n <= fim; n++) numeros.add(String(n))
    }
    return ' '
  })

  for (const m of resto.matchAll(/\b(\d{4,})(-\d{1,3})?\b/g)) {
    numeros.add(m[2] ? `${m[1]}${m[2]}` : m[1]!)
  }

  return { numeros: [...numeros], avisos }
}

/** True se o título (nro_titulo "13412-1") atende ao número pedido ("13412" ou "13412-1"). */
export function tituloAtendeNumero(nroTitulo: string, numero: string): boolean {
  if (numero.includes('-')) return nroTitulo === numero
  return nroTitulo === numero || nroTitulo.split('-')[0] === numero
}
