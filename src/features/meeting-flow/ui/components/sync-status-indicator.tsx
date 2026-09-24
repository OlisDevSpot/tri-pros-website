'use client'

import type { ComponentProps } from 'react'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { cn } from '@/shared/lib/utils'

interface SyncStatusIndicatorProps {
  status: string
  side?: ComponentProps<typeof HybridPopoverTooltip>['side']
  className?: string
}

type SyncState = keyof typeof SHELL_COPY.sync

function toSyncState(status: string): SyncState {
  if (status === 'connected') {
    return 'live'
  }
  if (status === 'connecting' || status === 'disconnected') {
    return 'reconnecting'
  }
  return 'offline'
}

/**
 * The dot is 8px; the button around it is the 44px target, because on a tablet
 * the explanation opens on tap (`HybridPopoverTooltip`), not on hover.
 */
export function SyncStatusIndicator({ status, side = 'top', className }: SyncStatusIndicatorProps) {
  const state = toSyncState(status)
  const copy = SHELL_COPY.sync[state]

  return (
    <HybridPopoverTooltip
      content={(
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{copy.label}</span>
          <span className="text-muted-foreground">{copy.detail}</span>
        </div>
      )}
      side={side}
    >
      <button
        aria-label={`${copy.label}. ${copy.detail}`}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        type="button"
      >
        <span
          className={cn(
            'size-2 rounded-full',
            state === 'live' && 'bg-success',
            state === 'reconnecting' && 'bg-warning motion-safe:animate-pulse',
            state === 'offline' && 'bg-destructive',
          )}
        />
      </button>
    </HybridPopoverTooltip>
  )
}
