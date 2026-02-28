import type { Proposal } from '@/shared/db/schema/proposals'
import env from '@/shared/config/server-env'

const TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production' ? '2af86be0-9799-462c-9af9-d89c17b56de9' : '6a8da4cb-db4d-44b7-a956-82bc4f0590e9',
  senior: env.NODE_ENV === 'production' ? '540e4a68-ceeb-4d9b-ac84-88b50761ea6e' : '73cf3127-327d-4cdd-949b-ea8d670d2dd6',
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function extractSowText(proposal: Proposal): string {
  return proposal.projectJSON.data.sow
    .map(item => `${item.title}\n${stripHtml(item.html)}`)
    .join('\n\n')
}

export function buildEnvelopeBody(proposal: Proposal, status: 'created' | 'sent') {
  const { homeownerJSON, projectJSON, fundingJSON } = proposal
  const { data: homeowner } = homeownerJSON
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  const isSenior = (homeowner.age ?? 0) >= 62
  const templateId = isSenior ? TEMPLATE_IDS.senior : TEMPLATE_IDS.base

  const sowText = extractSowText(proposal)
  const sow1 = sowText.slice(0, 2000)
  const sow2 = sowText.slice(2000, 6000)

  return {
    templateId,
    status,
    templateRoles: [
      {
        roleName: 'Contractor',
        tabs: {
          textTabs: [
            { tabLabel: 'start-date', value: '' },
            { tabLabel: 'completion-date', value: '' },
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
        name: homeowner.name,
        email: homeowner.email,
        tabs: {
          textTabs: [
            { tabLabel: 'ho-address', value: project.address },
            { tabLabel: 'ho-city-state-zip', value: `${project.city}, CA ${project.zip}` },
            { tabLabel: 'ho-phone', value: homeowner.phoneNum },
          ],
          numberTabs: [
            { tabLabel: 'ho-age', numericalValue: String(homeowner.age ?? 0) },
          ],
        },
      },
    ],
  }
}
