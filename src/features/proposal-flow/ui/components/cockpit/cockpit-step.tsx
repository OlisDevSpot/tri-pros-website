import type { ReactNode } from 'react'

interface Props {
  number: number
  title: string
  status?: ReactNode
  children: ReactNode
}

// A nested `bg-card` on the sheet's own card, so each step climbs one rung in both schemes.
export function CockpitStep({ number, title, status, children }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card" aria-labelledby={`cockpit-step-${number}`}>
      <header className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <span aria-hidden className="grid size-5.5 shrink-0 place-items-center rounded-full bg-foreground font-sans text-xs font-semibold text-background">{number}</span>
        <h3 id={`cockpit-step-${number}`} className="font-sans text-sm font-semibold">{title}</h3>
        {status && <small className="ml-auto text-right text-xs font-bold text-muted-foreground">{status}</small>}
      </header>
      <div className="grid gap-3 px-3.5 pt-3 pb-3.5">{children}</div>
    </section>
  )
}
