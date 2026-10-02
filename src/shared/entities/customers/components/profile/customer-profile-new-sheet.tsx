'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { NewSheetChoice, NewSheetStep, ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { ChevronLeftIcon } from 'lucide-react'
import { useState } from 'react'
import { InlineSheet } from '@/shared/components/dialogs/sheets/inline-sheet'
import { InlineSheetBody } from '@/shared/components/dialogs/sheets/inline-sheet-body'
import { Button } from '@/shared/components/ui/button'
import { PROFILE_NEW_SHEET_ID, PROFILE_NEW_SHEET_TITLE_ID } from '@/shared/entities/customers/constants/profile-modal'
import { CustomerProfileNewMenu } from './customer-profile-new-menu'
import { CustomerProposalPicker } from './customer-proposal-picker'

interface Props {
  commands: ProfileCommands
  meetings: CustomerProfileMeeting[]
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function CustomerProfileNewSheet({ commands, meetings, onOpenChange, open }: Props) {
  const [step, setStep] = useState<NewSheetStep>('menu')
  const [wasOpen, setWasOpen] = useState(open)

  // Every opening starts on the menu. Resetting on open rather than on close keeps the picker on
  // screen while the sheet slides away.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep('menu')
    }
  }

  function handlePick(choice: NewSheetChoice) {
    if (choice === 'proposal') {
      setStep('proposal')
      return
    }
    onOpenChange(false)
    if (choice === 'meeting') {
      commands.openMeeting()
    }
    else {
      commands.openNote()
    }
  }

  return (
    <InlineSheet
      className="[--inline-sheet-offset:calc(4.25rem+env(safe-area-inset-bottom))]"
      id={PROFILE_NEW_SHEET_ID}
      labelledBy={PROFILE_NEW_SHEET_TITLE_ID}
      onOpenChange={onOpenChange}
      open={open}
    >
      {step === 'menu'
        ? (
            <div className="px-4 pt-1 pb-4">
              <h2 className="mb-3 text-base font-semibold" id={PROFILE_NEW_SHEET_TITLE_ID}>New</h2>
              <CustomerProfileNewMenu commands={commands} onPick={handlePick} />
            </div>
          )
        : (
            <>
              <div className="flex shrink-0 items-center gap-1 px-2 pb-2">
                <Button aria-label="Back" className="size-11" onClick={() => setStep('menu')} size="icon" variant="ghost">
                  <ChevronLeftIcon className="size-5" />
                </Button>
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-base font-semibold" id={PROFILE_NEW_SHEET_TITLE_ID}>New proposal</h2>
                  <span className="text-xs text-muted-foreground">Attach it to a meeting</span>
                </div>
              </div>
              <InlineSheetBody className="px-4 pb-4">
                <CustomerProposalPicker
                  meetings={meetings}
                  onAddMeeting={() => {
                    onOpenChange(false)
                    commands.openMeeting()
                  }}
                  presentation="list"
                />
              </InlineSheetBody>
            </>
          )}
    </InlineSheet>
  )
}
