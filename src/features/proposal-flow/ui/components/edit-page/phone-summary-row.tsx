'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import type { Proposal } from '@/shared/db/schema'
import { MoreHorizontalIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFormPartState } from '@/features/proposal-flow/hooks/use-form-part-state'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/components/ui/popover'
import { LoadingValue } from './loading-value'
import { PhoneSaveSplit } from './phone-save-split'
import { PricingModeSettings } from './pricing-mode-settings'
import { ProposalStatusChip } from './proposal-status-chip'

interface Props {
  proposalId: string
  status: Proposal['status'] | null
  isLoading: boolean
  viewHref: string
  actions: ProposalFormActions
}

export function PhoneSummaryRow({ proposalId, status, isLoading, viewHref, actions }: Props) {
  const { funding } = useFormPartState(proposalId)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The popover opens only once the menu has released focus, or the menu's focus return dismisses it.
  const openSettingsOnClose = useRef(false)

  return (
    <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
      <PopoverAnchor asChild>
        <div className="surface flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 md:hidden">
          <ProposalStatusChip status={status} />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">Price</span>
            <span className="truncate text-sm font-semibold tabular-nums">
              <LoadingValue width={64}>{funding.summary}</LoadingValue>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu onOpenChange={(open) => {
              if (open) {
                openSettingsOnClose.current = false
              }
            }}
            >
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="More">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (openSettingsOnClose.current) {
                    event.preventDefault()
                    openSettingsOnClose.current = false
                    setSettingsOpen(true)
                  }
                }}
              >
                {viewHref && (
                  <DropdownMenuItem asChild>
                    <a href={viewHref} target="_blank" rel="noopener noreferrer">Preview</a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={isLoading} onSelect={() => actions.openInternalFinancials()}>Internal financials</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isLoading}
                  onSelect={() => {
                    openSettingsOnClose.current = true
                  }}
                >
                  Proposal settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <PhoneSaveSplit isLoading={isLoading} actions={actions} />
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-72" side="top" align="end">
        <PricingModeSettings />
      </PopoverContent>
    </Popover>
  )
}
