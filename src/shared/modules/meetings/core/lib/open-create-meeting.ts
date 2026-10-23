import type { ComponentProps } from 'react'

import { CreateMeetingLayer } from '@/shared/entities/meetings/components/create-meeting-layer'
import { openModal } from '@/shared/lib/open-modal'

/** Opens the new-meeting modal from anywhere; the one place that names its modal accessor. */
export function openCreateMeeting(props: ComponentProps<typeof CreateMeetingLayer>) {
  openModal({ accessor: 'CreateMeeting', Component: CreateMeetingLayer, props })
}
