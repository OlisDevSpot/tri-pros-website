'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { ChevronDownIcon, SaveIcon } from 'lucide-react'
import { useState } from 'react'
import { TOOLBAR_BUTTON_ACTIVE, TOOLBAR_BUTTON_BASE, TOOLBAR_BUTTON_INACTIVE } from '@/features/proposal-flow/constants/proposal-toolbar'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

interface Props {
  isLoading: boolean
  actions: ProposalFormActions
}

export function PhoneSaveSplit({ isLoading, actions }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-control-border bg-tab-track p-0.5">
      <div
        className={cn(
          TOOLBAR_BUTTON_BASE,
          'gap-0 px-0',
          open ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON_INACTIVE,
          isLoading && 'pointer-events-none opacity-50',
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isLoading}
              aria-label="Save"
              className="inline-flex items-center gap-0.5 px-1.5"
            >
              <SaveIcon className="size-3.5" />
              <ChevronDownIcon className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setOpen(false)
                  actions.saveOnly()
                }}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setOpen(false)
                  actions.saveAndPreview()
                }}
              >
                Save & Preview
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
