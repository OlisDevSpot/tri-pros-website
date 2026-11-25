'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { useState } from 'react'
import { TOOLBAR_BUTTON_ACTIVE, TOOLBAR_BUTTON_BASE, TOOLBAR_BUTTON_INACTIVE } from '@/features/proposal-flow/constants/proposal-toolbar'
import { cn } from '@/shared/lib/utils'
import { CompactSaveSplit } from './compact-save-split'

interface Props {
  isLoading: boolean
  actions: ProposalFormActions
}

export function PhoneSaveSplit({ isLoading, actions }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-control-border bg-control p-0.5 shadow-xs">
      <div
        className={cn(
          TOOLBAR_BUTTON_BASE,
          'gap-0 px-0',
          open ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON_INACTIVE,
          isLoading && 'pointer-events-none opacity-50',
        )}
      >
        <CompactSaveSplit
          open={open}
          onOpenChange={setOpen}
          isLoading={isLoading}
          onSave={() => {
            setOpen(false)
            actions.saveOnly()
          }}
          onSaveAndPreview={() => {
            setOpen(false)
            actions.saveAndPreview()
          }}
        />
      </div>
    </div>
  )
}
