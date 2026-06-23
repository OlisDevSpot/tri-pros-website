/** Graph API version pinned for the Conversions API. Bump deliberately. */
export const META_GRAPH_VERSION = 'v21.0'
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/** Standard + custom Meta event names. Values are Meta's canonical strings. */
export const META_EVENT = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  Lead: 'Lead',
  Schedule: 'Schedule',
  CompleteRegistration: 'CompleteRegistration',
  // phase 2 (custom events) — declared now for one source of truth:
  Contact: 'Contact',
  MeetingComplete: 'MeetingComplete',
  ProposalSent: 'ProposalSent',
  Purchase: 'Purchase',
} as const

export type MetaEventName = (typeof META_EVENT)[keyof typeof META_EVENT]

/** action_source for events that originate on the website/server. */
export const META_ACTION_SOURCE = {
  website: 'website',
  systemGenerated: 'system_generated',
} as const
