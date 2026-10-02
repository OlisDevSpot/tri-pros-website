'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { CreateMeetingForm } from '@/shared/entities/meetings/components/create-meeting-form'
import { QuickNoteInput } from '../timeline/quick-note-input'

interface Props {
  commands: ProfileCommands
  customer: CustomerProfileData['customer']
  onMutationSuccess: () => void
}

export function CustomerProfileCommandDialogs({ commands, customer, onMutationSuccess }: Props) {
  return (
    <>
      <Dialog onOpenChange={commands.setMeetingOpen} open={commands.meetingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add meeting</DialogTitle>
          </DialogHeader>
          <CreateMeetingForm
            customerId={customer.id}
            customerName={customer.name}
            onCancel={() => commands.setMeetingOpen(false)}
            onSuccess={() => {
              commands.setMeetingOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={commands.setNoteOpen} open={commands.noteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
          </DialogHeader>
          <QuickNoteInput
            customerId={customer.id}
            onSuccess={() => {
              commands.setNoteOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
