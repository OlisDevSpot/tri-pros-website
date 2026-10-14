import type { ComponentProps } from 'react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'

/** Opens the customer profile modal from anywhere; the one place that names its modal accessor. */
export function openCustomerProfile(props: ComponentProps<typeof CustomerProfileModal>) {
  openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props })
}
