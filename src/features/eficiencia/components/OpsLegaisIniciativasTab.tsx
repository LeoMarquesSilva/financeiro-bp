import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const FORJAI_SYMBOL_SRC = '/brand/forjai-symbol.webp'
export const FORJAI_PIPELINE_URL = 'https://forjai.vercel.app/pipeline'

export function ForjaiSymbol({
  className,
  alt = 'Forjai',
}: {
  className?: string
  alt?: string
}) {
  return <img src={FORJAI_SYMBOL_SRC} alt={alt} className={className} />
}

/** ClickUp parou de ser atualizado — a aba fica em estado de migração até o Forjai. */
export function OpsLegaisIniciativasTab() {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-rose-200/70 bg-[linear-gradient(165deg,#fff8f5_0%,#fff_42%,#fef2f2_100%)] shadow-sm"
      aria-labelledby="iniciativas-migracao-titulo"
    >
      <div
        className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-rose-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-red-700/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-900 via-rose-600 to-red-800"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center sm:px-10 sm:py-20">
        <div className="relative mb-8">
          <div
            className="absolute inset-0 scale-125 animate-pulse rounded-full bg-rose-400/25 blur-2xl"
            aria-hidden
          />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border border-rose-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(127,29,29,0.35)] ring-1 ring-red-900/5 sm:h-32 sm:w-32">
            <ForjaiSymbol className="h-[4.5rem] w-[4.5rem] object-contain sm:h-20 sm:w-20" />
          </div>
        </div>

        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-800 shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
          </span>
          Em migração
        </p>

        <h2
          id="iniciativas-migracao-titulo"
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
        >
          Em migração para o Forjai
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
          O ClickUp desta aba deixou de ser atualizado. Projetos e melhorias passam a ser
          acompanhados no Forjai — o painel do SIOE volta quando a nova fonte estiver ligada.
        </p>

        <Button
          asChild
          size="lg"
          className="mt-7 h-11 rounded-full bg-red-800 px-6 text-white shadow-md hover:bg-red-900"
        >
          <a href={FORJAI_PIPELINE_URL} target="_blank" rel="noreferrer">
            Abrir o Forjai
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>

        <ol className="mt-10 grid w-full gap-3 sm:grid-cols-3">
          {[
            { step: '01', title: 'ClickUp', detail: 'Fonte encerrada' },
            { step: '02', title: 'Agora', detail: 'Migração em curso' },
            { step: '03', title: 'Forjai', detail: 'Próxima origem' },
          ].map((item) => (
            <li
              key={item.step}
              className="rounded-xl border border-rose-100 bg-white/70 px-4 py-3.5 text-left shadow-sm backdrop-blur-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700/80">
                {item.step}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
