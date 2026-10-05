'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

interface TradeNoteFieldProps {
  tradeId: string
  tradeName: string
  note: string
}

/**
 * Typing edits a local draft only; the model (and so the meeting write) sees the note on
 * blur or when the field unmounts, and only when the draft differs from the stored note.
 * The provider outlives the panel, so the unmount commit survives closing the row or the panel.
 * A note changed outside the field (a server re-seed) replaces the draft.
 */
export function TradeNoteField({ tradeId, tradeName, note }: TradeNoteFieldProps) {
  const { setNote } = useTradeActions()
  const id = `trade-note-${tradeId}`
  const [draft, setDraft] = useState(note)
  const [adoptedNote, setAdoptedNote] = useState(note)

  // Render-phase adjustment (React: "storing information from previous renders").
  if (note !== adoptedNote) {
    setAdoptedNote(note)
    setDraft(note)
  }

  const latestRef = useRef({ draft, note, tradeId, setNote })
  useLayoutEffect(() => {
    latestRef.current = { draft, note, tradeId, setNote }
  })

  useEffect(() => {
    const latest = latestRef
    return () => {
      const { draft: pending, note: stored, tradeId: pendingTradeId, setNote: commit } = latest.current
      if (pending !== stored) {
        commit(pendingTradeId, pending)
      }
    }
  }, [])

  function handleBlur() {
    if (draft !== note) {
      setNote(tradeId, draft)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" htmlFor={id}>
        {SPECIALTIES_COPY.panel.note}
      </Label>
      <Textarea
        className="min-h-11 resize-none text-base motion-safe:transition-[min-height] motion-safe:duration-200 focus-visible:min-h-26"
        id={id}
        placeholder={SPECIALTIES_COPY.panel.notePlaceholder(tradeName)}
        rows={1}
        value={draft}
        onBlur={handleBlur}
        onChange={event => setDraft(event.target.value)}
      />
    </div>
  )
}
