import type { CampaignSpec } from './lib/types.js'
import { bathroomsCampaign } from './bathrooms.campaign.js'
import { kitchensCampaign } from './kitchens.campaign.js'

export const CAMPAIGN_SPECS: CampaignSpec[] = [kitchensCampaign, bathroomsCampaign]
