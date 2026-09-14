import { notificationService } from '@/shared/services/notification.service'

import { createJob } from '../lib/create-job'

export const sendViewNotificationJob = createJob(
  'send-view-notification',
  async (params: {
    /** The proposal's meeting participants — resolved by the dispatcher (`views.router.ts:recordView`). */
    recipientUserIds: string[]
    proposalLabel: string
    proposalId: string
    customerName: string
    viewedAt: string
    source: string
  }) => {
    await notificationService.notifyProposalViewed(params)
  },
)
