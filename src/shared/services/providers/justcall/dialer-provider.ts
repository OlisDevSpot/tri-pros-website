import type { DialerMode, DialerProvider, NeutralCampaign, NeutralField } from '@/shared/services/voip/dialer/types'

import { justcallClient } from './client'
import { resolveFieldIds } from './mappers/resolve-field-ids'

// JustCall's implementation of the neutral DialerProvider contract. This is the
// ONLY place JustCall's client shapes are translated into neutral ones; nothing
// above the `../dialer` binding imports this file directly.

function toDialerMode(jcType: string): DialerMode {
  switch (jcType.toLowerCase()) {
    case 'dynamic':
      return 'dynamic'
    case 'predictive':
      return 'predictive'
    default:
      return 'autodial'
  }
}

export const justcallDialerProvider: DialerProvider = {
  async enroll(input) {
    const res = await justcallClient.addContactToCampaign({
      campaignId: input.providerCampaignId,
      phoneE164: input.phoneE164,
      name: input.name,
      email: input.email,
      customFields: resolveFieldIds(input.fields),
    })
    return { providerContactId: res.contactId }
  },

  async unenroll(input) {
    await justcallClient.removeContactFromCampaign({
      campaignId: input.providerCampaignId,
      contactId: input.providerContactId,
    })
  },

  async switchCampaign(input) {
    await justcallClient.removeContactFromCampaign({
      campaignId: input.fromCampaignId,
      contactId: input.providerContactId,
    })
    const res = await justcallClient.addContactToCampaign({
      campaignId: input.toCampaignId,
      phoneE164: input.phoneE164,
      name: input.name,
      email: input.email,
      customFields: resolveFieldIds(input.fields),
    })
    return { providerContactId: res.contactId }
  },

  async sendSms(input) {
    const res = await justcallClient.sendSms({
      fromE164: input.fromNumberE164,
      toE164: input.toE164,
      body: input.body,
    })
    return { providerMessageId: res.messageId }
  },

  async listCampaigns(): Promise<NeutralCampaign[]> {
    const rows = await justcallClient.listCampaigns()
    return rows.map(r => ({
      providerCampaignId: r.id,
      name: r.name,
      dialerMode: toDialerMode(r.type),
      status: (r.status ?? 'inactive').toLowerCase() === 'active' ? 'active' : 'inactive',
    }))
  },

  async listContactFields(): Promise<NeutralField[]> {
    const rows = await justcallClient.listContactFields()
    return rows.map(r => ({ appKey: r.name, providerFieldId: String(r.id), label: r.name }))
  },
}
