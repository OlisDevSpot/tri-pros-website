import type { OmniTarget } from '@/shared/domains/omni-search/schemas'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'

export function useOpenOmniTarget() {
  const router = useRouter()
  return useCallback((target: OmniTarget) => {
    if (target.kind === 'route') {
      router.push(target.href)
      return
    }
    openModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: target.customerId, defaultTab: target.defaultTab, highlightMeetingId: target.highlightMeetingId },
    })
  }, [router])
}
