'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { EditContactForm } from '@/features/meetings/ui/components/edit-contact-form'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function EditMeetingSetupView({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC()
  const { data: meeting, isLoading } = useQuery(trpc.meetingsRouter.getById.queryOptions({ id: meetingId }))

  if (isLoading || !meeting) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        initial={{ opacity: 0, y: -30 }}
        transition={{ duration: 0.25 }}
        className="w-full h-full flex flex-col gap-4 min-h-0 overflow-auto pr-1"
      >
        <LoadingState title="Loading meeting" description="Fetching meeting details…" />
      </motion.div>
    )
  }

  return <EditContactForm meeting={meeting} />
}
