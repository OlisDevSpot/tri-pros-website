import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PlatformBadgeProps {
  platform: string
  href?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function PlatformBadge({ platform, href, icon, children, className }: PlatformBadgeProps) {
  const base = 'border-border bg-card flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 shadow-sm'
  const inner = (
    <>
      {icon ? <span className="text-foreground shrink-0" aria-hidden="true">{icon}</span> : null}
      <span className="text-foreground text-sm font-semibold">{platform}</span>
      {children}
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${platform} reviews (opens in a new tab)`}
        className={cn(base, 'hover:border-primary/50 transition-colors', className)}
      >
        {inner}
      </a>
    )
  }
  return <div className={cn(base, className)}>{inner}</div>
}
