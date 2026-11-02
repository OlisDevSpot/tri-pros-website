'use client'

import type { RefObject } from 'react'

import { SearchIcon, XIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/shared/components/ui/input-group'

interface ModifySearchRowProps {
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  onQuery: (query: string) => void
  // Applies the top result's value.
  onEnter: () => void
}

// Modify's head. The field focuses itself as it mounts: a switch from another section keeps the window's dialog, so the
// window's own opening focus does not run again.
export function ModifySearchRow({ inputRef, query, onQuery, onEnter }: ModifySearchRowProps) {
  const { shape } = useSceneVisibleArea()
  const { placeholder } = CONTROLS_COPY.modify

  return (
    <div data-modify-search className="shrink-0 px-3.5 py-3">
      <InputGroup className={CONTROLS_CLASSES.field}>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          autoFocus
          aria-label={CONTROLS_COPY.modify.search}
          placeholder={shape === 'portrait' ? placeholder.phone : placeholder.wide}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={event => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onEnter()
            }
          }}
          // 16 px, so iOS does not zoom the page as the field takes focus.
          className="h-full pr-2 text-base text-foreground md:text-base"
        />
        {query !== '' && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-sm"
              aria-label={CONTROLS_COPY.modify.clear}
              onClick={() => {
                onQuery('')
                inputRef.current!.focus()
              }}
              // The 32 px button reaches 40 px past its edge.
              className="relative rounded-lg text-muted-foreground after:absolute after:-inset-1 hover:bg-hover hover:text-foreground pressed:bg-press [&>svg]:size-3.75"
            >
              <XIcon aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}
