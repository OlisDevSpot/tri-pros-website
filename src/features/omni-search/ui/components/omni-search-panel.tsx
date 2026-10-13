'use client'

import type { OmniMode, OmniPickedCustomer } from '@/features/omni-search/types'

import { useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OmniSearchResults } from '@/features/omni-search/ui/components/omni-search-results'
import { CommandInput, CommandList } from '@/shared/components/ui/command'
import { OMNI_TERM_MAX } from '@/shared/domains/omni-search/schemas'

interface Props {
  onHighlight: (value: string) => void
  onDone: () => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

// Lives inside the dialog content, which unmounts on close, so every open starts with an empty term at the root.
export function OmniSearchPanel({ onHighlight, onDone, onPickCustomer }: Props) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<OmniMode>('root')

  return (
    <>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        maxLength={OMNI_TERM_MAX}
        placeholder={mode === 'schedule-meeting' ? OMNI_COPY.pickCustomerPlaceholder : OMNI_COPY.placeholder}
        onKeyDown={(event) => {
          if (mode !== 'root' && event.key === 'Backspace' && search === '') {
            event.preventDefault()
            setMode('root')
          }
        }}
      />
      <CommandList>
        <OmniSearchResults
          search={search}
          mode={mode}
          onHighlight={onHighlight}
          onDone={onDone}
          onEnterMode={(next) => {
            setMode(next)
            setSearch('')
          }}
          onPickCustomer={onPickCustomer}
        />
      </CommandList>
    </>
  )
}
