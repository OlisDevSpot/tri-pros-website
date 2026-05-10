'use client'

import { useMutation } from '@tanstack/react-query'
import { Bell, BellOff, CheckCircle2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { usePushSubscription } from '@/shared/hooks/use-push-subscription'
import { useTRPC } from '@/trpc/helpers'

// Standalone settings-style component. Renders the full state machine,
// not just the actionable case (unlike the banner). Drop into a settings
// page, profile sidebar, or anywhere a logged-in user might want to
// inspect/manage their notification subscription.
export function PushSubscriptionManager() {
  const trpc = useTRPC()
  const { status, error, subscribe, unsubscribe, busy } = usePushSubscription()

  const sendTest = useMutation(
    trpc.pushRouter.sendTestToSelf.mutationOptions({
      onSuccess: (result) => {
        if (result.delivered === 0) {
          toast.warning('Test sent to 0 devices — no active subscriptions')
        }
        else {
          toast.success(`Test sent to ${result.delivered} device${result.delivered === 1 ? '' : 's'}`)
        }
      },
      onError: (err) => {
        toast.error(`Test failed: ${err.message}`)
      },
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" aria-hidden />
          Push notifications
        </CardTitle>
        <CardDescription>
          {describeStatus(status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking subscription…
          </div>
        )}

        {status === 'not-subscribed' && (
          <Button onClick={subscribe} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Enable notifications
          </Button>
        )}

        {status === 'subscribed' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden />
              Subscribed on this device
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => sendTest.mutate({ navigate: '/dashboard' })}
                disabled={sendTest.isPending}
              >
                {sendTest.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send test
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={unsubscribe}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BellOff className="size-3.5" />}
                Disable
              </Button>
            </div>
          </div>
        )}

        {status === 'denied' && (
          <p className="text-xs text-foreground/60">
            Notifications are blocked. Open your browser/system settings for this site
            and re-allow notifications, then refresh.
          </p>
        )}

        {status === 'needs-install' && (
          <p className="text-xs text-foreground/60">
            iOS only delivers push notifications to installed PWAs. Tap the Share
            icon in Safari and choose "Add to Home Screen", then re-open this app
            from the home-screen icon.
          </p>
        )}

        {status === 'unsupported' && (
          <p className="text-xs text-foreground/60">
            This browser doesn't support web push notifications.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function describeStatus(status: ReturnType<typeof usePushSubscription>['status']): string {
  switch (status) {
    case 'subscribed':
      return 'You\'ll be notified about new leads, viewed proposals, and contract events.'
    case 'not-subscribed':
      return 'Stay on top of new activity even when the app is closed.'
    case 'needs-install':
      return 'Install the app to your home screen to enable push notifications.'
    case 'denied':
      return 'Notifications are blocked at the browser level.'
    case 'unsupported':
      return 'Web push isn\'t available here.'
    case 'loading':
      return 'Loading…'
    case 'error':
      return 'Something went wrong setting up push.'
  }
}
