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
 * The provider outlives the sheet, so the unmount commit survives Escape and switching trades.
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
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor={id}>
        {SPECIALTIES_COPY.sheet.note}
      </Label>
      <Textarea
        id={id}
        className="min-h-20 resize-none text-base"
        placeholder={SPECIALTIES_COPY.sheet.notePlaceholder(tradeName)}
        rows={2}
        value={draft}
        onBlur={handleBlur}
        onChange={event => setDraft(event.target.value)}
      />
    </div>
  )
}
