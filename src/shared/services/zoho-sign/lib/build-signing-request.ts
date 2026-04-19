import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { ZOHO_SIGN_TEMPLATES } from '../constants'

export function buildSigningRequest(proposal: ProposalWithCustomer) {
  const { customer, projectJSON, fundingJSON } = proposal
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  if (customer?.customerAge == null) {
    throw new Error('Customer age is required before creating a signing request. CSLB regulations require age-based template selection.')
  }

  const customerName = customer.name ?? ''
  const customerEmail = customer.email ?? ''
  const customerPhone = customer.phone ?? ''
  const customerAddress = customer.address ?? ''
  const customerCity = customer.city ?? ''
  const customerState = customer.state ?? 'CA'
  const customerZip = customer.zip ?? ''

  const isSenior = customer.customerAge >= 65
  const { templateId, actions: actionIds } = isSenior ? ZOHO_SIGN_TEMPLATES.senior : ZOHO_SIGN_TEMPLATES.base

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
            'ho-name': customerName,
            'ho-email': customerEmail,
            'ho-age': String(customer.customerAge),
            'start-date': startDate.toLocaleDateString(),
            'completion-date': completionDate.toLocaleDateString(),
            'sow-1': sow1,
            'sow-2': sow2,
            'tcp': String(computeFinalTcp(funding)),
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
