'use client'

import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { useModalLayer } from '@/shared/hooks/use-modal-layer'

// The modal's other hosts render it inline, outside any layer, so the layer is read here rather than inside it.
export function CreateMeetingLayer({ customerId, customerName }: { customerId: string, customerName: string }) {
  const { isOpen, close } = useModalLayer()
  return <CreateMeetingModal isOpen={isOpen} onClose={close} customerId={customerId} customerName={customerName} />
}
