import type { GeneralInquiryFormSchema, ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import type { CustomerConfirmationEmailProps } from '@/shared/services/providers/resend/emails/customer-confirmation-email'
import { CustomerConfirmationEmail } from '@/shared/services/providers/resend/emails/customer-confirmation-email'
import { GeneralInquiryEmail } from '@/shared/services/providers/resend/emails/general-inquiry-email'
import MoveForwardRequestEmail from '@/shared/services/providers/resend/emails/move-forward-request-email'
import { NewLeadEmail } from '@/shared/services/providers/resend/emails/new-lead-email'
import { ProjectEmailTemplate } from '@/shared/services/providers/resend/emails/project-inquiry-email'
import ProposalEmail from '@/shared/services/providers/resend/emails/proposal-email'
import ProposalViewedEmail from '@/shared/services/providers/resend/emails/proposal-viewed-email'

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

export function renderCustomerConfirmationEmail(params: CustomerConfirmationEmailProps) {
  return <CustomerConfirmationEmail {...params} />
}

export function renderMoveForwardRequestEmail(params: {
  customerName: string
  proposalLabel: string
  proposalId: string
}) {
  return (
    <MoveForwardRequestEmail
      customerName={params.customerName}
      proposalLabel={params.proposalLabel}
      proposalId={params.proposalId}
    />
  )
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

export function renderNewLeadEmail(params: {
  name: string
  phone: string | null
  city: string | null
  zip: string | null
  source: string
  dashboardUrl: string
}) {
  return (
    <NewLeadEmail
      name={params.name}
      phone={params.phone}
      city={params.city}
      zip={params.zip}
      source={params.source}
      dashboardUrl={params.dashboardUrl}
    />
  )
}
