/**
 * Graph API version pinned for the Conversions API. Bump deliberately.
 *
 * The CAPI `/{dataset}/events` payload we send (event_name, event_time,
 * event_id, action_source, user_data, custom_data) is stable across all
 * versions ≥ v17.0, so a bump is low-risk — but Meta sunsets each version ~2yr
 * after release, after which calls hard-fail. Latest GA is ~v25.0; we hold one
 * notch back (v23.0) for a long runway without riding the newest edge.
 */
export const META_GRAPH_VERSION = 'v23.0'
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
