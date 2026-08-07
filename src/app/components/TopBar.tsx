const LOGO_AZUL = '/team/logo-azul.png'

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-sm">
      <img
        src={LOGO_AZUL}
        alt="Bismarchi Pires"
        className="h-7 w-auto shrink-0 object-contain"
      />
    </header>
  )
}
