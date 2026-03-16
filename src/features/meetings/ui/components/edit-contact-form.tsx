'use client'

import type { Meeting } from '@/shared/db/schema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, SaveIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { NotionContactSearch } from '@/shared/components/notion/contact-search'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

interface EditContactFormProps {
  meeting: Meeting
}

export function EditContactForm({ meeting }: EditContactFormProps) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState(meeting.contactName ?? '')

  const updateMeeting = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetingsRouter.getAll.queryFilter())
        toast.success('Meeting updated')
        router.push(`${ROOTS.dashboard.root}?step=meetings`)
      },
      onError: () => toast.error('Failed to update meeting'),
    }),
  )

  function handleSave() {
    updateMeeting.mutate({
      id: meeting.id,
      contactName: contactName || undefined,
    })
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      initial={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 min-h-0 overflow-auto pr-1"
    >
      <Button
        className="self-start gap-2 -ml-2"
        size="sm"
        variant="ghost"
        onClick={() => router.push(`${ROOTS.dashboard.root}?step=meetings`)}
      >
        <ArrowLeftIcon className="size-4" />
        Back to meetings
      </Button>

      <Separator />

      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Customer Contact
          {contactName && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {contactName}
            </span>
          )}
        </p>
        <NotionContactSearch
          value={contactId}
          onSelect={(id, name) => {
            setContactId(id)
            setContactName(name)
          }}
          onClear={() => {
            setContactId('')
            setContactName('')
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          To edit profile data, open the meeting and use the Intake view.
        </p>
      </div>

      <Button
        className="w-full gap-2 py-6 text-base font-semibold"
        disabled={updateMeeting.isPending}
        size="lg"
        onClick={handleSave}
      >
        <SaveIcon className="size-5" />
        {updateMeeting.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </motion.div>
  )
}
