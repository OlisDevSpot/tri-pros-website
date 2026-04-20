import type { Customer, Meeting } from '@/shared/db/schema'
import type { ProposalFormSchema } from '@/shared/entities/proposals/schemas'
import { getProgramByAccessor } from '@/features/meeting-flow/constants/programs'
import { computeDealFinalTcp } from '@/shared/entities/meetings/lib/compute-deal-derived'
import { proposalFormBaseDefaultValues } from '@/shared/entities/proposals/schemas'

export function buildProposalDefaults(
  meeting: Meeting,
  customer: Customer | null,
): ProposalFormSchema {
  const flowState = meeting.flowStateJSON
  const defaults = structuredClone(proposalFormBaseDefaultValues)

  if (!flowState) {
    return defaults
  }

  // Map trade selections → SOW entries
  if (flowState.tradeSelections && flowState.tradeSelections.length > 0) {
    defaults.project.data.sow = flowState.tradeSelections.map(ts => ({
      contentJSON: '',
      html: '',
      scopes: ts.selectedScopes.map(s => ({ id: s.id, label: s.label })),
      title: '',
      trade: { id: ts.tradeId, label: ts.tradeName },
      price: 0,
    }))
  }

  // Map deal structure → funding
  if (flowState.dealStructure) {
    const ds = flowState.dealStructure
    if (ds.startingTcp !== undefined) {
      defaults.funding.data.startingTcp = ds.startingTcp
    }
    if (ds.depositAmount !== undefined) {
      defaults.funding.data.depositAmount = ds.depositAmount
    }
    // Cash mode: seed cashInDeal with the meeting's derived final TCP.
    // Neither side stores finalTcp — both compute it on demand.
    if (ds.mode === 'cash') {
      defaults.funding.data.cashInDeal = computeDealFinalTcp(ds)
    }

    // Map incentives
    if (ds.incentives && ds.incentives.length > 0) {
      defaults.funding.data.incentives = ds.incentives.map(inc => ({
        type: 'discount' as const,
        amount: inc.amount,
        notes: `${inc.label} (${inc.source})`,
      }))
    }
  }

  // Map program expiration → valid through
  if (flowState.selectedProgram) {
    const program = getProgramByAccessor(flowState.selectedProgram)
    if (program) {
      defaults.project.data.validThroughTimeframe = '30 days'
    }
  }

  // Map pain points → project objectives
  if (flowState.tradeSelections) {
    const objectives = flowState.tradeSelections
      .flatMap(ts => ts.painPoints)
      .filter(Boolean)
      .map(pain => `Address: ${pain}`)
    if (objectives.length > 0) {
      defaults.project.data.projectObjectives = objectives
    }
  }

  // Set label from customer name
  if (customer?.name) {
    defaults.project.data.label = `${customer.name} — Proposal`
  }

  return defaults
}
