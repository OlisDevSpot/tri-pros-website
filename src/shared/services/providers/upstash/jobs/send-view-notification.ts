import { notificationService } from '@/shared/services/notification.service'

import { createJob } from '../lib/create-job'

export const sendViewNotificationJob = createJob(
  'send-view-notification',
  async (params: {
    proposalOwnerId: string
    proposalLabel: string
    proposalId: string
    customerName: string
    viewedAt: string
    source: string
  }) => {
    await notificationService.notifyProposalViewed(params)
  },
)
