import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { SowFinancials } from '@/shared/modules/proposals/core/schemas'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'

type SowSection = ProposalFormSchema['project']['data']['sow'][number]

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function fin({ sectionPrice, incentives = [] }: { sectionPrice: number | null, incentives?: number[] }): SowFinancials {
  return {
    sectionPrice,
    costLines: [],
    incentives: incentives.map((amount, i) => ({ id: uuid(i + 1), label: 'Incentive', amount })),
  }
}

export function sec(sectionPrice: number | null, incentives: number[] = []): SowSection {
  return { ...structuredClone(baseDefaultValues.project.data.sow[0]), financials: fin({ sectionPrice, incentives }) }
}

export function values({ sow, misc = 0, discounts = [], startingTcp }: {
  sow: SowSection[]
  misc?: number
  discounts?: number[]
  startingTcp?: number
}): Pick<ProposalFormSchema, 'funding'> & { sow: SowSection[] } {
  const synced = sow.reduce((sum, s) => sum + (s.financials.sectionPrice ?? 0), 0) + misc
  return {
    sow,
    funding: {
      ...baseDefaultValues.funding,
      miscPrice: misc,
      startingTcp: startingTcp ?? synced,
      incentives: discounts.map(amount => ({ type: 'discount' as const, amount })),
    },
  }
}
