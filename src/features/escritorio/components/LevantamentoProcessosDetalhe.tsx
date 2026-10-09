import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import type {
  LevantamentoResumo,
  LevantamentoTipoVinculoQtd,
} from '../services/escritorioLevantamentoService'

const TIPO_ESTILO: Record<string, string> = {
  Principal: 'border-slate-200 bg-slate-50 text-slate-900',
  Recurso: 'border-amber-200 bg-amber-50 text-amber-900',
  Incidente: 'border-violet-200 bg-violet-50 text-violet-900',
}

function qtd(n: number): string {
  return n.toLocaleString('pt-BR')
}

function QuebraTipo({ row }: { row: LevantamentoTipoVinculoQtd }) {
  const partes = [
    { label: 'Princ.', value: row.principal },
    { label: 'Rec.', value: row.recurso },
    { label: 'Inc.', value: row.incidente },
  ]
  if (row.nao_classificado > 0) partes.push({ label: 'N/C', value: row.nao_classificado })
  return (
    <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
      {partes.map((p) => `${p.label} ${qtd(p.value)}`).join(' · ')}
    </p>
  )
}

export function LevantamentoProcessosDetalhe({ resumo }: { resumo: LevantamentoResumo }) {
  const total = resumo.processos_total
  const departamentos = resumo.processos_por_departamento
  const totalDep = departamentos.reduce(
    (acc, d) => ({
      qtd: acc.qtd + d.qtd,
      principal: acc.principal + d.principal,
      recurso: acc.recurso + d.recurso,
      incidente: acc.incidente + d.incidente,
      nao_classificado: acc.nao_classificado + d.nao_classificado,
    }),
    { qtd: 0, principal: 0, recurso: 0, incidente: 0, nao_classificado: 0 },
  )

  return (
    <section className="space-y-5 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Processos por situação</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Somente ativos · {qtd(total)} processos · Principal × Recurso × Incidente pelo vínculo
          VIOS ou, na falta dele, pelo tipo de ação
        </p>
      </div>

      {resumo.processos_por_tipo.length ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {resumo.processos_por_tipo.map((t) => (
            <div
              key={t.tipo}
              className={cn(
                'rounded-lg border px-3 py-2',
                TIPO_ESTILO[t.tipo] ?? 'border-slate-200 bg-white text-slate-700',
              )}
            >
              <p className="truncate text-xs font-medium opacity-80">{t.tipo}</p>
              <p className="text-lg font-semibold tabular-nums">{qtd(t.qtd)}</p>
              <p className="text-[11px] tabular-nums opacity-70">
                {formatPercent(total > 0 ? (t.qtd / total) * 100 : 0)} do estoque
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {resumo.processos_por_situacao.map((s) => (
          <div key={s.situacao} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="truncate text-xs text-slate-500" title={s.situacao}>
              {s.situacao}
            </p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{qtd(s.qtd)}</p>
            <QuebraTipo row={s} />
          </div>
        ))}
      </div>

      {departamentos.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Processos por departamento</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Recurso</TableHead>
                  <TableHead className="text-right">Incidente</TableHead>
                  <TableHead className="text-right">Não classificado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departamentos.map((d) => (
                  <TableRow key={d.departamento}>
                    <TableCell className="font-medium text-slate-800">{d.departamento}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{qtd(d.qtd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{qtd(d.principal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{qtd(d.recurso)}</TableCell>
                    <TableCell className="text-right tabular-nums">{qtd(d.incidente)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {qtd(d.nao_classificado)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-semibold hover:bg-slate-50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{qtd(totalDep.qtd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{qtd(totalDep.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{qtd(totalDep.recurso)}</TableCell>
                  <TableCell className="text-right tabular-nums">{qtd(totalDep.incidente)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {qtd(totalDep.nao_classificado)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  )
}
