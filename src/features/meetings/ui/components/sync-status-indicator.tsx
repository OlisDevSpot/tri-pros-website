'use client'

import { cn } from '@/shared/lib/utils'

interface SyncStatusIndicatorProps {
  status: string
}

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  const isConnected = status === 'connected'
  const isReconnecting = status === 'reconnecting'

  return (
    <div className="flex items-center gap-1.5" title={`Sync: ${status}`}>
      <span
        className={cn(
          'size-2 rounded-full',
          isConnected && 'bg-emerald-500',
          isReconnecting && 'bg-amber-500 animate-pulse',
          !isConnected && !isReconnecting && 'bg-red-500',
        )}
      />
      <span className="hidden text-[10px] text-muted-foreground sm:inline">
        {isConnected ? 'Live' : isReconnecting ? 'Syncing...' : 'Offline'}
      </span>
    </div>
  )
}
