import type { LucideIcon } from 'lucide-react'

interface ContactLineProps {
  icon: LucideIcon
  label: string
  value: string
}

/** One line of the agent's business card: icon, visually hidden label, value. */
export function ContactLine({ icon: Icon, label, value }: ContactLineProps) {
  return (
    <div className="flex min-w-0 items-center gap-[0.6em]">
      <dt className="shrink-0">
        <Icon aria-hidden className="size-[1em] text-(--presentation-ground)/55" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}
