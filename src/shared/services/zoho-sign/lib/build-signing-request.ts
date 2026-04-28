import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { ZOHO_SIGN_TEMPLATES } from '../constants'

interface BuildOptions {
  /**
   * Page count of the attached SOW PDF. Required — the request body's
   * notes field references it so signers can confirm at-a-glance the
   * envelope's SOW pagination matches what they reviewed.
   */
  sowPages: number
}

export function buildSigningRequest(proposal: ProposalWithCustomer, { sowPages }: BuildOptions) {
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
        notes: `Scope of Work attached as a separate document (${sowPages} ${sowPages === 1 ? 'page' : 'pages'}).`,
      },
    },
  }
}
