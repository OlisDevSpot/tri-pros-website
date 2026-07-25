import { createLoader, parseAsStringLiteral } from 'nuqs/server'

export const CAMPAIGN_TABS = ['overview', 'leads', 'setup'] as const

export type CampaignTab = typeof CAMPAIGN_TABS[number]

export const campaignTabParser = parseAsStringLiteral(CAMPAIGN_TABS).withDefault('overview')

/** Server-side mirror of the `tab` URL state — lets page.tsx prefetch only the active tab's queries. */
export const loadCampaignsSearchParams = createLoader({ tab: campaignTabParser })
