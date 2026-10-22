import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'

export function deepMergeFormDefaults(base: ProposalFormSchema, override: OverrideProposalValues = {}): ProposalFormSchema {
  if (Object.keys(override).length === 0) {
    return base
  }

  return {
    ...base,
    ...(override.priceDisplayMode ? { priceDisplayMode: override.priceDisplayMode } : {}),
    project: { ...base.project, ...(override.project ?? {}) },
    funding: { ...base.funding, ...(override.funding ?? {}) },
  }
}
