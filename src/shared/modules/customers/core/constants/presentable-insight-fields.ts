import type { KeyInsightField } from '@/shared/entities/customers/components/profile/customer-profile-key-insights'

// Shown with the homeowner looking at the screen: never household type, nor the trigger event, whose "Selling soon" reveals a selling plan.
export const PRESENTABLE_INSIGHT_FIELDS = ['timeInHome', 'yearBuilt', 'outcomePriority', 'decisionTimeline'] as const satisfies readonly KeyInsightField[]
