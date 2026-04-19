'use client'

import { useQueryState } from 'nuqs'
import { useCallback, useRef, useState } from 'react'

import { highlightDateParser, highlightMeetingParser } from '@/features/schedule-management/constants/query-parsers'

const HIGHLIGHT_DURATION_MS = 10_000
// The ScheduleView root is wrapped in a motion.div with `delay: 0.25s + duration: 0.25s`.
// On iOS Safari / PWA, transforms applied during that animation break
// scrollIntoView's position calculation, so the page loads and looks like
// it "only navigated to the schedule" — no scroll happens. We defer the
// scroll until the motion animation has settled (with a small safety margin).
const SCROLL_DEFER_MS = 600

interface UseScheduleHighlightReturn {
  highlightMeetingId: string
  highlightDate: string
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function useScheduleHighlight(): UseScheduleHighlightReturn {
  const [highlightMeeting, setHighlightMeeting] = useQueryState('highlightMeeting', highlightMeetingParser)
  const [highlightDate, setHighlightDate] = useQueryState('highlightDate', highlightDateParser)
  const [activeHighlight, setActiveHighlight] = useState(highlightMeeting)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHighlighted = useCallback(
    (meetingId: string) => activeHighlight === meetingId,
    [activeHighlight],
  )

  const highlightRef = useCallback(
    (meetingId: string): React.RefCallback<HTMLDivElement> => {
      return (node) => {
        // Only fire once, only for the highlighted meeting, only on mount (not unmount)
        if (!node || meetingId !== activeHighlight || timerRef.current) {
          return
        }

        // Card has rendered — wait for the page-level motion animation to
        // settle before scrolling (otherwise iOS Safari miscalculates the
        // target and silently no-ops). `block: 'center'` is also more
        // reliable than 'nearest' when the target sits inside a nested
        // ScrollArea viewport on mobile.
        setTimeout(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        }, SCROLL_DEFER_MS)

        // NOW start the cleanup timer since the highlight is actually visible
        timerRef.current = setTimeout(() => {
          setActiveHighlight('')
          void setHighlightMeeting('')
          void setHighlightDate('')
        }, HIGHLIGHT_DURATION_MS)
      }
    },
    [activeHighlight, setHighlightMeeting, setHighlightDate],
  )

  return {
    highlightMeetingId: highlightMeeting,
    highlightDate,
    isHighlighted,
    highlightRef,
  }
}
