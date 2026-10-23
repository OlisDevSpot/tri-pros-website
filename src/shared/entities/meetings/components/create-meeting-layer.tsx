'use client'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useModalLayer } from '@/shared/hooks/use-modal-layer'

import { CreateMeetingModal } from './create-meeting-modal'

// The modal's other hosts render it inline, outside any layer, so the layer is read here rather than inside it.
export function CreateMeetingLayer({ customerId, customerName }: { customerId: string, customerName: string }) {
  const { isOpen, close } = useModalLayer()
  const { invalidateMeeting } = useInvalidation()
  return (
    <CreateMeetingModal
      isOpen={isOpen}
      onClose={close}
      onSuccess={() => invalidateMeeting({ customerId })}
      customerId={customerId}
      customerName={customerName}
    />
  )
}
