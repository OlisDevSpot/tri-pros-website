'use client'

import type { OmniQueryState, OmniView } from '@/features/omni-search/types'

import { useCommandState } from 'cmdk'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_STATUS_DOT_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniHintSet } from '@/features/omni-search/lib/omni-hint-set'
import { omniStatus } from '@/features/omni-search/lib/omni-status'
import { cn } from '@/shared/lib/utils'

interface Props {
  state: OmniQueryState
  view: OmniView
  /** Focus is in a contact capsule or its open menu. */
  inContact: boolean
}

// Reads the highlight itself, so moving it re-renders the footer, not the results.
export function OmniStatusFooter({ state, view, inContact }: Props) {
  const highlighted = useCommandState(command => command.value)
  const status = omniStatus(state, view)
  const hints = omniHintSet({ highlighted, data: state.data, pending: state.pending, view, inContact })
  // Only settled states are announced: a busy line that changes with every keystroke would talk over the typing.
  const announcement = status.kind === 'done' || status.kind === 'none' || status.kind === 'error' ? status.text : ''
  return (
    <div className="flex h-10 shrink-0 items-center gap-2.5 border-t border-border px-4 text-xs text-muted-foreground">
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', OMNI_STATUS_DOT_CLASSES[status.kind])} />
      <p aria-hidden className="min-w-0 flex-1 truncate">{status.text}</p>
      <p aria-atomic aria-live="polite" className="sr-only">{announcement}</p>
      <p aria-hidden className="flex shrink-0 items-center gap-3 pointer-coarse:hidden">
        {OMNI_COPY.hints[hints].map(hint => <span key={hint}>{hint}</span>)}
      </p>
    </div>
  )
}
