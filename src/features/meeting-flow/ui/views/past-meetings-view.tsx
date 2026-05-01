'use client'

import { motion } from 'motion/react'

import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function PastMeetingsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <Card className="h-full w-full flex flex-col lg:p-6 border-0 lg:border bg-transparent lg:bg-card">
        <CardHeader className="shrink-0 px-0">
          <CardTitle>Past Meetings</CardTitle>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-hidden px-0">
          <PastMeetingsTable />
        </CardContent>
      </Card>
    </motion.div>
  )
}
