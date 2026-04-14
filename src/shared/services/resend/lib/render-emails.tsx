import type { GeneralInquiryFormSchema, ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { GeneralInquiryEmail } from '@/shared/services/resend/emails/general-inquiry-email'
import { ProjectEmailTemplate } from '@/shared/services/resend/emails/project-inquiry-email'
import ProposalEmail from '@/shared/services/resend/emails/proposal-email'
import ProposalViewedEmail from '@/shared/services/resend/emails/proposal-viewed-email'

export function renderProposalEmail(params: {
  proposalUrl: string
  customerName: string
  message?: string
}) {
  return (
    <ProposalEmail
      proposalUrl={params.proposalUrl}
      customerName={params.customerName}
      repMessage={params.message}
    />
  )
}

export function renderScheduleConsultationEmail(data: ScheduleConsultationFormSchema) {
  return <ProjectEmailTemplate data={data} />
}

export function renderGeneralInquiryEmail(data: GeneralInquiryFormSchema) {
  return <GeneralInquiryEmail data={data} />
}

export function renderProposalViewedEmail(params: {
  customerName: string
  proposalLabel: string
  viewedAt: string
  sourceLabel: string
  proposalId: string
}) {
  return (
    <ProposalViewedEmail
      customerName={params.customerName}
      proposalLabel={params.proposalLabel}
      viewedAt={params.viewedAt}
      sourceLabel={params.sourceLabel}
      proposalId={params.proposalId}
    />
  )
}
