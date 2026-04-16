'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  UnplugIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { useTRPC } from '@/trpc/helpers'

export function IntegrationsSection() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: syncStatus, isLoading } = useQuery(
    trpc.scheduleRouter.sync.getSyncStatus.queryOptions(),
  )

  function invalidateSync() {
    queryClient.invalidateQueries({
      queryKey: trpc.scheduleRouter.sync.getSyncStatus.queryKey(),
    })
  }

  const connectCalendar = useMutation(
    trpc.scheduleRouter.sync.connectCalendar.mutationOptions({
      onSuccess: () => {
        toast.success('Google Calendar connected')
        invalidateSync()
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
        invalidateSync()
      },
      onError: () => {
        toast.error('Failed to disconnect')
      },
    }),
  )

  const resetCalendar = useMutation(
    trpc.scheduleRouter.sync.resetCalendar.mutationOptions({
      onSuccess: () => {
        toast.success('Calendar reset — fresh sync complete')
        invalidateSync()
      },
      onError: (err) => {
        toast.error(`Reset failed: ${err.message}`)
      },
    }),
  )

  const triggerSync = useMutation(
    trpc.scheduleRouter.sync.triggerSync.mutationOptions({
      onSuccess: () => {
        toast.success('Calendar synced')
        invalidateSync()
      },
      onError: () => {
        toast.error('Sync failed')
      },
    }),
  )

  const isPending = connectCalendar.isPending
    || disconnectCalendar.isPending
    || resetCalendar.isPending
    || triggerSync.isPending

  const connected = syncStatus?.connected ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Manage external service connections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Google Calendar */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <CalendarIcon className="size-4" />
            Google Calendar
          </Label>

          {isLoading
            ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )
            : connected
              ? (
                  <>
                    {/* Status */}
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2Icon className="size-4 text-emerald-500" />
                      <span className="text-emerald-600 font-medium">Connected</span>
                    </div>

                    {/* Calendar details */}
                    <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Calendar ID</span>
                        <span className="font-mono truncate max-w-48">{syncStatus?.calendarId?.split('@')[0]}</span>
                      </div>
                      {syncStatus?.channelExpiry && (
                        <div className="flex justify-between">
                          <span>Webhook expires</span>
                          <span>{new Date(syncStatus.channelExpiry).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerSync.mutate()}
                        disabled={isPending}
                      >
                        {triggerSync.isPending
                          ? <Loader2Icon className="size-3.5 animate-spin" />
                          : <RefreshCwIcon className="size-3.5" />}
                        Sync Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetCalendar.mutate()}
                        disabled={isPending}
                      >
                        {resetCalendar.isPending
                          ? <Loader2Icon className="size-3.5 animate-spin" />
                          : <RotateCcwIcon className="size-3.5" />}
                        Reset
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => disconnectCalendar.mutate()}
                        disabled={isPending}
                      >
                        {disconnectCalendar.isPending
                          ? <Loader2Icon className="size-3.5 animate-spin" />
                          : <UnplugIcon className="size-3.5" />}
                        Disconnect
                      </Button>
                    </div>
                  </>
                )
              : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <XCircleIcon className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Not connected</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Connect to sync meetings and activities with your Google Calendar.
                      A dedicated &quot;Tri Pros Schedule&quot; calendar will be created on your account.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => connectCalendar.mutate()}
                      disabled={isPending}
                    >
                      {connectCalendar.isPending
                        ? <Loader2Icon className="size-3.5 animate-spin" />
                        : <CalendarIcon className="size-3.5" />}
                      Connect Google Calendar
                    </Button>
                  </>
                )}
        </div>

        <Separator />

        {/* Placeholder for future integrations */}
        <div className="space-y-2 opacity-50">
          <Label>More Integrations</Label>
          <p className="text-sm text-muted-foreground">Additional integrations coming soon.</p>
        </div>
      </CardContent>
    </Card>
  )
}
