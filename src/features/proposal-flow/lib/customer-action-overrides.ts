import { CreateMeetingLayer } from '@/features/proposal-flow/ui/components/cockpit/create-meeting-layer'
import { openModal } from '@/shared/lib/open-modal'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'

// The defaults navigate to the pipeline; beside a proposal the agent wants the profile and the meeting form in place.
export const PROPOSAL_CUSTOMER_OVERRIDES = {
  onView: (customer: { id: string }) => openCustomerProfile({ customerId: customer.id }),
  onScheduleMeeting: (customer: { id: string, name: string }) => openModal({
    accessor: 'CreateMeeting',
    Component: CreateMeetingLayer,
    props: { customerId: customer.id, customerName: customer.name },
  }),
}
