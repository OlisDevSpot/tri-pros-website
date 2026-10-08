'use client'

import { XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { tabsTriggerVariants } from '@/shared/components/ui/tabs'
import { PROFILE_RAIL_MEDIA_QUERY } from '@/shared/entities/customers/constants/profile-modal'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

interface Props {
  onClose: () => void
}

// The loaded modal's geometry (rail and pane, or hero, content and tab bar), so loading ends in a
// content swap rather than a layout jump. Close is live because the header X is hidden.
export function CustomerProfileLoadingSkeleton({ onClose }: Props) {
  const isDesktop = useMediaQuery(PROFILE_RAIL_MEDIA_QUERY)

  if (isDesktop) {
    return (
      <div className="flex min-h-0 w-full flex-1">
        <div className="flex w-95 shrink-0 flex-col border-r border-border bg-card">
          <div className="h-47.5 animate-pulse bg-linear-to-br from-scrim/85 via-scrim/75 to-scrim" />
          <div className="flex flex-1 flex-col gap-3 px-6 pb-5">
            <div className="relative -mt-8.5 size-17 rounded-2xl bg-skeleton ring-4 ring-card" />
            <div className="h-7 w-48 animate-pulse rounded-md bg-skeleton" />
            <div className="h-5 w-64 animate-pulse rounded bg-skeleton" />
            <div className="h-5 w-40 animate-pulse rounded bg-skeleton" />
            <div className="h-5 w-56 animate-pulse rounded bg-skeleton" />
          </div>
          <div className="flex flex-col gap-2 border-t border-border px-6 pt-4 pb-5">
            <div className="h-11 animate-pulse rounded-md bg-skeleton" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-11 animate-pulse rounded-md bg-skeleton" />
              <div className="h-11 animate-pulse rounded-md bg-skeleton" />
            </div>
            <Button className="h-10 justify-start text-muted-foreground" onClick={onClose} variant="ghost">
              <XIcon />
              Close
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-13 shrink-0 border-b border-border" />
          <div className="flex-1 space-y-3 p-6">
            <div className="h-4 w-24 animate-pulse rounded bg-skeleton" />
            <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
            <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="h-56 shrink-0 animate-pulse bg-linear-to-br from-scrim/85 via-scrim/75 to-scrim" />
      <div className="flex-1 space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-skeleton" />
        <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
      </div>
      <div className="grid shrink-0 grid-cols-5 gap-0.5 border-t border-border bg-card px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        <button className={tabsTriggerVariants({ variant: 'bar' })} onClick={onClose} type="button">
          <XIcon className="size-5" />
          Close
        </button>
      </div>
    </div>
  )
}
