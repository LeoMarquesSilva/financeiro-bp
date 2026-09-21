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
