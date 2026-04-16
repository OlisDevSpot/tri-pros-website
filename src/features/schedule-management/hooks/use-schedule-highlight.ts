'use client'

import { useQueryState } from 'nuqs'
import { useCallback, useRef, useState } from 'react'

import { highlightDateParser, highlightMeetingParser } from '@/features/schedule-management/constants/query-parsers'

const HIGHLIGHT_DURATION_MS = 10_000

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

        // Card has rendered — scroll into view
        requestAnimationFrame(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        })

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
