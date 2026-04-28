import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { ZOHO_SIGN_TEMPLATES } from '../constants'
import { isLongSow } from './is-long-sow'
import { packSowText } from './pack-sow-text'

interface BuildOptions {
  /** Explicit path override. Defaults to auto-detection via isLongSow. */
  mode?: 'short' | 'long'
  /** Required when mode === 'long'; used in sow-1 pointer text. */
  sowPages?: number
}

export function buildSigningRequest(proposal: ProposalWithCustomer, options: BuildOptions = {}) {
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
  const mode = options.mode ?? (isLongSow(sowText) ? 'long' : 'short')

  let sow1: string
  let sow2: string
  if (mode === 'long') {
    const pages = options.sowPages
    if (pages == null) {
      throw new Error('buildSigningRequest: sowPages required in long mode')
    }
    sow1 = `See attached Scope of Work document (${pages} ${pages === 1 ? 'page' : 'pages'}) — full details of the Proposed Scope of Work.`
    sow2 = ''
  }
  else {
    const packed = packSowText(sowText)
    if (packed.overflow > 0) {
      throw new Error(`buildSigningRequest: unexpected overflow (${packed.overflow} chars) on short path — route to long path`)
    }
    sow1 = packed.sow1
    sow2 = packed.sow2
  }

  const validThroughTimeframe = Number(project.validThroughTimeframe.replace(/\D/g, ''))
  const startDate = new Date()
  const completionDate = new Date()
  const daysToAdd = 3
  startDate.setDate(startDate.getDate() + daysToAdd)
  completionDate.setDate(startDate.getDate() + validThroughTimeframe)

  return {
    templateId,
    mode,
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
