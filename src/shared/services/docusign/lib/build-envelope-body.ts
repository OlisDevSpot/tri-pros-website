import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import env from '@/shared/config/server-env'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'

const TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production' ? 'b76894d0-c2bf-4b7a-97bb-b69653314f1d' : '6a8da4cb-db4d-44b7-a956-82bc4f0590e9',
  senior: env.NODE_ENV === 'production' ? '540e4a68-ceeb-4d9b-ac84-88b50761ea6e' : '73cf3127-327d-4cdd-949b-ea8d670d2dd6',
}

export function buildEnvelopeBody(proposal: ProposalWithCustomer, status: 'created' | 'sent') {
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

  // Age is in the customer profile JSON — for DocuSign template selection
  // We don't have age readily available here, so default to base template
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
    status,
    templateRoles: [
      {
        roleName: 'Contractor',
        tabs: {
          textTabs: [
            { tabLabel: 'start-date', value: startDate.toLocaleDateString() },
            { tabLabel: 'completion-date', value: completionDate.toLocaleDateString() },
            { tabLabel: 'sow-1', value: sow1 },
            { tabLabel: 'sow-2', value: sow2 },
          ],
          numericalTabs: [
            { tabLabel: 'tcp', numericalValue: String(funding.finalTcp) },
            { tabLabel: 'deposit', numericalValue: String(funding.depositAmount) },
          ],
        },
      },
      {
        roleName: 'Homeowner',
        name: customerName,
        email: customerEmail,
        tabs: {
          textTabs: [
            { tabLabel: 'ho-address', value: customerAddress },
            { tabLabel: 'ho-city-state-zip', value: `${customerCity}, ${customerState} ${customerZip}` },
            { tabLabel: 'ho-phone', value: customerPhone },
          ],
        },
      },
    ],
  }
}
