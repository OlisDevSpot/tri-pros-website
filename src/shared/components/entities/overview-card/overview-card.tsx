import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

function Root({ className, children }: { className?: string, children: ReactNode }) {
  return <div className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground', className)}>{children}</div>
}

interface HeaderProps {
  icon?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

function Header({ icon, eyebrow, title, subtitle, actions, className }: HeaderProps) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-border px-4 py-3', className)}>
      {icon && <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted">{icon}</div>}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
        <div className="truncate font-bold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

function Body({ className, children }: { className?: string, children: ReactNode }) {
  return <div className={cn('grid gap-3 px-4 py-3', className)}>{children}</div>
}

function Section({ label, className, children }: { label: ReactNode, className?: string, children: ReactNode }) {
  return (
    <section className={cn('grid gap-1.5', className)}>
      <h4 className="text-xs font-bold text-foreground">{label}</h4>
      {children}
    </section>
  )
}

function Footer({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('flex flex-wrap items-center gap-2 border-t border-border bg-band px-4 py-3', className)} />
}

export const OverviewCard = Object.assign(Root, { Header, Body, Section, Footer })
