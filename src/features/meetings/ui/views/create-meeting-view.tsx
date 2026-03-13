'use client'

import { useMutation } from '@tanstack/react-query'
import { PlayIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { NotionContactSearch } from '@/shared/components/notion/contact-search'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

export function CreateMeetingView() {
  const router = useRouter()
  const trpc = useTRPC()

  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState('')

  const createMeeting = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: (meeting) => {
        toast.success('Meeting started!')
        router.push(`/dashboard/meetings/${meeting.id}`)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )

  function handleStart() {
    createMeeting.mutate({
      notionContactId: contactId || undefined,
      contactName: contactName || undefined,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-6 min-h-0 overflow-auto pr-1"
    >
      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Find Customer
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
        {!contactId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Linking a contact personalizes the meeting presentation.
          </p>
        )}
      </div>

      <Button
        className="w-full gap-2 py-6 text-base font-semibold"
        disabled={createMeeting.isPending}
        size="lg"
        onClick={handleStart}
      >
        <PlayIcon className="size-5" />
        {createMeeting.isPending ? 'Starting…' : 'Start Meeting'}
      </Button>
    </motion.div>
  )
}
