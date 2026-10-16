'use client'

import { useCallback, useEffect, useState } from 'react'

import { useDebounce } from '@/shared/hooks/use-debounce'

/**
 * The search box's own text, committed to the data view only once the viewer pauses: a keystroke re-renders the
 * box, not the rows under it. An outside change to the committed search (Reset, back button) replaces the draft;
 * the echo of this box's own commit doesn't, so keys typed while that commit lands survive.
 */
export function useSearchDraft(committed: string, commit: (value: string) => void, debounceMs: number) {
  const [draft, setDraft] = useState(committed)
  const [observed, setObserved] = useState(committed)
  const [sent, setSent] = useState<string | null>(null)

  if (committed !== observed) {
    setObserved(committed)
    if (committed === sent) {
      setSent(null)
    }
    else {
      setDraft(committed)
    }
  }

  const send = useCallback((value: string) => {
    const next = value.trim()
    if (next !== committed.trim()) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- records what this box sent, so its echo isn't taken for an outside change
      setSent(next)
      commit(next)
    }
  }, [committed, commit])

  const settledDraft = useDebounce(draft, debounceMs)
  useEffect(() => {
    send(settledDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the draft settles; re-running on a new `committed` would send a stale draft over a Reset
  }, [settledDraft])

  const flush = useCallback(() => send(draft), [send, draft])

  return { draft, setDraft, flush }
}
