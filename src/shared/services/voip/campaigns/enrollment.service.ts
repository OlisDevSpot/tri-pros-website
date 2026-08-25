import type { EnrollmentRejectReason } from './lib/eligibility'
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { NeutralField } from '@/shared/services/voip/dialer/types'

// ---------------------------------------------------------------------------
// campaignEnrollmentService — orchestrates dialer (JustCall) campaign enrollment.
//
// PURE ORCHESTRATION (EPIC decision #14). Composes:
//   - dialerProvider (neutral seam: enroll + unenroll + switchCampaign)
//   - entity DAL mutations (voip_campaign_contacts upsert/markUnenrolled)
//   - entity DAL reads (customers, lead-sources, voip_campaigns, contact fields)
//   - lib/ pure gates (eligibility, neutral-field builder)
//
// ZERO raw db.* — every write goes through entities/<x>/dal/server/mutations.ts.
// The provider is reached ONLY through the neutral `dialerProvider` binding —
// never providers/justcall/* directly.
//
// Enrollment = dialerProvider.enroll(providerCampaignId, phone, fields) (an
// explicit campaign-contact upsert — JustCall has no membership-tag idiom) +
// write the voip_campaign_contacts row. Writes NOTHING to customers (perfect
// separation — the dialer owns lifecycle).
//
// see docs/codebase-conventions/service-architecture.md
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md
// ---------------------------------------------------------------------------

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
  // Explicit target campaign (bulk "enroll all" picker). When omitted, the
  // source's defaultCampaignId is used (auto-enroll — wired via enrollLeadJob,
  // dispatched from customerIntakeService.ingestLead).
  campaignId?: string
  // Single manual enroll (one named customer) authorizes re-dialing a cold or
  // stalled non-lead, so it bypasses the is-a-lead gate. Bulk paths leave this
  // false — they operate on the eligible (leads) pool.
  allowNonLead?: boolean
}

interface UnenrollInput {
  customerId: string
  reason: VoipUnenrollReason
}

// The customer fields the neutral-field builder needs — a narrow projection so
// this helper doesn't couple to the full customer row type.
interface FieldSourceCustomer {
  name: string
  city: string
  zip: string
  createdAt: string
  attribution?: { captureJSON?: { interestedTradesRaw?: string[] } | null } | null
}

/** Reject = a precondition-failed DalReturn carrying the gate reason. */
function reject<T = never>(reason: EnrollmentRejectReason): DalReturn<T> {
  return dalError<T>({ type: 'precondition-failed', reason })
}

/**
 * Load the synced field bridge and build the neutral custom-field list + delta
 * hash for a customer. Shared by `enroll` and `switchCampaign` (both push the
 * contact into a campaign, which carries the same custom fields).
 */
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
    /**
     * Enroll a single customer into a dialer campaign. Runs the gate chain
     * (decision #15), then upserts the contact into the campaign and writes the
     * participation row. First gate failure short-circuits.
     */
    async enroll(
      ctx: ScopedContext,
      input: EnrollInput,
    ): Promise<DalReturn<{ enrolled: true, providerContactId: string }>> {
      // ── Load customer (SYSTEM read — ungated phone) ──────────────────────
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

      // ── Resolve lead source + policy ─────────────────────────────────────
      if (!customer.leadSourceId) {
        return reject('source_disabled')
      }
      const sourceResult = await getLeadSourceById(customer.leadSourceId)
      if (!sourceResult.success) {
        return sourceResult
      }
      const leadSource = sourceResult.data

      // ── Source must exist (for field build), but a source being "disabled"
      // does not block a manual enroll — the `enabled`/`autoEnroll` flags gate
      // ONLY the auto-enroll-on-ingest path (enforced at the ingestLead dispatch
      // site), never this manual/bulk enroll. ──────────────────────────────
      if (!leadSource) {
        return reject('source_disabled')
      }

      // ── Gate 2: dialable target campaign ─────────────────────────────────
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

      // ── Gate: pre-meeting lead (single manual enroll may bypass) ──────────
      if (!input.allowNonLead) {
        const isLeadResult = await isCustomerInLeads(input.customerId)
        if (!isLeadResult.success) {
          return isLeadResult
        }
        if (!isLeadResult.data) {
          return reject('not_a_lead')
        }
      }

      // ── Gate 4: DNC ──────────────────────────────────────────────────────
      if (isDncBlocked(customer)) {
        return reject('dnc_match')
      }

      // ── Gate 5: usable E.164 phone ───────────────────────────────────────
      const phoneE164 = normalizeToE164(customer.phone)
      if (!phoneE164) {
        return reject('invalid_phone')
      }

      // ── Gate 6: not already actively enrolled ────────────────────────────
      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      if (activeResult.data) {
        return reject('already_enrolled')
      }

      // ── Build the neutral custom-field list from the synced bridge ───────
      const builtResult = await loadNeutralFields(customer, leadSource.slug)
      if (!builtResult.success) {
        return builtResult
      }
      const { fields, attributeHash } = builtResult.data

      // ── Provider: push the contact into the campaign ─────────────────────
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

      // ── Persist participation (DAL implements the write) ─────────────────
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

    /**
     * The ONE exit op for all three reasons (graduated | opted_out |
     * disqualified — decision #18). Idempotent: no active enrollment → no-op.
     * Removes the contact from its campaign (via the linked campaign's provider
     * id), then marks the row unenrolled. Reachable from app meeting-create,
     * dialer webhook, and UI.
     */
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
        // No active enrollment → idempotent no-op.
        return dalSuccess({ unenrolled: false })
      }

      // Remove the contact from its campaign. If the campaign is unknown
      // (dangling FK), skip the provider call and just mark unenrolled locally.
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

    /**
     * Atomically move an actively-enrolled customer from their current campaign
     * to `toCampaignId`. Removes the contact from the old campaign and adds it
     * to the new one on the dialer (both carry the same custom fields), then
     * re-points the FK via the DAL.
     *
     * Precondition-failed reasons:
     *   - `not_actively_enrolled` — no active row / missing provider contact or campaign id
     *   - `unknown_target_campaign` — target campaign not found
     *   - `provider_api_failure` — the dialer switch threw
     */
    async switchCampaign(
      ctx: ScopedContext,
      input: { customerId: string, toCampaignId: string },
    ): Promise<DalReturn<{ switched: boolean }>> {
      // ── 1. Resolve current active enrollment ─────────────────────────────
      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      const active = activeResult.data
      if (!active || !active.providerContactId || !active.providerCampaignId) {
        return dalError({ type: 'precondition-failed', reason: 'not_actively_enrolled' })
      }

      // ── 2. Read target campaign (need its provider id) ───────────────────
      const campaignResult = await getVoipCampaignById(input.toCampaignId)
      if (!campaignResult.success) {
        return campaignResult
      }
      const targetCampaign = campaignResult.data
      if (!targetCampaign) {
        return dalError({ type: 'precondition-failed', reason: 'unknown_target_campaign' })
      }

      // ── 3. Load customer + build fields (the new campaign re-carries them) ─
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

      // ── 4. Switch on the dialer (remove old → add new) ───────────────────
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

      // ── 5. Re-point the FK in our DB ─────────────────────────────────────
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
