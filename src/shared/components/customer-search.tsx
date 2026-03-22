'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon, SearchIcon, XIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTRPC } from '@/trpc/helpers'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface CustomerSearchProps {
  onSelect: (id: string, name: string) => void
  onClear: () => void
  prefillCustomerId?: string
}

export function CustomerSearch({ onSelect, onClear, prefillCustomerId }: CustomerSearchProps) {
  const trpc = useTRPC()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const prefillHandledRef = useRef(false)

  // Pre-populated mode: fetch customer by ID on mount
  const prefillQuery = useQuery(
    trpc.customersRouter.getById.queryOptions(
      { customerId: prefillCustomerId ?? '' },
      { enabled: !!prefillCustomerId && !selectedId },
    ),
  )

  // Derive prefill into state without useEffect — handle on first render where data is available
  if (prefillQuery.data && !selectedId && !prefillHandledRef.current) {
    prefillHandledRef.current = true
    setSelectedId(prefillQuery.data.id)
    setSelectedName(prefillQuery.data.name)
    onSelect(prefillQuery.data.id, prefillQuery.data.name)
  }

  const searchQuery = useQuery(
    trpc.customersRouter.search.queryOptions(
      { query },
      { enabled: query.length >= 2 && !selectedId },
    ),
  )

  const handleSelect = useCallback((id: string, name: string) => {
    setSelectedId(id)
    setSelectedName(name)
    setQuery('')
    onSelect(id, name)
  }, [onSelect])

  function handleClear() {
    setSelectedId('')
    setSelectedName('')
    setQuery('')
    onClear()
  }

  if (selectedId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <CheckIcon className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">{selectedName}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={handleClear}>
          <XIcon className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-1">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name or phone…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {query.length >= 2 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          {searchQuery.isLoading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}
          {searchQuery.data?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No customers found.</p>
          )}
          {searchQuery.data?.map(c => (
            <button
              key={c.id}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => handleSelect(c.id, c.name)}
            >
              <span className="text-sm font-medium">{c.name}</span>
              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
