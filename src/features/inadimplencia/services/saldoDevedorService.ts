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
