'use client'

import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useCallback, useState } from 'react'

import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { useScheduleHighlight } from '@/features/schedule-management/hooks/use-schedule-highlight'
import { ActivityForm } from '@/features/schedule-management/ui/components/activity-form'
import { ScheduleActivitiesCalendar } from '@/features/schedule-management/ui/components/schedule-activities-calendar'
import { ScheduleMeetingsCalendar } from '@/features/schedule-management/ui/components/schedule-meetings-calendar'
import { ScheduleShowToggle } from '@/features/schedule-management/ui/components/schedule-show-toggle'
import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'

export function ScheduleView() {
  const [show, setShow] = useQueryState('show', scheduleShowParser)
  const [showSaturday, setShowSaturday] = useState(false)
  const [activityFormOpen, setActivityFormOpen] = useState(false)
  const { isHighlighted, highlightRef } = useScheduleHighlight()
  const isHydrating = useIsHydrating()

  const handleToggleSaturday = useCallback(() => setShowSaturday(prev => !prev), [])
  const handleNewActivity = useCallback(() => setActivityFormOpen(true), [])

  const showToggle = <ScheduleShowToggle value={show} onChange={next => void setShow(next)} />

  return (
    <motion.div
      initial={isHydrating ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {show === 'activities'
        ? (
            <ScheduleActivitiesCalendar
              showToggle={showToggle}
              showSaturday={showSaturday}
              onToggleSaturday={handleToggleSaturday}
              onNewActivity={handleNewActivity}
            />
          )
        : (
            <ScheduleMeetingsCalendar
              showToggle={showToggle}
              showSaturday={showSaturday}
              onToggleSaturday={handleToggleSaturday}
              onNewActivity={handleNewActivity}
              isHighlighted={isHighlighted}
              highlightRef={highlightRef}
            />
          )}

      <ActivityForm open={activityFormOpen} onOpenChange={setActivityFormOpen} />
    </motion.div>
  )
}
