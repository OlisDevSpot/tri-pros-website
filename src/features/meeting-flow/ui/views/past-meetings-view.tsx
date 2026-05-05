'use client'

import { motion } from 'motion/react'

import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
import { Card, CardContent } from '@/shared/components/ui/card'

export function PastMeetingsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col"
    >
      <Card className="h-full w-full flex flex-col lg:p-6 border-0 lg:border bg-transparent lg:bg-card">
        <CardContent className="grow min-h-0 overflow-hidden px-0">
          <PastMeetingsTable />
        </CardContent>
      </Card>
    </motion.div>
  )
}
