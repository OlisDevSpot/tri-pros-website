'use client'

import { useMutation } from '@tanstack/react-query'
import { CalendarIcon, PlayIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { NotionContactSearch } from '@/shared/components/notion/contact-search'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

export function CreateMeetingView() {
  const router = useRouter()
  const trpc = useTRPC()

  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState('')
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)

  const createMeeting = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: (meeting) => {
        toast.success('Meeting started!')
        router.push(`${ROOTS.dashboard.meetings()}/${meeting.id}`)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )

  function handleStart() {
    createMeeting.mutate({
      notionContactId: contactId,
      contactName: contactName || undefined,
      scheduledFor: scheduledFor?.toISOString(),
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
            Select a contact to start a meeting.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <Label className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          Schedule
        </Label>
        <DateTimePicker
          value={scheduledFor}
          onChange={setScheduledFor}
          placeholder="Select date & time (optional)"
          className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
        />
      </div>

      <Button
        className="w-full gap-2 py-6 text-base font-semibold"
        disabled={!contactId || createMeeting.isPending}
        size="lg"
        onClick={handleStart}
      >
        <PlayIcon className="size-5" />
        {createMeeting.isPending ? 'Starting…' : 'Start Meeting'}
      </Button>
    </motion.div>
  )
}
