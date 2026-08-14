import { MESES_NOME } from './constants.ts'

export type PeriodoGestaoVista = {
  ano: number
  mes: number
  /** Dia corrente no fuso configurado (último dia incluso nos dados). */
  dia: number
  /** Ex.: "1 a 14 de agosto de 2026" */
  periodoLabel: string
  /** Ex.: "até 14/08/2026" */
  periodoCurto: string
  /** true quando o recorte é parcial (mês corrente até hoje). */
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

/** Recorte gestão à vista: mês corrente do dia 1 até a data de referência (hoje no fuso). */
export function resolverPeriodoGestaoVista(
  timezone = 'America/Sao_Paulo',
  ref = new Date(),
  override?: { ano?: number; mes?: number },
): PeriodoGestaoVista {
  const hoje = partesDataTimezone(timezone, ref)

  if (override?.ano != null && override?.mes != null) {
    const ano = override.ano
    const mes = override.mes
    const mesNome = MESES_NOME[mes - 1] ?? String(mes)

    if (ano === hoje.ano && mes === hoje.mes) {
      return {
        ano,
        mes,
        dia: hoje.dia,
        periodoLabel: `1 a ${hoje.dia} de ${mesNome.toLowerCase()} de ${ano}`,
        periodoCurto: `até ${String(hoje.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`,
        parcial: true,
      }
    }

    const ultimoDia = new Date(ano, mes, 0).getDate()
    return {
      ano,
      mes,
      dia: ultimoDia,
      periodoLabel: `${mesNome} de ${ano} (mês fechado)`,
      periodoCurto: `${mesNome}/${ano}`,
      parcial: false,
    }
  }

  const mesNome = MESES_NOME[hoje.mes - 1] ?? String(hoje.mes)
  return {
    ano: hoje.ano,
    mes: hoje.mes,
    dia: hoje.dia,
    periodoLabel: `1 a ${hoje.dia} de ${mesNome.toLowerCase()} de ${hoje.ano}`,
    periodoCurto: `até ${String(hoje.dia).padStart(2, '0')}/${String(hoje.mes).padStart(2, '0')}/${hoje.ano}`,
    parcial: true,
  }
}
