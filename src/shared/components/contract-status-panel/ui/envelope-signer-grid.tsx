'use client'

import type { ZohoActionStatus } from '@/shared/services/providers/zoho-sign/types'
import { CheckCircle, Eye, Mail, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface SignerStatus {
  role: string
  status: ZohoActionStatus
}

interface EnvelopeSignerGridProps {
  signerStatuses: readonly SignerStatus[]
}

const ACTION_ICONS: Record<ZohoActionStatus, React.ReactNode> = {
  NOACTION: <Minus className="size-3.5 text-muted-foreground" aria-hidden />,
  UNOPENED: <Mail className="size-3.5 text-muted-foreground" aria-hidden />,
  VIEWED: <Eye className="size-3.5 text-status-info-fg" aria-hidden />,
  SIGNED: <CheckCircle className="size-3.5 text-status-success-fg" aria-hidden />,
}

const ACTION_LABELS: Record<ZohoActionStatus, string> = {
  NOACTION: 'Waiting',
  UNOPENED: 'Unopened',
  VIEWED: 'Viewed',
  SIGNED: 'Signed',
}

export function EnvelopeSignerGrid({ signerStatuses }: EnvelopeSignerGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {signerStatuses.map(signer => (
        <div
          key={signer.role}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3',
            signer.status === 'SIGNED'
              ? 'border-status-success-dot/40 bg-status-success-bg/70'
              : 'border-border bg-muted',
          )}
        >
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              signer.status === 'SIGNED' ? 'bg-status-success-bg' : 'bg-muted',
            )}
          >
            {ACTION_ICONS[signer.status]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{signer.role}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ACTION_LABELS[signer.status]}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
