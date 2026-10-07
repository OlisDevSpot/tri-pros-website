'use client'

import { useQueryState } from 'nuqs'
import { useCallback, useRef, useState } from 'react'

import { highlightMeetingParser } from '@/features/schedule-management/constants/query-parsers'

const HIGHLIGHT_DURATION_MS = 10_000
// On iOS Safari / PWA, a transform still animating on an ancestor breaks scrollIntoView's position math and the
// scroll silently no-ops. The dashboard template fades the page in over 200 ms with a 4px rise, so the scroll
// waits for that to settle, with a margin.
const SCROLL_DEFER_MS = 250

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

        // Card has rendered — wait for the template's entrance to settle before scrolling (see SCROLL_DEFER_MS).
        // `block: 'center'` is also more reliable than 'nearest' when the target sits inside a nested
        // ScrollArea viewport on mobile.
        setTimeout(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        }, SCROLL_DEFER_MS)

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
