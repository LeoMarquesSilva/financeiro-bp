import { MESES_NOME } from './constants.ts'

export type PeriodoGestaoVista = {
  ano: number
  mes: number
  /** Último dia incluso no recorte (ontem; no dia 1 do mês, hoje). */
  dia: number
  /** ISO YYYY-MM-DD — corte do caixa/recebido. */
  corteIso: string
  /**
   * ISO YYYY-MM-DD — corte de inadimplência (sempre ontem: vencimento = hoje ainda não é vencido).
   * No dia 1 pode ser o último dia do mês anterior.
   */
  corteInadIso: string
  /** Ex.: "1 a 13 de agosto de 2026" */
  periodoLabel: string
  /** Ex.: "até 13/08/2026" */
  periodoCurto: string
  /** true quando o recorte é parcial (mês corrente). */
  parcial: boolean
}

function partesDataTimezone(timezone: string, ref: Date): { ano: number; mes: number; dia: number } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
  const [ano, mes, dia] = iso.split('-').map(Number)
  return { ano, mes, dia }
}

function partesOntemTimezone(timezone: string, ref: Date): { ano: number; mes: number; dia: number } {
  const ontemRef = new Date(ref.getTime() - 86_400_000)
  return partesDataTimezone(timezone, ontemRef)
}

function toIso(parts: { ano: number; mes: number; dia: number }): string {
  return `${parts.ano}-${String(parts.mes).padStart(2, '0')}-${String(parts.dia).padStart(2, '0')}`
}

function labelDiaMesAno(
  dia: number,
  mes: number,
  ano: number,
): { periodoLabel: string; periodoCurto: string } {
  const mesNome = MESES_NOME[mes - 1] ?? String(mes)
  const dd = String(dia).padStart(2, '0')
  const mm = String(mes).padStart(2, '0')
  if (dia === 1) {
    return {
      periodoLabel: `1 de ${mesNome.toLowerCase()} de ${ano} (posição atual)`,
      periodoCurto: `até ${dd}/${mm}/${ano}`,
    }
  }
  return {
    periodoLabel: `1 a ${dia} de ${mesNome.toLowerCase()} de ${ano}`,
    periodoCurto: `até ${dd}/${mm}/${ano}`,
  }
}

function buildParcialPeriodo(
  ano: number,
  mes: number,
  hoje: { ano: number; mes: number; dia: number },
  ontem: { ano: number; mes: number; dia: number },
): Pick<
  PeriodoGestaoVista,
  'dia' | 'corteIso' | 'corteInadIso' | 'periodoLabel' | 'periodoCurto' | 'parcial'
> {
  const mesmoMesOntem = ontem.ano === ano && ontem.mes === mes

  if (mesmoMesOntem) {
    const labels = labelDiaMesAno(ontem.dia, mes, ano)
    return {
      dia: ontem.dia,
      corteIso: toIso(ontem),
      corteInadIso: toIso(ontem),
      ...labels,
      parcial: true,
    }
  }

  // Dia 1: ontem é outro mês. Caixa de hoje entra (ex.: R$ 17 mil em 01/set);
  // inad continua com corte = ontem (hoje ainda não é vencido).
  const labels = labelDiaMesAno(hoje.dia, mes, ano)
  return {
    dia: hoje.dia,
    corteIso: toIso(hoje),
    corteInadIso: toIso(ontem),
    ...labels,
    parcial: true,
  }
}

/** Recorte gestão à vista: mês corrente, posição atual (caixa até o corte; inad até ontem). */
export function resolverPeriodoGestaoVista(
  timezone = 'America/Sao_Paulo',
  ref = new Date(),
  override?: { ano?: number; mes?: number },
): PeriodoGestaoVista {
  const hoje = partesDataTimezone(timezone, ref)
  const ontem = partesOntemTimezone(timezone, ref)

  if (override?.ano != null && override?.mes != null) {
    const ano = override.ano
    const mes = override.mes

    if (ano === hoje.ano && mes === hoje.mes) {
      return { ano, mes, ...buildParcialPeriodo(ano, mes, hoje, ontem) }
    }

    const mesNome = MESES_NOME[mes - 1] ?? String(mes)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const corteIso = toIso({ ano, mes, dia: ultimoDia })
    return {
      ano,
      mes,
      dia: ultimoDia,
      corteIso,
      corteInadIso: corteIso,
      periodoLabel: `${mesNome} de ${ano} (mês fechado)`,
      periodoCurto: `${mesNome}/${ano}`,
      parcial: false,
    }
  }

  return {
    ano: hoje.ano,
    mes: hoje.mes,
    ...buildParcialPeriodo(hoje.ano, hoje.mes, hoje, ontem),
  }
}
