'use client'

import { Bell, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { usePushSubscription } from '@/shared/hooks/use-push-subscription'

const DISMISS_KEY = 'push-banner-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isDismissed(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  const dismissed = localStorage.getItem(DISMISS_KEY)
  if (!dismissed) {
    return false
  }
  const dismissedAt = Number.parseInt(dismissed, 10)
  if (Number.isNaN(dismissedAt) || Date.now() - dismissedAt > DISMISS_DURATION_MS) {
    localStorage.removeItem(DISMISS_KEY)
    return false
  }
  return true
}

// Top-of-dashboard banner that nudges authenticated users to enable push
// notifications. Renders only when there's a meaningful action — installed
// PWA without a subscription. Hidden in unsupported browsers and after
// subscribing successfully. Dismissible with a 7-day cooldown.
export function PushSubscriptionBanner() {
  const { status, subscribe, busy, error } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true)

  // Defer the dismiss check to mount so SSR matches the hidden initial state.
  useEffect(() => {
    setDismissed(isDismissed())
  }, [])

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setDismissed(true)
  }

  async function handleEnable() {
    await subscribe()
    if (error === null) {
      toast.success('Notifications enabled')
    }
  }

  // Only render for the actionable state. Unsupported / needs-install /
  // denied / loading / error all stay quiet — the standalone manager
  // surfaces those states for users who explicitly visit a settings page.
  const visible = !dismissed && status === 'not-subscribed'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mx-3 mt-3 flex items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/2 px-3 py-2.5 sm:mx-4 sm:px-4"
        >
          <Bell className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Get notified about new leads and proposal activity
            </p>
            <p className="mt-0.5 text-xs text-foreground/60">
              We'll send a push when something needs your attention.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleEnable}
            disabled={busy}
            className="shrink-0"
          >
            {busy ? 'Enabling…' : 'Enable'}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-foreground/40 transition-colors hover:text-foreground/70"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
