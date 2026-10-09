'use client'

import { useQueryState } from 'nuqs'
import { useCallback, useRef, useState } from 'react'

import { highlightMeetingParser } from '@/features/schedule-management/constants/query-parsers'

const HIGHLIGHT_DURATION_MS = 10_000

interface UseScheduleHighlightReturn {
  highlightMeetingId: string
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function useScheduleHighlight(): UseScheduleHighlightReturn {
  const [highlightMeeting, setHighlightMeeting] = useQueryState('highlightMeeting', highlightMeetingParser)
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

        // The card is in the DOM and nothing above it animates, so the scroll runs at once. `block: 'center'` is
        // more reliable than 'nearest' when the target sits inside a nested ScrollArea viewport on mobile.
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

        // NOW start the cleanup timer since the highlight is actually visible
        timerRef.current = setTimeout(() => {
          setActiveHighlight('')
          void setHighlightMeeting('')
        }, HIGHLIGHT_DURATION_MS)
      }
    },
    [activeHighlight, setHighlightMeeting],
  )

  return {
    highlightMeetingId: highlightMeeting,
    isHighlighted,
    highlightRef,
  }
}
