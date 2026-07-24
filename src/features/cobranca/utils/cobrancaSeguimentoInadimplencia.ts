import { inadimplenciaService } from '@/features/inadimplencia/services/inadimplenciaService'
import type { InadimplenciaClasse } from '@/lib/database.types'
import type { CobrancaSeguimentoGrupoAcima60 } from '../types/cobrancaSeguimento.types'

type IncluirOptions = {
  createdBy?: string | null
  statusClasse?: InadimplenciaClasse
}

export async function incluirGrupoNoComiteInadimplencia(
  grupo: CobrancaSeguimentoGrupoAcima60,
  options?: IncluirOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const statusClasse = options?.statusClasse ?? 'C'
  const observacoes = `Incluído via Inadimplência Pontual · ${grupo.max_dias_atraso} dias de atraso · ${grupo.qtd_titulos} título(s).`

  const existenteResolvido = await inadimplenciaService.findResolvidoByGrupo(grupo.grupo_chave)
  if (existenteResolvido) {
    const { error: updateError } = await inadimplenciaService.update(existenteResolvido.id, {
      status_classe: statusClasse,
      valor_em_aberto: grupo.valor_total,
      observacoes_gerais: observacoes,
    })
    if (updateError) return { ok: false, error: updateError.message }

    const { error: reabrirError } = await inadimplenciaService.reabrir(
      existenteResolvido.id,
      options?.createdBy,
    )
    if (reabrirError) return { ok: false, error: reabrirError.message }
    return { ok: true }
  }

  const { error } = await inadimplenciaService.create({
    razao_social: grupo.grupo_chave,
    pessoa_id: grupo.pessoa_id_principal,
    valor_em_aberto: grupo.valor_total,
    status_classe: statusClasse,
    observacoes_gerais: observacoes,
    created_by: options?.createdBy ?? null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
