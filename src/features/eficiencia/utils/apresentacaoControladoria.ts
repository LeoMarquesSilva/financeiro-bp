import { MESES_NOME } from '@/features/receita/constants'
import { supabase } from '@/lib/supabaseClient'
import { eficienciaService } from '../services/eficienciaService'
import type { OpsLegaisResponsumDashboard } from '../types/eficiencia.types'
import {
  fetchClientesInativosAno,
  type ClientesInativosAno,
} from './apresentacaoClientesInativos'

export type ControladoriaMesRow = {
  mes: number
  mesLabel: string
  publicacoes: number
  pastas_cadastradas: number
  protocolos: number
  novos_clientes: number
  clientes_inativados: number
}

export type ApresentacaoControladoriaData = {
  ano: number
  mensal: ControladoriaMesRow[]
  /** Meses com algum movimento (para tabelas do slide). */
  mensalAtivo: ControladoriaMesRow[]
  totais: {
    publicacoes: number
    pastas_cadastradas: number
    protocolos: number
    novos_clientes: number
    clientes_inativados: number
    chamados_responsum: number | null
  }
  clientesInativos: ClientesInativosAno | null
  clientesInativosError: string | null
  responsum: OpsLegaisResponsumDashboard | null
  responsumError: string | null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function fetchApresentacaoControladoria(
  ano: number,
): Promise<ApresentacaoControladoriaData> {
  const { data, error } = await supabase.rpc(
    'eficiencia_apresentacao_controladoria' as never,
    { p_ano: ano } as never,
  )
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  const totaisRaw = (raw.totais ?? {}) as Record<string, unknown>
  const mensalRaw = Array.isArray(raw.mensal) ? raw.mensal : []

  let responsum: OpsLegaisResponsumDashboard | null = null
  let responsumError: string | null = null
  let chamados: number | null = null
  let clientesInativos: ClientesInativosAno | null = null
  let clientesInativosError: string | null = null

  const [responsumResult, inativosResult] = await Promise.allSettled([
    eficienciaService.fetchOpsLegaisResponsum(ano, null),
    fetchClientesInativosAno(ano),
  ])

  if (responsumResult.status === 'fulfilled') {
    responsum = responsumResult.value
    chamados = responsum.tickets.resolvidos
  } else {
    responsumError =
      responsumResult.reason instanceof Error
        ? responsumResult.reason.message
        : 'Falha ao carregar Responsum'
  }

  if (inativosResult.status === 'fulfilled') {
    clientesInativos = inativosResult.value
  } else {
    clientesInativosError =
      inativosResult.reason instanceof Error
        ? inativosResult.reason.message
        : 'Falha ao carregar clientes inativos'
  }

  const inativosByMes = new Map(
    (clientesInativos?.mensal ?? []).map((m) => [m.mes, m.qtd] as const),
  )

  const mensal: ControladoriaMesRow[] = mensalRaw.map((row) => {
    const o = row as Record<string, unknown>
    const mes = num(o.mes)
    return {
      mes,
      mesLabel: MESES_NOME[mes - 1] ?? String(mes),
      publicacoes: num(o.publicacoes),
      pastas_cadastradas: num(o.pastas_cadastradas),
      protocolos: num(o.protocolos),
      novos_clientes: num(o.novos_clientes),
      clientes_inativados: inativosByMes.get(mes) ?? 0,
    }
  })

  const mensalAtivo = mensal.filter(
    (m) =>
      m.publicacoes > 0 ||
      m.pastas_cadastradas > 0 ||
      m.protocolos > 0 ||
      m.novos_clientes > 0 ||
      m.clientes_inativados > 0,
  )

  return {
    ano: num(raw.ano) || ano,
    mensal,
    mensalAtivo: mensalAtivo.length > 0 ? mensalAtivo : mensal.slice(0, 6),
    totais: {
      publicacoes: num(totaisRaw.publicacoes),
      pastas_cadastradas: num(totaisRaw.pastas_cadastradas),
      protocolos: num(totaisRaw.protocolos),
      novos_clientes: num(totaisRaw.novos_clientes),
      clientes_inativados: clientesInativos?.total ?? 0,
      chamados_responsum: chamados,
    },
    clientesInativos,
    clientesInativosError,
    responsum,
    responsumError,
  }
}
