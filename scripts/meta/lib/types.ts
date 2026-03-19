// scripts/meta/lib/types.ts

/** Shape of the raw error envelope returned by the Meta Graph API. */
export interface MetaApiErrorResponse {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

export interface Campaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
}

export interface AdSet {
  id: string
  name: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  daily_budget: string
  targeting: Record<string, unknown>
  start_time: string
}

export interface Ad {
  id: string
  name: string
  adset_id: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  created_time: string
}

export interface Insight {
  campaign_id: string
  campaign_name: string
  spend: string
  impressions: string
  clicks: string
  cpm: string
  cpc: string
  date_start: string
  date_stop: string
}

export interface MetaPaginatedResponse<T> {
  data: T[]
  paging?: {
    cursors?: { before: string; after: string }
    next?: string
  }
}
