'use client'

import type { OmniMode, OmniPickedCustomer, OmniQueryState, OmniView } from '@/features/omni-search/types'

import { memo, useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_DESKTOP_QUERY, OMNI_LIST_CLASS } from '@/features/omni-search/constants/omni-search'
import { useOmniSearchQuery } from '@/features/omni-search/hooks/use-omni-search-query'
import { focusHighlightedContact, isInContactGroup } from '@/features/omni-search/lib/omni-focus'
import { OmniInputRow } from '@/features/omni-search/ui/components/omni-input-row'
import { OmniSearchResults } from '@/features/omni-search/ui/components/omni-search-results'
import { OmniStatusFooter } from '@/features/omni-search/ui/components/omni-status-footer'
import { CommandList } from '@/shared/components/ui/command'
import { OMNI_TERM_MAX, toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

interface Props {
  onHighlight: (value: string) => void
  onDone: () => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

// Lives inside the dialog content, which unmounts on close, so every open starts with an empty term at the root.
// Memoized with stable props, so a highlight move re-renders the dialog without re-rendering the panel.
function OmniSearchPanelImpl({ onHighlight, onDone, onPickCustomer }: Props) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<OmniMode>('root')
  const [inContact, setInContact] = useState(false)
  const [answeredTerm, setAnsweredTerm] = useState('')
  // One tree per layout, so cmdk never registers hidden duplicate rows.
  const isDesktop = useMediaQuery(OMNI_DESKTOP_QUERY)
  const query = useOmniSearchQuery(search)

  // The instant term, not the debounced one, decides visibility, so clearing the input hides stale records at once.
  const term = toOmniTerm(search)
  const data = term ? query.data : undefined
  // The query follows the debounced term, so until it catches up (or while it serves the previous term's placeholder) its rows describe an earlier term.
  const pending = !!term && (term !== query.term || query.isPlaceholderData)
  // Highlights follow the term the shown rows answer: placeholder rows still answer the one before.
  if (query.term && query.data && !query.isPlaceholderData && query.term !== answeredTerm) {
    setAnsweredTerm(query.term)
  }
  const view: OmniView = mode === 'schedule-meeting' ? 'pick' : isDesktop ? 'stacks' : 'list'
  const state: OmniQueryState = {
    search,
    term,
    data,
    pending,
    busy: !!term && (pending || query.isFetching),
    failed: !!term && query.isError && !data,
    answeredTerm,
    retry: () => void query.refetch(),
  }

  return (
    <div className="contents" onFocus={event => setInContact(isInContactGroup(event.target as Element))}>
      <OmniInputRow
        busy={state.busy}
        chip={mode === 'schedule-meeting' ? OMNI_COPY.scheduleMeetingChip : undefined}
        value={search}
        onValueChange={setSearch}
        maxLength={OMNI_TERM_MAX}
        placeholder={mode === 'schedule-meeting' ? OMNI_COPY.pickCustomerPlaceholder : OMNI_COPY.placeholder}
        onKeyDown={(event) => {
          if (mode !== 'root' && event.key === 'Backspace' && search === '') {
            event.preventDefault()
            setMode('root')
            return
          }
          if (event.key === 'ArrowRight' && mode === 'root' && focusHighlightedContact(event.currentTarget)) {
            event.preventDefault()
          }
        }}
      />
      <CommandList className={OMNI_LIST_CLASS}>
        <OmniSearchResults
          state={state}
          view={view}
          onHighlight={onHighlight}
          onDone={onDone}
          onEnterMode={(next) => {
            setMode(next)
            setSearch('')
          }}
          onPickCustomer={onPickCustomer}
        />
      </CommandList>
      <OmniStatusFooter state={state} view={view} inContact={inContact} />
    </div>
  )
}

export const OmniSearchPanel = memo(OmniSearchPanelImpl)
