import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  value: string
  sub?: string
  onClick?: () => void
  className?: string
}

export function StatTile({ label, value, sub, onClick, className }: Props) {
  const body = (
    <>
      <span className="text-sm font-bold">{label}</span>
      <span className="mt-1.5 font-sans text-4xl font-semibold tabular-nums text-primary">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </>
  )
  const tile = cn('grid content-start gap-0.5 rounded-xl border bg-card p-5 text-left shadow-sm', className)
  if (!onClick) {
    return <div className={tile}>{body}</div>
  }
  return <button className={cn(tile, 'transition-colors hover:border-primary/45')} onClick={onClick} type="button">{body}</button>
}
