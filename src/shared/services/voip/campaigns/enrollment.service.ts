import type { EnrollmentRejectReason } from './lib/eligibility'
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { NeutralField } from '@/shared/services/voip/dialer/types'

// Writes nothing to `customers` — the dialer owns lifecycle. The provider is reached only through the neutral `dialerProvider`, never providers/justcall/* directly.

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { getCustomer, isCustomerInLeads } from '@/shared/entities/customers/dal/server/queries'
import { getLeadSourceById } from '@/shared/entities/lead-sources/dal/server/queries'
import { markUnenrolled, repointCampaign, upsertEnrolled } from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { findActiveEnrollment } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { getVoipCampaignById } from '@/shared/entities/voip-campaigns/dal/server/queries'
import { listVoipContactFields } from '@/shared/entities/voip-contact-fields/dal/server/queries'
import { dialerProvider } from '@/shared/services/voip/dialer'

import { buildNeutralFields } from './lib/build-neutral-fields'
import { isCampaignDialable, isDncBlocked, normalizeToE164 } from './lib/eligibility'

interface EnrollInput {
  customerId: string
  campaignId?: string
  // A single manual enroll may re-dial a cold or stalled non-lead; bulk paths leave this false.
  allowNonLead?: boolean
}

interface UnenrollInput {
  customerId: string
  reason: VoipUnenrollReason
}

interface FieldSourceCustomer {
  name: string
  city: string
  zip: string
  createdAt: string
  attribution?: { captureJSON?: { interestedTradesRaw?: string[] } | null } | null
}

function reject<T = never>(reason: EnrollmentRejectReason): DalReturn<T> {
  return dalError<T>({ type: 'precondition-failed', reason })
}

async function loadNeutralFields(
  customer: FieldSourceCustomer,
  leadSourceSlug: string,
): Promise<DalReturn<{ fields: NeutralField[], attributeHash: string }>> {
  const fieldsResult = await listVoipContactFields()
  if (!fieldsResult.success) {
    return fieldsResult
  }
  const providerFieldIdByKey: Record<string, string> = {}
  const labelByKey: Record<string, string> = {}
  for (const row of fieldsResult.data) {
    providerFieldIdByKey[row.appKey] = row.providerFieldId
    labelByKey[row.appKey] = row.providerFieldLabel
  }
  const { fields, attributeHash } = buildNeutralFields({
    leadSourceSlug,
    interestedTradesRaw: customer.attribution?.captureJSON?.interestedTradesRaw,
    name: customer.name,
    city: customer.city,
    zip: customer.zip,
    leadCreatedAt: customer.createdAt,
    providerFieldIdByKey,
    labelByKey,
  })
  return dalSuccess({ fields, attributeHash })
}

