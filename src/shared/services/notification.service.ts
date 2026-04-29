import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { resendClient } from '@/shared/services/resend/client'
import { RESEND_FROM } from '@/shared/services/resend/constants'
import { renderProposalViewedEmail } from '@/shared/services/resend/lib/render-emails'
import { proposalViewedSubject } from '@/shared/services/resend/lib/subjects'

function createNotificationService() {
  return {
    notifyProposalViewed: async (params: {
      proposalOwnerId: string
      proposalLabel: string
      proposalId: string
      customerName: string
      viewedAt: string
      source: string
    }) => {
      const [owner] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, params.proposalOwnerId))
      if (!owner?.email) {
        return
      }

      const sourceLabels: Record<string, string> = {
        email: 'Opened from email link',
        sms: 'Opened from SMS link',
        direct: 'Opened directly',
        unknown: 'Opened directly',
      }
      const sourceLabel = sourceLabels[params.source] ?? 'Opened directly'

      const { error } = await resendClient.emails.send({
        from: RESEND_FROM.default,
        to: owner.email,
        subject: proposalViewedSubject(params.customerName),
        react: renderProposalViewedEmail({
          customerName: params.customerName,
          proposalLabel: params.proposalLabel,
          viewedAt: params.viewedAt,
          sourceLabel,
          proposalId: params.proposalId,
        }),
      })

      if (error) {
        console.error(`[notificationService] Failed to notify proposal viewed:`, error)
      }
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
export const notificationService = createNotificationService()
