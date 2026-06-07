import { parseAsStringLiteral } from 'nuqs'

export const CAMPAIGN_TABS = ['overview', 'leads', 'setup'] as const

export type CampaignTab = typeof CAMPAIGN_TABS[number]

export const campaignTabParser = parseAsStringLiteral(CAMPAIGN_TABS).withDefault('overview')
