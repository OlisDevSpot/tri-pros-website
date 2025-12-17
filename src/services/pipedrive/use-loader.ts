'use client'

import { useEffect } from 'react'

export function usePipedriveLeadBoosterBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined')
      return

    // Prevent double-init (Fast Refresh, etc.)
    if ((window as any).LeadBooster) {
      console.warn('LeadBooster already exists')
      return
    }

    (window as any).pipedriveLeadboosterConfig = {
      base: 'leadbooster-chat.pipedrive.com',
      companyId: 13995822,
      playbookUuid: 'a6a932fc-d22d-45e5-bc8c-39af1a236965',
      version: 2,
    };

    (window as any).LeadBooster = {
      q: [],
      on(n: string, h: unknown) {
        this.q.push({ t: 'o', n, h })
      },
      trigger(n: string) {
        this.q.push({ t: 't', n })
      },
    }
  }, [])

  return null
}
