'use client'

import { useMutation } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

export function NotionRefreshButton() {
  const trpc = useTRPC()
  const ability = useAbility()

  const revalidate = useMutation(
    trpc.notionRouter.revalidateNotionCache.mutationOptions({
      onSuccess: () => {
        toast.success('Cache refreshed')
      },
      onError: () => {
        toast.error('Failed to refresh cache')
      },
    }),
  )

  if (ability.cannot('update', 'Project')) {
    return null
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => revalidate.mutate()}
      disabled={revalidate.isPending}
      className="fixed top-4 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity"
      aria-label="Refresh Notion cache"
    >
      <RefreshCw
        className={cn('size-4', revalidate.isPending && 'animate-spin')}
      />
    </Button>
  )
}
