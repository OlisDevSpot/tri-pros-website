'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudIcon, CloudOffIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { useTRPC } from '@/trpc/helpers'

export function SyncStatusBadge() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: syncStatus } = useQuery(
    trpc.scheduleRouter.sync.getSyncStatus.queryOptions(),
  )

  const connectCalendar = useMutation(
    trpc.scheduleRouter.sync.connectCalendar.mutationOptions({
      onSuccess: () => {
        toast.success('Google Calendar connected')
        queryClient.invalidateQueries({
          queryKey: trpc.scheduleRouter.sync.getSyncStatus.queryKey(),
        })
      },
      onError: (err) => {
        toast.error(`Failed to connect: ${err.message}`)
      },
    }),
  )

  const disconnectCalendar = useMutation(
    trpc.scheduleRouter.sync.disconnectCalendar.mutationOptions({
      onSuccess: () => {
        toast.success('Google Calendar disconnected')
        queryClient.invalidateQueries({
          queryKey: trpc.scheduleRouter.sync.getSyncStatus.queryKey(),
        })
      },
      onError: () => {
        toast.error('Failed to disconnect')
      },
    }),
  )

  if (!syncStatus) {
    return null
  }

  const isPending = connectCalendar.isPending || disconnectCalendar.isPending

  if (syncStatus.connected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => disconnectCalendar.mutate()}
            disabled={isPending}
          >
            {isPending
              ? <Loader2Icon size={14} className="animate-spin" />
              : <CloudIcon size={14} className="text-emerald-500" />}
            <span className="hidden sm:inline text-emerald-600">Synced</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Click to disconnect Google Calendar</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => connectCalendar.mutate()}
          disabled={isPending}
        >
          {isPending
            ? <Loader2Icon size={14} className="animate-spin" />
            : <CloudOffIcon size={14} className="text-muted-foreground" />}
          <span className="hidden sm:inline">Connect Calendar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Click to connect Google Calendar</TooltipContent>
    </Tooltip>
  )
}
