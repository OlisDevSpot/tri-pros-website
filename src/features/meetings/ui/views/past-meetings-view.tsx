'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { PastMeetingsTable } from '@/features/meetings/ui/components/table'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useTRPC } from '@/trpc/helpers'

export function PastMeetingsView() {
  const trpc = useTRPC()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())

  if (meetings.isLoading) {
    return (
      <LoadingState
        title="Loading Past Meetings"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!meetings.data) {
    return (
      <ErrorState
        title="Error: Could not load past meetings"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (meetings.data.length === 0) {
    return (
      <EmptyState
        title="No Meetings Found"
        description="Create a new meeting to get started"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <Card className="h-full w-full flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>Past Meetings</CardTitle>
          <CardDescription>
            {meetings.data.length}
            {' '}
            total meeting
            {meetings.data.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-auto">
          <PastMeetingsTable data={meetings.data} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
