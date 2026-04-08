import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { resendClient } from '@/shared/services/resend/client'
import ProposalViewedEmail from '@/shared/services/resend/emails/proposal-viewed-email'

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
      const [owner] = await db.select().from(user).where(eq(user.id, params.proposalOwnerId))
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

      await resendClient.emails.send({
        from: 'Tri Pros System <info@triprosremodeling.com>',
        to: owner.email,
        subject: `🔔 ${params.customerName} just opened their proposal`,
        react: (
          <ProposalViewedEmail
            customerName={params.customerName}
            proposalLabel={params.proposalLabel}
            viewedAt={params.viewedAt}
            sourceLabel={sourceLabel}
            proposalId={params.proposalId}
          />
        ),
      })
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
export const notificationService = createNotificationService()
