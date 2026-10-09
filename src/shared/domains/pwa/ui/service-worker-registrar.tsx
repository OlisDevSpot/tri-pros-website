'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/shared/domains/pwa/lib/register-service-worker'

/** Registers (or removes) the worker as soon as the document is up; the push hook shares the registration. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker().catch(() => null)
  }, [])
  return null
}
