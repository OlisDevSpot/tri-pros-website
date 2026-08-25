import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'

// Neutral dialer-provider contract. Shaped around the operations we perform, not
// any vendor's endpoints. JustCall (or a future provider) implements this;
// consumers in services/voip/campaigns/* depend ONLY on this interface (via the
// `../dialer` barrel binding), never on providers/justcall/* directly.
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md

export type DialerMode = 'autodial' | 'dynamic' | 'predictive'

export interface NeutralField {
  appKey: string
  value?: string
  providerFieldId?: string
  label?: string
}

export interface NeutralCampaign {
  providerCampaignId: string
  name: string
  dialerMode: DialerMode
  status: 'active' | 'inactive'
}

// ── Canonical inbound events (adapter output; provider-agnostic) ─────────────
// The WebhookAdapter normalizes each provider's raw payloads into this union so
// the route + reacting services never learn which dialer is live.
export type CanonicalDialerEvent
  = | {
    type: 'call.ended'
    callUuid: string
    providerContactId?: string
    direction?: 'inbound' | 'outbound'
    fromNumberE164?: string // the dialed DID → becomes the SMS `from`
  }
  | {
    type: 'call.disposition_set'
    callUuid: string
    providerContactId?: string
    disposition: string
  }
  | {
    type: 'sms.received'
    fromE164: string
    toE164: string
    text: string
    providerContactId?: string
  }

export interface EnrollInput {
  providerCampaignId: string
  phoneE164: string
  name?: string
  email?: string
  fields: NeutralField[]
}

export interface SwitchCampaignInput {
  phoneE164: string
  providerContactId: string
  fromCampaignId: string
  toCampaignId: string
  name?: string
  email?: string
  fields: NeutralField[]
}

export interface DialerProvider {
  enroll: (input: EnrollInput) => Promise<{ providerContactId: string }>
  unenroll: (input: { providerCampaignId: string, providerContactId: string }) => Promise<void>
  switchCampaign: (input: SwitchCampaignInput) => Promise<{ providerContactId: string }>
  sendSms: (input: { fromNumberE164: string, toE164: string, body: string }) => Promise<{ providerMessageId: string }>
  listCampaigns: () => Promise<NeutralCampaign[]>
  listContactFields: () => Promise<NeutralField[]>
}

// Re-export for handlers mapping a terminal disposition to an exit reason.
export type { VoipUnenrollReason }
