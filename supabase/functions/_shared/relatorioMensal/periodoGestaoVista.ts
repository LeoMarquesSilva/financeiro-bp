import { MESES_NOME } from './constants.ts'

export type PeriodoGestaoVista = {
  ano: number
  mes: number
  /** Último dia incluso no recorte parcial (ontem no fuso; 0 se ainda não há dia fechado no mês). */
  dia: number
  /** ISO YYYY-MM-DD — data de corte (ontem no fuso para mês parcial). */
  corteIso: string
  /** Ex.: "1 a 13 de agosto de 2026" */
  periodoLabel: string
  /** Ex.: "até 13/08/2026" */
  periodoCurto: string
  /** true quando o recorte é parcial (mês corrente até ontem). */
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

function buildParcialPeriodo(
  ano: number,
  mes: number,
  ontem: { ano: number; mes: number; dia: number },
): Pick<PeriodoGestaoVista, 'dia' | 'corteIso' | 'periodoLabel' | 'periodoCurto' | 'parcial'> {
  const mesNome = MESES_NOME[mes - 1] ?? String(mes)
  const corteIso = toIso(ontem)
  const mesmoMes = ontem.ano === ano && ontem.mes === mes
  const dia = mesmoMes ? ontem.dia : 0

  if (dia > 0) {
    return {
      dia,
      corteIso,
      periodoLabel: `1 a ${dia} de ${mesNome.toLowerCase()} de ${ano}`,
      periodoCurto: `até ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`,
      parcial: true,
    }
  }

  return {
    dia: 0,
    corteIso,
    periodoLabel: `Aguardando 1º dia completo · ${mesNome} de ${ano}`,
    periodoCurto: `sem recorte · ${mesNome}/${ano}`,
    parcial: true,
  }
}

/** Recorte gestão à vista: mês corrente do dia 1 até ontem (fuso configurado). */
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
      return { ano, mes, ...buildParcialPeriodo(ano, mes, ontem) }
    }

    const mesNome = MESES_NOME[mes - 1] ?? String(mes)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const corteIso = toIso({ ano, mes, dia: ultimoDia })
    return {
      ano,
      mes,
      dia: ultimoDia,
      corteIso,
      periodoLabel: `${mesNome} de ${ano} (mês fechado)`,
      periodoCurto: `${mesNome}/${ano}`,
      parcial: false,
    }
  }

  return {
    ano: hoje.ano,
    mes: hoje.mes,
    ...buildParcialPeriodo(hoje.ano, hoje.mes, ontem),
  }
}
