import { supabase } from '@/lib/supabaseClient'
import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { normalizarNomeGrupo } from '@/features/escritorio/services/escritorioService'
import {
  montarTotaisSaldoDevedor,
  type CarteiraSaldoDevedor,
  type ClassificacaoSaldoDevedor,
  type ClienteSaldoDevedor,
  type EvolucaoSaldoDevedorData,
} from '../utils/saldoDevedor'

const CLASSIFICACOES: ClassificacaoSaldoDevedor[] = [
  'sem_perspectiva',
  'pagamento_parcial',
  'atraso_pontual',
  'corrente_em_dia',
]

const CARTEIRAS: CarteiraSaldoDevedor[] = ['pontual', 'recorrente', 'judicializada']

function parseClassificacao(raw: string): ClassificacaoSaldoDevedor {
  return CLASSIFICACOES.includes(raw as ClassificacaoSaldoDevedor)
    ? (raw as ClassificacaoSaldoDevedor)
    : 'sem_perspectiva'
}

function parseCarteira(raw: string): CarteiraSaldoDevedor {
  return CARTEIRAS.includes(raw as CarteiraSaldoDevedor)
    ? (raw as CarteiraSaldoDevedor)
    : 'recorrente'
}

export type SaldoDevedorTituloRow = {
  cliente: string
  nro_titulo: string
  data_vencimento: string | null
  situacao_titulo: string | null
  valor_item: number
  valor_parcial_aberto: number | null
  valor_pago_item: number | null
  data_pagamento: string | null
  saldo_vivo: number
  eh_saldo_parcial_vios: boolean
}

export async function fetchSaldoDevedorTitulosGrupo(
  grupoCliente: string,
  ano: number,
  mesFim: number,
): Promise<SaldoDevedorTituloRow[]> {
  const { data, error } = await supabase.rpc(
    'inadimplencia_saldo_devedor_titulos_grupo' as never,
    {
      p_grupo_cliente: grupoCliente,
      p_ano: ano,
      p_mes_fim: mesFim,
    } as never,
  )
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    cliente: String(row.cliente ?? ''),
    nro_titulo: String(row.nro_titulo ?? ''),
    data_vencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
    situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    valor_item: Number(row.valor_item) || 0,
    valor_parcial_aberto:
      row.valor_parcial_aberto != null ? Number(row.valor_parcial_aberto) : null,
    valor_pago_item: row.valor_pago_item != null ? Number(row.valor_pago_item) : null,
    data_pagamento: row.data_pagamento != null ? String(row.data_pagamento) : null,
    saldo_vivo: Number(row.saldo_vivo) || 0,
    eh_saldo_parcial_vios: row.eh_saldo_parcial_vios === true,
  }))
}

export async function fetchEvolucaoSaldoDevedor(
  ref = new Date(),
): Promise<EvolucaoSaldoDevedorData> {
  const ano = ref.getFullYear()
  const anoAnterior = ano - 1
  const mesFim = mesMaxDisponivelInadimplencia(ano, ref) || 1

  const { data, error } = await supabase.rpc(
    'inadimplencia_evolucao_saldo_devedor' as never,
    { p_ano: ano, p_mes_fim: mesFim } as never,
  )
  if (error) throw error

  const clientes: ClienteSaldoDevedor[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const nome = String(row.grupo_cliente ?? '').trim()
      return {
        grupoNorm: normalizarNomeGrupo(nome),
        nome,
        carteira: parseCarteira(String(row.carteira ?? 'recorrente')),
        classificacao: parseClassificacao(String(row.classificacao ?? '')),
        saldoAnterior: Number(row.saldo_anterior) || 0,
        geradoAno: Number(row.gerado_ano) || 0,
        acumulado: Number(row.acumulado) || 0,
      }
    })
    .filter((c) => c.grupoNorm && c.acumulado > 0.5)

  return {
    ano,
    anoAnterior,
    mesInicio: 1,
    mesFim,
    clientes,
    totais: montarTotaisSaldoDevedor(clientes),
  }
}
