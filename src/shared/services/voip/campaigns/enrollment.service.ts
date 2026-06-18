import type { EnrollmentRejectReason } from './lib/eligibility'
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

// ---------------------------------------------------------------------------
// campaignEnrollmentService — orchestrates CloudTalk campaign enrollment.
//
// PURE ORCHESTRATION (EPIC decision #14). Composes:
//   - cloudtalkClient (provider: upsertContact + addTags + removeTags)
//   - entity DAL mutations (voip_campaign_contacts upsert/markUnenrolled)
//   - entity DAL reads (customers, lead-sources, voip_campaigns, attributes)
//   - lib/ pure gates (eligibility, attribute builder)
//
// ZERO raw db.* — every write goes through entities/<x>/dal/server/mutations.ts.
//
// Enrollment = upsertContact + addTags([membershipTag]) (there is NO "campaign
// enroll" endpoint — CT auto-includes by tag) + write the voip_campaign_contacts
// row. Writes NOTHING to customers (perfect separation — CT owns lifecycle).
//
// see docs/codebase-conventions/service-architecture.md
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04 (#7–#19)
// ---------------------------------------------------------------------------

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { getCustomer, isCustomerInLeads } from '@/shared/entities/customers/dal/server/queries'
import { buildLeadNote } from '@/shared/entities/customers/lib/build-lead-note'
import { getLeadSourceById } from '@/shared/entities/lead-sources/dal/server/queries'
import { markUnenrolled, repointCampaign, upsertEnrolled } from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { findActiveEnrollment } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { getVoipCampaignById } from '@/shared/entities/voip-campaigns/dal/server/queries'
import { listVoipContactAttributes } from '@/shared/entities/voip-contact-attributes/dal/server/queries'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'

import { buildContactAttributes } from './lib/build-contact-attributes'
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

/** Reject = a precondition-failed DalReturn carrying the gate reason. */
function reject<T = never>(reason: EnrollmentRejectReason): DalReturn<T> {
  return dalError<T>({ type: 'precondition-failed', reason })
}

function createCampaignEnrollmentService() {
  return {
    /**
     * Enroll a single customer into a CloudTalk campaign. Runs the gate chain
     * (decision #15), then upserts the CT contact, applies the membership tag,
     * and writes the participation row. First gate failure short-circuits.
     */
    async enroll(
      ctx: ScopedContext,
      input: EnrollInput,
    ): Promise<DalReturn<{ enrolled: true, cloudtalkContactId: string }>> {
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
      const policy = leadSource?.voipConfigJSON?.campaigns

      // ── Source must exist (for attribute build), but a source being
      // "disabled" does not block a manual enroll — the `enabled`/`autoEnroll`
      // flags gate ONLY the auto-enroll-on-ingest path (enforced at the
      // ingestLead dispatch site), never this manual/bulk enroll. ────────────
      if (!leadSource) {
        return reject('source_disabled')
      }

      // ── Gate 2: dialable target campaign ─────────────────────────────────
      const targetCampaignId = input.campaignId ?? policy?.defaultCampaignId
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

      // ── Build CT attribute writes from the synced bridge ─────────────────
      const attrsResult = await listVoipContactAttributes()
      if (!attrsResult.success) {
        return attrsResult
      }
      const attributeIdByKey: Partial<Record<CloudtalkContactAttributeAppKey, string>> = {}
      for (const row of attrsResult.data) {
        attributeIdByKey[row.appKey as CloudtalkContactAttributeAppKey] = row.ctAttributeId
      }
      const { attributes, attributeHash } = buildContactAttributes({
        leadSourceSlug: leadSource.slug,
        interestedTradesRaw: customer.leadMetaJSON?.interestedTradesRaw,
        name: customer.name,
        city: customer.city,
        zip: customer.zip,
        leadCreatedAt: customer.createdAt,
        attributeIdByKey,
      })

      // ── Provider: upsert contact + apply the membership tag ──────────────
      // campaign is non-null here (isCampaignDialable guarded it).
      let cloudtalkContactId: string
      try {
        const upserted = await cloudtalkClient.upsertContact({
          phoneE164,
          name: customer.name,
          city: customer.city,
          zip: customer.zip,
          attributes,
        })
        cloudtalkContactId = upserted.contactId
        await cloudtalkClient.addTags({
          contactId: cloudtalkContactId,
          tags: [campaign!.ctMembershipTag],
        })
      }
      catch (err) {
        console.error('[enrollment] CloudTalk enroll failed', {
          customerId: input.customerId,
          err: err instanceof Error ? err.message : String(err),
        })
        return reject('ct_api_failure')
      }

      // ── Push the lead-detail note to the CT contact card (NON-FATAL) ─────
      // Agents read this in the contact's "Notes" section. A failed note must
      // never fail the enrollment — the lead is already enrolled. CloudTalk
      // flattens newlines on store, so we inline the multi-line note with ' · '
      // separators to keep it readable on the card.
      const leadNote = buildLeadNote(customer.leadMetaJSON)
      if (leadNote) {
        try {
          await cloudtalkClient.addContactNote({
            contactId: cloudtalkContactId,
            note: leadNote.replace(/\n/g, ' · '),
          })
        }
        catch (err) {
          console.error('[enrollment] CloudTalk addContactNote failed (non-fatal)', {
            customerId: input.customerId,
            err: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // ── Persist participation (DAL implements the write) ─────────────────
      const written = await upsertEnrolled({
        customerId: input.customerId,
        cloudtalkContactId,
        voipCampaignId: campaign!.id,
        attributeHash,
      })
      if (!written.success) {
        return written
      }

      return dalSuccess({ enrolled: true, cloudtalkContactId })
    },

    /**
     * The ONE exit op for all three reasons (graduated | opted_out |
     * disqualified — decision #18). Idempotent: no active enrollment → no-op.
     * Removes the membership tag (read from the linked campaign), then marks
     * the row unenrolled. Reachable from app meeting-create, CT webhook, and UI.
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

      // Remove the membership tag on CT. If the tag is unknown (dangling FK),
      // skip the provider call and just mark unenrolled locally.
      if (active.ctMembershipTag) {
        try {
          await cloudtalkClient.removeTags({
            contactId: active.cloudtalkContactId,
            tags: [active.ctMembershipTag],
          })
        }
        catch (err) {
          console.error('[enrollment] CloudTalk removeTags failed — not marking unenrolled (retryable)', {
            customerId: input.customerId,
            err: err instanceof Error ? err.message : String(err),
          })
          return reject('ct_api_failure')
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
     * to `toCampaignId`. Swaps the CloudTalk membership tags (remove old, add
     * new) then re-points the FK via the DAL.
     *
     * Precondition-failed reasons:
     *   - `not_actively_enrolled` — no active row (or missing CT contact id)
     *   - `unknown_target_campaign` — campaign not found or has no membership tag
     *   - `ct_api_failure` — CloudTalk tag swap threw
     */
    async switchCampaign(
      _ctx: ScopedContext,
      input: { customerId: string, toCampaignId: string },
    ): Promise<DalReturn<{ switched: boolean }>> {
      // ── 1. Resolve current active enrollment ─────────────────────────────
      const activeResult = await findActiveEnrollment(input.customerId)
      if (!activeResult.success) {
        return activeResult
      }
      const active = activeResult.data
      if (!active || !active.cloudtalkContactId) {
        return dalError({ type: 'precondition-failed', reason: 'not_actively_enrolled' })
      }

      // ── 2. Read target campaign (need its membership tag) ─────────────────
      const campaignResult = await getVoipCampaignById(input.toCampaignId)
      if (!campaignResult.success) {
        return campaignResult
      }
      const targetCampaign = campaignResult.data
      if (!targetCampaign || !targetCampaign.ctMembershipTag) {
        return dalError({ type: 'precondition-failed', reason: 'unknown_target_campaign' })
      }

      // ── 3. Swap membership tags on CloudTalk ─────────────────────────────
      try {
        if (active.ctMembershipTag) {
          await cloudtalkClient.removeTags({
            contactId: active.cloudtalkContactId,
            tags: [active.ctMembershipTag],
          })
        }
        await cloudtalkClient.addTags({
          contactId: active.cloudtalkContactId,
          tags: [targetCampaign.ctMembershipTag],
        })
      }
      catch (err) {
        console.error('[enrollment] CloudTalk tag swap failed during switchCampaign', {
          customerId: input.customerId,
          toCampaignId: input.toCampaignId,
          err: err instanceof Error ? err.message : String(err),
        })
        return reject('ct_api_failure')
      }

      // ── 4. Re-point the FK in our DB ─────────────────────────────────────
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
