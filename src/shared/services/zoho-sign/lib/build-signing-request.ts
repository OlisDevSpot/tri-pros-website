import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { ZOHO_SIGN_TEMPLATE_IDS } from '../constants'

/** Action IDs from Zoho Sign templates — fixed per template */
const TEMPLATE_ACTION_IDS = {
  base: {
    contractor: '563034000000046252',
    homeowner: '563034000000046258',
  },
  senior: {
    contractor: '563034000000046434',
    homeowner: '563034000000046453',
  },
}

export function buildSigningRequest(proposal: ProposalWithCustomer) {
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

  const templateId = ZOHO_SIGN_TEMPLATE_IDS.base
  const actionIds = TEMPLATE_ACTION_IDS.base

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
            action_id: actionIds.contractor,
            action_type: 'SIGN',
            role: 'Contractor',
            recipient_name: 'Tri Pros Remodeling',
            recipient_email: 'info@triprosremodeling.com',
            verify_recipient: false,
          },
          {
            action_id: actionIds.homeowner,
            action_type: 'SIGN',
            role: 'Homeowner',
            recipient_name: customerName,
            recipient_email: customerEmail,
            verify_recipient: true,
            verification_type: 'EMAIL',
          },
        ],
        notes: '',
      },
    },
  }
}
