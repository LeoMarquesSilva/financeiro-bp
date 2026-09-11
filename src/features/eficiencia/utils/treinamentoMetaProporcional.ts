import { EFICIENCIA_META_TREINAMENTO_MINUTOS } from '../constants'

export type TurnoverVigenciaRow = {
  admissao?: string | null
  desligamento?: string | null
  tipo_desligamento?: string | null
}

export function isTurnoverTransferencia(tipo: string | null | undefined): boolean {
  return String(tipo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR') === 'TRANSFERENCIA'
}

function isoDate(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 10)
}

function ativoNoAno(row: TurnoverVigenciaRow, ano: number): boolean {
  const adm = isoDate(row.admissao)
  if (!adm || Number(adm.slice(0, 4)) > ano) return false
  const desl = isoDate(row.desligamento)
  return !desl || Number(desl.slice(0, 4)) > ano
}

/**
 * Admissão para meta de treinamento: primeira entrada do vínculo atual.
 * Transferência de setor não conta como nova admissão.
 */
export function admissaoCasaTreinamento(
  rows: TurnoverVigenciaRow[],
  ano: number,
): string | null {
  const atuais = rows.filter((row) => ativoNoAno(row, ano) && isoDate(row.admissao))
  if (atuais.length === 0) return null
  const admissoes = atuais.map((row) => isoDate(row.admissao)).sort()
  const admissaoSetor = admissoes[admissoes.length - 1]
  if (!admissaoSetor) return null

  let saidaReal: string | null = null
  for (const row of rows) {
    const desl = isoDate(row.desligamento)
    if (!desl || desl >= admissaoSetor) continue
    if (isTurnoverTransferencia(row.tipo_desligamento)) continue
    if (!saidaReal || desl > saidaReal) saidaReal = desl
  }

  let primeira: string | null = null
  for (const row of rows) {
    const adm = isoDate(row.admissao)
    if (!adm || adm > admissaoSetor) continue
    if (saidaReal && adm <= saidaReal) continue
    if (!primeira || adm < primeira) primeira = adm
  }
  return primeira ?? admissaoSetor
}

/**
 * Meses elegíveis de treinamento no ano-calendário.
 * - Admitido em ano anterior: 12
 * - Admitido no ano: a partir do mês da admissão; se dia > 15, mês seguinte
 * - Admitido após o ano: 0
 */
export function mesesElegiveisTreinamento(
  admissao: string | Date | null | undefined,
  ano: number,
): number {
  if (admissao == null || admissao === '') return 12
  const iso =
    typeof admissao === 'string'
      ? admissao.slice(0, 10)
      : admissao.toISOString().slice(0, 10)
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 12
  if (y < ano) return 12
  if (y > ano) return 0
  const primeiroMes = d > 15 ? m + 1 : m
  if (primeiroMes > 12) return 0
  return 12 - primeiroMes + 1
}

/** Meta individual em minutos: 14h × meses_elegíveis / 12. */
export function metaTreinamentoMinutosProporcional(
  admissao: string | Date | null | undefined,
  ano: number,
): number {
  const meses = mesesElegiveisTreinamento(admissao, ano)
  return Math.round(((EFICIENCIA_META_TREINAMENTO_MINUTOS * meses) / 12) * 100) / 100
}
