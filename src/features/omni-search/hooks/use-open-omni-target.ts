import type { OmniTarget } from '@/shared/domains/omni-search/schemas'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'

export function useOpenOmniTarget() {
  const router = useRouter()
  return useCallback((target: OmniTarget) => {
    if (target.kind === 'route') {
      router.push(target.href)
      return
    }
    openCustomerProfile({ customerId: target.customerId, defaultTab: target.defaultTab, highlightMeetingId: target.highlightMeetingId })
  }, [router])
}
