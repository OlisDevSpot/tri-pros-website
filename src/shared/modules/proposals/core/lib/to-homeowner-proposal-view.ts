import type { AppAbility } from '@/shared/domains/permissions/types'
import type { ProposalWithCustomer } from '@/shared/modules/proposals/core/dal/server/queries'
import type { ProjectSection } from '@/shared/modules/proposals/core/types'

import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import 'server-only'

/** The scope of work without our job costs: the homeowner sees section prices, never what the work costs us. */
export function withoutCostLines(projectJSON: ProjectSection): ProjectSection {
  return {
    ...projectJSON,
    data: {
      ...projectJSON.data,
      sow: projectJSON.data.sow.map(section => ({ ...section, financials: { ...section.financials, costLines: [] } })),
    },
  }
}

/**
 * What leaves to a reader who may not see the raw scope of work: the columns their read rule lists,
 * their own contact details (the page asks them to confirm these), the incentives and the homeowner gallery,
 * and the scope of work without cost lines. Staff get the view unchanged.
 */
export function toHomeownerProposalView(ability: AppAbility, view: ProposalWithCustomer): ProposalWithCustomer {
  if (ability.can('read', 'Proposal', 'projectJSON')) {
    return view
  }
  const { customer, incentives, media, meetingProjectId: _meetingProjectId, projectFirstContractSentAt: _contractSentAt, ...columns } = view
  return {
    ...projectToReadFields(ability, proposalServerSpec, columns, columns),
    customer,
    incentives,
    media,
    projectJSON: withoutCostLines(view.projectJSON),
  } as ProposalWithCustomer
}
