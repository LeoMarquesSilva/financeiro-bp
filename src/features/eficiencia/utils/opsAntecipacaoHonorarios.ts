/**
 * Antecipação de Faturamento de Honorários (BI AntecipacaoHonorarios).
 *
 * Dentro do prazo quando:
 * - data_conclusao <= data_limite, ou
 * - prazo estimado (data_para_conclusao) cai no mês anterior ao da conclusão
 *   (faturamento do mês anterior realizado no início do mês seguinte).
 */

function isoDate(value: unknown): string {
  return String(value ?? '').slice(0, 10)
}

function isoMonth(value: unknown): string {
  return isoDate(value).slice(0, 7)
}

export function antecipacaoHonorariosDentroPrazo(
  dataConclusao: unknown,
  dataLimite: unknown,
  dataParaConclusao: unknown,
): boolean {
  const conclusao = isoDate(dataConclusao)
  if (!conclusao) return false

  const limite = isoDate(dataLimite)
  if (limite && conclusao <= limite) return true

  const mesPara = isoMonth(dataParaConclusao)
  const mesConclusao = isoMonth(conclusao)
  if (!mesPara || !mesConclusao) return false

  return mesPara < mesConclusao
}

export function antecipacaoHonorariosStatusLabel(
  dataConclusao: unknown,
  dataLimite: unknown,
  dataParaConclusao: unknown,
): 'Dentro do prazo' | 'Fora do prazo' {
  return antecipacaoHonorariosDentroPrazo(dataConclusao, dataLimite, dataParaConclusao)
    ? 'Dentro do prazo'
    : 'Fora do prazo'
}
