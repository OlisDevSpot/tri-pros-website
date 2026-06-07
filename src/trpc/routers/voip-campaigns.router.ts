import z from 'zod'

import { paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { countDncBySource, countEligibleLeadsBySource } from '@/shared/entities/customers/dal/server/queries'
import { setVoipDefaultCampaign } from '@/shared/entities/lead-sources/dal/server/mutations'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'
import { countActiveEnrollmentsBySource, listActiveCustomerIdsBySource, listEnrolledLeadsBySource, listLeadsPaginated } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { voipCampaignCrud } from '@/shared/entities/voip-campaigns/dal/server/crud'
import { listVoipCampaigns } from '@/shared/entities/voip-campaigns/dal/server/queries'
import { listVoipContactAttributes } from '@/shared/entities/voip-contact-attributes/dal/server/queries'
import { enrollSourceBatchJob } from '@/shared/services/providers/upstash/jobs/enroll-source-batch'
import { campaignSyncService } from '@/shared/services/voip/campaigns/campaign-sync.service'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { agentProcedure, createTRPCRouter, superAdminProcedure } from '../init'
import { dalToTrpc } from '../lib/dal-to-trpc'

// voip-campaigns admin/ops router (ring 1). Resync + campaign binding + bulk
// enroll-all + the three-reason unenroll (decision #18). Service verbs
// (enroll/unenroll) live in services/voip/campaigns — this router is glue.
//
// Privileged ops use `superAdminProcedure` (procedure-level gating, not inline
// role checks) and DalReturn results are normalized via the shared `dalToTrpc`
// bridge — never a local re-implementation. see src/trpc/DOCS.md.
//
// see docs/plans/voip-campaigns/phase-1-implementation.md#w8
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04

export const voipCampaignsRouter = createTRPCRouter({
  // ── Reads ────────────────────────────────────────────────────────────────
  listCampaigns: agentProcedure.query(async () => {
    return dalToTrpc(await listVoipCampaigns())
  }),

  listAttributes: agentProcedure.query(async () => {
    return dalToTrpc(await listVoipContactAttributes())
  }),

  /** Per-source active enrolled counts → badges. */
  getEnrollmentCounts: agentProcedure.query(async () => {
    return dalToTrpc(await countActiveEnrollmentsBySource())
  }),

  /**
   * Per-source summary rows for the control-center left rail: source identity +
   * its default campaign + eligible (upper-bound pool) + active-enrolled counts.
   * Composes three DAL reads (router-as-glue).
   */
  getSourceCampaignSummaries: agentProcedure.query(async () => {
    const sources = dalToTrpc(await listLeadSources())
    const dncById = dalToTrpc(await countDncBySource())
    const eligibleById = dalToTrpc(await countEligibleLeadsBySource())
    const enrolledBySlug = dalToTrpc(await countActiveEnrollmentsBySource())
    return sources.map(source => ({
      sourceSlug: source.slug,
      name: source.name,
      isActive: source.isActive,
      defaultCampaignId: source.voipConfigJSON?.campaigns?.defaultCampaignId ?? null,
      dncCount: dncById[source.id] ?? 0,
      eligibleCount: eligibleById[source.id] ?? 0,
      enrolledCount: enrolledBySlug[source.slug] ?? 0,
      needsBinding: (eligibleById[source.id] ?? 0) > 0 && !source.voipConfigJSON?.campaigns?.defaultCampaignId,
    }))
  }),

  /** Active enrolled leads for a source → the disqualify list. */
  listEnrolledLeads: agentProcedure
    .input(z.object({ sourceSlug: z.string() }))
    .query(async ({ input }) => {
      return dalToTrpc(await listEnrolledLeadsBySource(input.sourceSlug))
    }),

  /**
   * Unified paginated leads list for the Campaigns Control Center Leads tab.
   * Returns one status bucket at a time (eligible | enrolled | removed | dnc).
   * Filters: status (required), sourceSlug, campaignId. Free-text search on name/phone.
   * see docs/plans/voip-campaigns/EPIC.md + docs/superpowers/specs/2026-06-04-campaigns-control-center-design.md
   */
  listLeads: superAdminProcedure
    .input(paginatedQueryInput({
      status: z.enum(['eligible', 'enrolled', 'removed', 'dnc']),
      sourceSlug: z.string().optional(),
      campaignId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      return dalToTrpc(await listLeadsPaginated({
        status: input.filters?.status ?? 'eligible',
        sourceSlug: input.filters?.sourceSlug,
        campaignId: input.filters?.campaignId,
        search: input.search,
        limit: input.pagination.limit,
        offset: input.pagination.offset,
      }))
    }),

  // ── Resync + binding (super-admin) ─────────────────────────────────────────
  resyncFromCloudtalk: superAdminProcedure.mutation(async ({ ctx }) => {
    return dalToTrpc(await campaignSyncService.resyncFromCloudtalk(ctx))
  }),

  /** Bind a synced campaign to a lead source (decision #8). */
  bindCampaignToSource: superAdminProcedure
    .input(z.object({ campaignId: z.string().uuid(), sourceSlug: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await voipCampaignCrud.update(ctx, {
        id: input.campaignId,
        data: { sourceSlug: input.sourceSlug },
      }))
    }),

  /** Set (or clear) a source's default campaign for auto-enroll (decision #10). */
  setDefaultCampaign: superAdminProcedure
    .input(z.object({ sourceSlug: z.string(), campaignId: z.string().uuid().nullable() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await setVoipDefaultCampaign(input.sourceSlug, input.campaignId))
    }),

  // ── Enrollment ─────────────────────────────────────────────────────────────
  /** Manual single-lead enroll (admin). campaignId optional → source default. */
  enroll: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid(), campaignId: z.string().uuid().optional() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        campaignId: input.campaignId,
      }))
    }),

  /** Bulk "enroll all per source" into an admin-picked campaign (decision #11). */
  enrollAll: superAdminProcedure
    .input(z.object({ sourceSlug: z.string(), campaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      void enrollSourceBatchJob.dispatch({
        sourceSlug: input.sourceSlug,
        campaignId: input.campaignId,
        requestedByUserId: ctx.session.user.id,
      })
      return { ok: true }
    }),

  // ── Unenroll (the one op, three reasons — decision #18) ─────────────────────
  /**
   * Disqualify a single lead ("stop calling / bad lead"). Super-admin only —
   * uses SYSTEM_CONTEXT, so it must not be reachable by scoped agents (would be
   * IDOR: disqualifying a customer the agent can't see). superAdminProcedure
   * enforces that gate; super-admins are omni, so SYSTEM_CONTEXT is legitimate.
   */
  disqualify: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        reason: 'disqualified',
      }))
    }),

  /**
   * Neutral per-contact unenroll — pulls the contact from its campaign with the
   * intent to re-enroll later (reason 'removed', no DNC). Distinct from
   * `disqualify` (bad lead). Re-enroll via the existing `enroll` mutation; the
   * contact returns to the eligible pool. Super-admin only (SYSTEM_CONTEXT).
   */
  removeFromCampaign: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        reason: 'removed',
      }))
    }),

  /** Bulk disqualify selected leads (super-admin). */
  disqualifyBulk: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ input }) => {
      let unenrolled = 0
      for (const customerId of input.customerIds) {
        const result = await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
          customerId,
          reason: 'disqualified',
        })
        if (result.success && result.data.unenrolled) {
          unenrolled++
        }
      }
      return { requested: input.customerIds.length, unenrolled }
    }),

  /** Per-source "Unenroll all" (admin). Reason = disqualified (manual stop). */
  unenrollAll: superAdminProcedure
    .input(z.object({ sourceSlug: z.string() }))
    .mutation(async ({ input }) => {
      const ids = dalToTrpc(await listActiveCustomerIdsBySource(input.sourceSlug))
      let unenrolled = 0
      for (const customerId of ids) {
        const result = await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
          customerId,
          reason: 'disqualified',
        })
        if (result.success && result.data.unenrolled) {
          unenrolled++
        }
      }
      return { active: ids.length, unenrolled }
    }),
})
