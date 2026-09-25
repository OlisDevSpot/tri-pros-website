import { TRPCError } from '@trpc/server'
import z from 'zod'

import { paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { setVoipCampaignsPolicy } from '@/shared/entities/lead-sources/dal/server/mutations'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'
import { countLeadsByStatusPerSource, listActiveCustomerIdsBySource, listEnrolledLeadsBySource, listLeadsPaginated } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { voipCampaignCrud } from '@/shared/entities/voip-campaigns/dal/server/crud'
import { getVoipCampaignById, listVoipCampaigns } from '@/shared/entities/voip-campaigns/dal/server/queries'
import { smsCadenceSchema } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
import { listVoipContactFields } from '@/shared/entities/voip-contact-fields/dal/server/queries'
import { bulkDncJob } from '@/shared/services/providers/upstash/jobs/bulk-dnc'
import { bulkEnrollJob } from '@/shared/services/providers/upstash/jobs/bulk-enroll'
import { bulkUnenrollJob } from '@/shared/services/providers/upstash/jobs/bulk-unenroll'
import { enrollSourceBatchJob } from '@/shared/services/providers/upstash/jobs/enroll-source-batch'
import { campaignSyncService } from '@/shared/services/voip/campaigns/campaign-sync.service'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { isCampaignDialable } from '@/shared/services/voip/campaigns/lib/eligibility'
import { complianceService } from '@/shared/services/voip/compliance.service'

import { agentProcedure, createTRPCRouter, superAdminProcedure } from '../init'
import { dalToTrpc } from '../lib/dal-to-trpc'

async function assertCampaignDialable(campaignId: string) {
  const result = await getVoipCampaignById(campaignId)
  if (!result.success || !isCampaignDialable(result.data)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'That campaign is not active — resync or pick another.',
    })
  }
}

export const voipCampaignsRouter = createTRPCRouter({
  listCampaigns: agentProcedure.query(async () => {
    return dalToTrpc(await listVoipCampaigns())
  }),

  listContactFields: agentProcedure.query(async () => {
    return dalToTrpc(await listVoipContactFields())
  }),

  getSourceCampaignSummaries: agentProcedure.query(async () => {
    const sources = dalToTrpc(await listLeadSources())
    const counts = dalToTrpc(await countLeadsByStatusPerSource())
    return sources.map(source => ({
      sourceSlug: source.slug,
      name: source.name,
      isActive: source.isActive,
      autoEnroll: source.voipAutoEnroll,
      defaultCampaignId: source.defaultCampaignId,
      enabled: source.voipCampaignsEnabled,
      dncCount: counts[source.id]?.dnc ?? 0,
      eligibleCount: counts[source.id]?.eligible ?? 0,
      enrolledCount: counts[source.id]?.enrolled ?? 0,
      needsBinding: (counts[source.id]?.eligible ?? 0) > 0 && !source.defaultCampaignId,
    }))
  }),

  listEnrolledLeads: agentProcedure
    .input(z.object({ sourceSlug: z.string() }))
    .query(async ({ input }) => {
      return dalToTrpc(await listEnrolledLeadsBySource(input.sourceSlug))
    }),

  listLeads: superAdminProcedure
    .input(paginatedQueryInput({
      status: z.enum(['all', 'eligible', 'enrolled', 'removed', 'dnc']),
      sourceSlug: z.string().optional(),
      campaignId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listLeadsPaginated(ctx, {
        status: input.filters?.status ?? 'all',
        sourceSlug: input.filters?.sourceSlug,
        campaignId: input.filters?.campaignId,
        search: input.search,
        limit: input.pagination.limit,
        offset: input.pagination.offset,
      }))
    }),

  resyncDialer: superAdminProcedure.mutation(async ({ ctx }) => {
    return dalToTrpc(await campaignSyncService.resyncDialer(ctx))
  }),

  setSourcePolicy: superAdminProcedure
    .input(z.object({
      sourceSlug: z.string(),
      patch: z.object({
        autoEnroll: z.boolean().optional(),
        defaultCampaignId: z.string().uuid().nullable().optional(),
        enabled: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await setVoipCampaignsPolicy(input.sourceSlug, input.patch))
    }),

  /** Resync-safe: upsertCampaignByProviderId never writes `smsCadence`. */
  setCampaignSmsCadence: superAdminProcedure
    .input(z.object({
      campaignId: z.string().uuid(),
      smsCadence: smsCadenceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await voipCampaignCrud.update(ctx, {
        id: input.campaignId,
        data: { smsCadence: input.smsCadence },
      }))
    }),

  /** campaignId omitted → the source's default campaign. */
  enroll: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid(), campaignId: z.string().uuid().optional() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        campaignId: input.campaignId,
        allowNonLead: true,
      }))
    }),

  enrollAll: superAdminProcedure
    .input(z.object({ sourceSlug: z.string(), campaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCampaignDialable(input.campaignId)
      void enrollSourceBatchJob.dispatch({
        sourceSlug: input.sourceSlug,
        campaignId: input.campaignId,
        requestedByUserId: ctx.session.user.id,
      })
      return { ok: true }
    }),

  /** Runs under SYSTEM_CONTEXT, so this must stay super-admin-only — a scoped agent could otherwise disqualify a customer it can't see. */
  disqualify: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        reason: 'disqualified',
      }))
    }),

  removeFromCampaign: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        reason: 'removed',
      }))
    }),

  /** Background job: each unenroll is several dialer API calls, so a large selection would blow the request timeout inline. */
  disqualifyBulk: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      void bulkUnenrollJob.dispatch({
        customerIds: input.customerIds,
        reason: 'disqualified',
        requestedByUserId: ctx.session.user.id,
      })
      return { queued: input.customerIds.length }
    }),

  enrollSelected: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1).max(1000), campaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCampaignDialable(input.campaignId)
      void bulkEnrollJob.dispatch({
        customerIds: input.customerIds,
        campaignId: input.campaignId,
        requestedByUserId: ctx.session.user.id,
      })
      return { queued: input.customerIds.length }
    }),

  removeBulk: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      void bulkUnenrollJob.dispatch({
        customerIds: input.customerIds,
        reason: 'removed',
        requestedByUserId: ctx.session.user.id,
      })
      return { queued: input.customerIds.length }
    }),

  switchCampaign: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid(), toCampaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await campaignEnrollmentService.switchCampaign(ctx, input))
    }),

  markDnc: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      void bulkDncJob.dispatch({
        customerIds: input.customerIds,
        requestedByUserId: ctx.session.user.id,
      })
      return { queued: input.customerIds.length }
    }),

  removeDnc: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await complianceService.removeFromDnc({ customerId: input.customerId })
      return { ok: true }
    }),

  unenrollAll: superAdminProcedure
    .input(z.object({ sourceSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ids = dalToTrpc(await listActiveCustomerIdsBySource(input.sourceSlug))
      if (ids.length > 0) {
        void bulkUnenrollJob.dispatch({
          customerIds: ids,
          reason: 'disqualified',
          requestedByUserId: ctx.session.user.id,
        })
      }
      return { queued: ids.length }
    }),
})
