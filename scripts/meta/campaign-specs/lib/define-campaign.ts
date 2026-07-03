import type { CampaignSpec, CampaignSpecInput } from './types.js'
import { campaignSpecSchema } from './types.js'

export function defineCampaign(input: CampaignSpecInput): CampaignSpec {
  return campaignSpecSchema.parse(input)
}