function createCampaignEnrollmentService() {
  return {
    async enroll(
      ctx: ScopedContext,
      input: EnrollInput,
    ): Promise<DalReturn<{ enrolled: true, providerContactId: string }>> {
      const customerResult = await getCustomer(
        ctx,
        { id: input.customerId },
      )
      if (!customerResult.success) {
        return customerResult
      }
      const customer = customerResult.data
      if (!customer) {
        return dalError({ type: 'not-found' })
      }

      if (!customer.leadSourceId) {
        return reject('source_disabled')
      }
      const sourceResult = await getLeadSourceById(customer.leadSourceId)
      if (!sourceResult.success) {
        return sourceResult
      }
      const leadSource = sourceResult.data

      // A disabled source does not block manual enroll — `enabled`/`autoEnroll` gate only the auto-enroll-on-ingest path.
      if (!leadSource) {
        return reject('source_disabled')
      }

      const targetCampaignId = input.campaignId ?? leadSource.defaultCampaignId
      if (!targetCampaignId) {
        return reject('no_dialable_campaign')
      }
      const campaignResult = await getVoipCampaignById(targetCampaignId)
      if (!campaignResult.success) {
        return campaignResult
      }
      const campaign = campaignResult.data
      if (!isCampaignDialable(campaign)) {
        return reject('no_dialable_campaign')
      }

      if (!input.allowNonLead) {
        const isLeadResult = await isCustomerInLeads(input.customerId)
        if (!isLeadResult.success) {
          return isLeadResult
        }
        if (!isLeadResult.data) {
          return reject('not_a_lead')
        }
      }

      if (isDncBlocked(customer)) {
        return reject('dnc_match')
      }

      const phoneE164 = normalizeToE164(customer.phone)
      if (!phoneE164) {
        return reject('invalid_phone')
      }

      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      if (activeResult.data) {
        return reject('already_enrolled')
      }

      const builtResult = await loadNeutralFields(customer, leadSource.slug)
      if (!builtResult.success) {
        return builtResult
      }
      const { fields, attributeHash } = builtResult.data

      // campaign is non-null here (isCampaignDialable guarded it).
      let providerContactId: string
      try {
        const enrolled = await dialerProvider.enroll({
          providerCampaignId: campaign!.providerCampaignId,
          phoneE164,
          name: customer.name,
          fields,
        })
        providerContactId = enrolled.providerContactId
      }
      catch (err) {
        console.error('[enrollment] dialer enroll failed', {
          customerId: input.customerId,
          err: err instanceof Error ? err.message : String(err),
        })
        return reject('provider_api_failure')
      }

      const written = await upsertEnrolled({
        customerId: input.customerId,
        providerContactId,
        voipCampaignId: campaign!.id,
        attributeHash,
      })
      if (!written.success) {
        return written
      }

      return dalSuccess({ enrolled: true, providerContactId })
    },

    async unenroll(
      _ctx: ScopedContext,
      input: UnenrollInput,
    ): Promise<DalReturn<{ unenrolled: boolean }>> {
      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      const active = activeResult.data
      if (!active) {
        return dalSuccess({ unenrolled: false })
      }

      // No providerCampaignId (dangling FK) ⇒ skip the provider call and mark unenrolled locally.
      if (active.providerCampaignId) {
        try {
          await dialerProvider.unenroll({
            providerCampaignId: active.providerCampaignId,
            providerContactId: active.providerContactId,
          })
        }
        catch (err) {
          console.error('[enrollment] dialer unenroll failed — not marking unenrolled (retryable)', {
            customerId: input.customerId,
            err: err instanceof Error ? err.message : String(err),
          })
          return reject('provider_api_failure')
        }
      }

      const marked = await markUnenrolled(input.customerId, input.reason)
      if (!marked.success) {
        return marked
      }
      return dalSuccess({ unenrolled: marked.data.rowsAffected > 0 })
    },

    async switchCampaign(
      ctx: ScopedContext,
      input: { customerId: string, toCampaignId: string },
    ): Promise<DalReturn<{ switched: boolean }>> {
      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      const active = activeResult.data
      if (!active || !active.providerContactId || !active.providerCampaignId) {
        return dalError({ type: 'precondition-failed', reason: 'not_actively_enrolled' })
      }

      const campaignResult = await getVoipCampaignById(input.toCampaignId)
      if (!campaignResult.success) {
        return campaignResult
      }
      const targetCampaign = campaignResult.data
      if (!targetCampaign) {
        return dalError({ type: 'precondition-failed', reason: 'unknown_target_campaign' })
      }

      const customerResult = await getCustomer(ctx, { id: input.customerId })
      if (!customerResult.success) {
        return customerResult
      }
      const customer = customerResult.data
      if (!customer || !customer.leadSourceId) {
        return dalError({ type: 'precondition-failed', reason: 'not_actively_enrolled' })
      }
      const phoneE164 = normalizeToE164(customer.phone)
      if (!phoneE164) {
        return reject('invalid_phone')
      }
      const sourceResult = await getLeadSourceById(customer.leadSourceId)
      if (!sourceResult.success) {
        return sourceResult
      }
      const leadSourceSlug = sourceResult.data?.slug ?? ''
      const builtResult = await loadNeutralFields(customer, leadSourceSlug)
      if (!builtResult.success) {
        return builtResult
      }

      try {
        await dialerProvider.switchCampaign({
          phoneE164,
          providerContactId: active.providerContactId,
          fromCampaignId: active.providerCampaignId,
          toCampaignId: targetCampaign.providerCampaignId,
          name: customer.name,
          fields: builtResult.data.fields,
        })
      }
      catch (err) {
        console.error('[enrollment] dialer switchCampaign failed', {
          customerId: input.customerId,
          toCampaignId: input.toCampaignId,
          err: err instanceof Error ? err.message : String(err),
        })
        return reject('provider_api_failure')
      }

      const repointed = await repointCampaign({
        customerId: input.customerId,
        toCampaignId: input.toCampaignId,
      })
      if (!repointed.success) {
        return repointed
      }

      return dalSuccess({ switched: true })
    },
  }
}

export const campaignEnrollmentService = createCampaignEnrollmentService()
