'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, LinkIcon, Loader2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { useTRPC } from '@/trpc/helpers'

export function IntakeShareLinks() {
  const trpc = useTRPC()
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const { data: sources, isLoading } = useQuery(
    trpc.intakeRouter.getActiveSources.queryOptions(),
  )

  const copyLink = useCallback((slug: string, name: string) => {
    const url = `${window.location.origin}/intake?source=${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    toast.success(`Copied ${name} link`)
    setTimeout(() => setCopiedSlug(null), 2000)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LinkIcon className="size-4" />
          Share Form Links
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Copy intake form link</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {sources?.map(source => (
          <DropdownMenuItem
            key={source.slug}
            onClick={() => copyLink(source.slug, source.name)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{source.name}</span>
            {copiedSlug === source.slug
              ? <CheckIcon className="size-4 shrink-0 text-green-500" />
              : <CopyIcon className="size-4 shrink-0 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
        {sources?.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No active lead sources found.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
