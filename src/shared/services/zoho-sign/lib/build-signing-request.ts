import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import env from '@/shared/config/server-env'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'

const TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production'
    ? 'ZOHO_PROD_BASE_TEMPLATE_ID'
    : 'ZOHO_DEV_BASE_TEMPLATE_ID',
  senior: env.NODE_ENV === 'production'
    ? 'ZOHO_PROD_SENIOR_TEMPLATE_ID'
    : 'ZOHO_DEV_SENIOR_TEMPLATE_ID',
}

export function buildSigningRequest(
  proposal: ProposalWithCustomer,
  quickSend: boolean,
) {
  const { customer, projectJSON, fundingJSON } = proposal
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  const customerName = customer?.name ?? ''
  const customerEmail = customer?.email ?? ''
  const customerPhone = customer?.phone ?? ''
  const customerAddress = customer?.address ?? ''
  const customerCity = customer?.city ?? ''
  const customerState = customer?.state ?? 'CA'
  const customerZip = customer?.zip ?? ''

  const templateId = TEMPLATE_IDS.base

  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  const sow1 = sowText.slice(0, 2000)
  const sow2 = sowText.slice(2000, 6000)

  const validThroughTimeframe = Number(project.validThroughTimeframe.replace(/\D/g, ''))
  const startDate = new Date()
  const completionDate = new Date()
  const daysToAdd = 3
  startDate.setDate(startDate.getDate() + daysToAdd)
  completionDate.setDate(startDate.getDate() + validThroughTimeframe)

  return {
    templateId,
    body: {
      templates: {
        field_data: {
          field_text_data: {
            'start-date': startDate.toLocaleDateString(),
            'completion-date': completionDate.toLocaleDateString(),
            'sow-1': sow1,
            'sow-2': sow2,
            'tcp': String(funding.finalTcp),
            'deposit': String(funding.depositAmount),
            'ho-address': customerAddress,
            'ho-city-state-zip': `${customerCity}, ${customerState} ${customerZip}`,
            'ho-phone': customerPhone,
          },
          field_boolean_data: {},
          field_date_data: {},
        },
        actions: [
          {
            action_type: 'SIGN',
            recipient_name: customerName,
            recipient_email: customerEmail,
            verify_recipient: true,
            verification_type: 'EMAIL',
          },
        ],
        notes: '',
      },
      is_quicksend: quickSend,
    },
  }
}
