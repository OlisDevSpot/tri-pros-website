'use client'

import { CheckIcon, CopyIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { getIntakeUrl } from '@/shared/entities/lead-sources/lib/intake-url'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface IntakeUrlCardProps {
  leadSourceId: string
  token: string
}

export function IntakeUrlCard({ leadSourceId, token }: IntakeUrlCardProps) {
  const [copied, setCopied] = useState(false)
  const { rotateToken } = useLeadSourceActions()
  const [RotateConfirmDialog, confirmRotate] = useConfirm({
    title: 'Rotate intake URL?',
    message: 'The current URL stops working immediately. Share the new one with the partner.',
  })

  const url = typeof window !== 'undefined'
    ? getIntakeUrl(token, window.location.origin)
    : `…/intake/${token}`

  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        toast.success('Intake URL copied')
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Failed to copy'),
    )
  }

  const openPreview = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const rotate = async () => {
    const ok = await confirmRotate()
    if (ok) {
      rotateToken.mutate({ id: leadSourceId })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <RotateConfirmDialog />
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Intake URL
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={rotate}
          disabled={rotateToken.isPending}
        >
          <RefreshCwIcon className="size-3.5" />
          Rotate
        </Button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-1.5">
        <code
          className="flex-1 select-all truncate rounded-md px-2.5 py-1.5 text-xs font-mono text-foreground/90"
          translate="no"
        >
          {url}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={openPreview}
          aria-label="Open intake URL in new tab"
          className="size-8 shrink-0 p-0"
        >
          <ExternalLinkIcon className="size-4" />
        </Button>
        <Button
          size="sm"
          onClick={copy}
          className="h-8 shrink-0 gap-1.5 text-xs"
        >
          {copied
            ? (
                <>
                  <CheckIcon className="size-3.5" />
                  Copied
                </>
              )
            : (
                <>
                  <CopyIcon className="size-3.5" />
                  Copy
                </>
              )}
        </Button>
      </div>
    </div>
  )
}
