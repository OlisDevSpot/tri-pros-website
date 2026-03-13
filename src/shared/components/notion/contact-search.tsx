'use client'

import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { useTRPC } from '@/trpc/helpers'

interface NotionContactSearchProps {
  value: string
  onSelect: (id: string, name: string) => void
  onClear: () => void
}

export function NotionContactSearch({ value, onSelect, onClear }: NotionContactSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const trpc = useTRPC()

  const searchQuery = useQuery(
    trpc.notionRouter.contacts.getByQuery.queryOptions(
      { filterProperty: 'name', query },
      { enabled: false },
    ),
  )

  function handleSearch() {
    void searchQuery.refetch()
  }

  function handleClear() {
    setQuery('')
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          className="h-9 max-w-56 text-sm"
          placeholder="Search by name…"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button size="sm" type="button" onClick={handleSearch}>
          Search
        </Button>
        {value && (
          <Button
            className="gap-1.5"
            size="sm"
            type="button"
            variant="outline"
            onClick={handleClear}
          >
            <XIcon className="size-3.5" />
            Clear
          </Button>
        )}
        {searchQuery.isLoading && <SpinnerLoader2 size={16} />}
      </div>

      {searchQuery.data?.allPages && searchQuery.data.allPages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery.data.allPages.map((page) => {
            const contact = pageToContact(page)
            return (
              <Badge
                className="cursor-pointer text-sm"
                key={page.id}
                variant={value === page.id ? 'default' : 'outline'}
                onClick={() => onSelect(page.id, contact.name)}
              >
                {contact.name}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
