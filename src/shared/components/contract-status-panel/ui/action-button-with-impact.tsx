'use client'

import type { ReactNode } from 'react'
import type { ActionImpact } from '../constants/action-impacts'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { ACTION_IMPACT_META } from '../constants/action-impacts'

interface ActionButtonWithImpactProps {
  variant?: 'default' | 'outline' | 'destructive'
  impact: ActionImpact
  impactCopy: string
  icon?: ReactNode
  label: string
  loadingLabel?: string
  onClick: () => void
  disabled?: boolean
  isPending?: boolean
  className?: string
}

/**
 * Action button that always carries an inline microcopy line beneath it
 * describing the customer-side effect (icon + text). The agent should
 * never have to guess whether a click will email the customer.
 */
export function ActionButtonWithImpact({
  variant = 'default',
  impact,
  impactCopy,
  icon,
  label,
  loadingLabel,
  onClick,
  disabled,
  isPending,
  className,
}: ActionButtonWithImpactProps) {
  const meta = ACTION_IMPACT_META[impact]
  const ImpactIcon = meta.icon

  const isDestructiveVariant = variant === 'destructive'
  const buttonVariant = isDestructiveVariant ? 'outline' : variant

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Button
        variant={buttonVariant}
        onClick={onClick}
        disabled={disabled || isPending}
        className={cn(
          'w-full sm:w-auto',
          isDestructiveVariant && 'border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5',
        )}
      >
        {isPending
          ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {loadingLabel ?? label}
              </>
            )
          : (
              <>
                {icon && <span className="mr-2 inline-flex">{icon}</span>}
                {label}
              </>
            )}
      </Button>
      <div className="flex items-center gap-1.5 px-0.5">
        <ImpactIcon className={cn('size-3 shrink-0', meta.iconClassName)} aria-hidden />
        <p className={cn('text-[11px] leading-tight', meta.labelClassName)}>
          {impactCopy}
        </p>
      </div>
    </div>
  )
}
