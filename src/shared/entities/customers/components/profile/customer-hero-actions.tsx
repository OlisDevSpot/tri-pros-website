'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { CalendarIcon, FileTextIcon, StickyNoteIcon, XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { CustomerProposalPicker } from './customer-proposal-picker'

interface Props {
  commands: ProfileCommands
  meetings: CustomerProfileMeeting[]
  onClose: () => void
}

// The rail's foot: the deal-advancing verbs, then Close. Call, text and email stay in the contact
// rows. The menu is non-modal because the profile dialog already owns focus and scroll locking.
export function CustomerHeroActions({ commands, meetings, onClose }: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 pt-4 pb-5">
      {commands.canAddProposal && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button className="h-11 w-full">
              <FileTextIcon />
              New proposal
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)" side="top" sideOffset={8}>
            <CustomerProposalPicker meetings={meetings} onAddMeeting={commands.openMeeting} presentation="menu" />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="grid grid-cols-2 gap-2 has-[>:only-child]:grid-cols-1">
        {commands.canAddMeeting && (
          <Button className="h-11" onClick={commands.openMeeting} variant="outline">
            <CalendarIcon />
            Add meeting
          </Button>
        )}
        <Button className="h-11" onClick={commands.openNote} variant="outline">
          <StickyNoteIcon />
          Add note
        </Button>
      </div>
      <Button className="h-10 justify-start text-muted-foreground" onClick={onClose} variant="ghost">
        <XIcon />
        Close
        <kbd aria-hidden className="ml-auto rounded border border-border px-1.5 text-xs font-medium">Esc</kbd>
      </Button>
    </div>
  )
}
