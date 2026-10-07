import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { and, eq, ilike, or } from 'drizzle-orm'
import z from 'zod'

import env from '@/shared/config/server-env'
import { intakeModes } from '@/shared/constants/enums'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { customerListInputSchema, listCustomers } from '@/shared/entities/customers/dal/server/queries'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { toDigits } from '@/shared/lib/phone'
import { constructionService } from '@/shared/modules/construction/service'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { validatePhoneLine } from '@/shared/services/providers/twilio/lib/validate-phone-line'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../../init'
import { clientIp } from '../../lib/client-ip'
import { customerPublicProcedure } from './procedures'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const intakeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:submit',
})

export const businessRouter = createTRPCRouter({
  // Drives /dashboard/customers and the lead-sources "All customers" pane; the rules scope it.
  list: agentProcedure
    .input(customerListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listCustomers(ctx, input))),

  // Search customers by name (agents) or name + phone (super-admins). Phone
  // is returned gated — agents only see it once a proposal has been sent for
  // the customer. See canAgentSeePhone / phone-gating-sql.
  search: agentProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // isOmni drives the phone-column gating and the agent-vs-super-admin
      // text WHERE clause — legitimate non-visibility use of ability.can.
      const isOmni = ctx.actor.ability.can('manage', 'all')
      const q = `%${input.query}%`
      // Phone is stored canonical 10-digit — strip the query to digits so a
      // formatted/E.164 search term still matches (see @/shared/lib/phone).
      const phoneDigits = toDigits(input.query)
      // Super-admins can also match by phone — agents cannot (they'd leak
      // which customers exist at which numbers).
      const textWhere = isOmni
        ? or(
            ilike(customers.name, q),
            ilike(customers.phone, phoneDigits ? `%${phoneDigits}%` : q),
          )
        : ilike(customers.name, q)
      return db
        .select({
          id: customers.id,
          name: customers.name,
          phone: gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability)),
          hasSentProposal: hasSentProposalSql(),
          address: customers.address,
        })
        .from(customers)
        .where(and(textWhere, permit(ctx, 'read', customerServerSpec).sql))
        .limit(10)
    }),

  // Public intake form submission — creates customer + optional note (+ meeting)
  createFromIntake: customerPublicProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      address: z.string().optional(),
      city: z.string().min(1),
      state: z.string().length(2).optional(),
      zip: z.string().min(1),
      email: z.string().optional(),
      notes: z.string().optional(),
      mode: z.enum(intakeModes),
      leadSourceSlug: z.string().optional(),
      // Channel-narrowed: the in-app intake form only ever originates
      // operational fields + requestedTrades — never a bina/generic/funnel
      // source payload (those enter via their own ingest channels).
      leadMetaJSON: leadMetaSchema.pick({
        mp3RecordingKey: true,
        closedBy: true,
        scheduledFor: true,
        requestedTrades: true,
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { notes, mode, leadSourceSlug, ...customerData } = input

      // Rate limit by IP
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await intakeRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      // Mobile-or-landline gate (hard-block; VoIP/virtual rejected). Fail-open
      // inside validatePhoneLine never drops a real lead on a Twilio outage.
      const phoneVerdict = await validatePhoneLine(customerData.phone, 'mobile-or-landline')
      if (!phoneVerdict.ok) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: phoneVerdict.blockedReason === 'invalid'
            ? 'Enter a valid US phone number.'
            : 'Enter a mobile or landline number — VoIP/virtual numbers aren\'t accepted.',
        })
      }

      if (mode === 'customer_and_meeting' && !customerData.leadMetaJSON?.scheduledFor) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A meeting must have a scheduled date.' })
      }

      const session = (ctx as { session?: { user: { id: string } } }).session ?? null

      // Resolve picked app-trade ids → human-readable NAMES for the envelope
      // (D10). Exact lookup (the human picked real app trades), not fuzzy.
      const pickedTradeIds = customerData.leadMetaJSON?.requestedTrades?.map(t => t.tradeId) ?? []
      let interestedTradesRaw: string[] | undefined
      if (pickedTradeIds.length > 0) {
        const { trades: allTrades } = await constructionService.getCatalog()
        const nameById = new Map(allTrades.map(t => [t.id, t.name]))
        interestedTradesRaw = pickedTradeIds.map(id => nameById.get(id)).filter((n): n is string => Boolean(n))
      }

      const phoneVerification = {
        status: phoneVerdict.status === 'unverified-line' ? 'unverified' : 'verified',
        lineType: phoneVerdict.lineType,
        carrierName: phoneVerdict.carrierName,
      } as const
      const leadMeta = {
        ...(customerData.leadMetaJSON ?? {}),
        ...(interestedTradesRaw ? { interestedTradesRaw } : {}),
        phoneVerification,
      }

      // Resolve meeting owner (session, else info@ fallback) — business rule
      // with session context stays in the router.
      let meeting: { ownerId: string } | null = null
      if (mode === 'customer_and_meeting') {
        let ownerId = session?.user.id
        if (!ownerId) {
          const [fallbackUser] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, 'info@triprosremodeling.com'))
            .limit(1)
          if (!fallbackUser) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Fallback meeting owner not found. Contact an administrator.' })
          }
          ownerId = fallbackUser.id
        }
        meeting = { ownerId: ownerId! }
      }

      const result = await customerIntakeService.ingestLead(systemContext('intake:form'), {
        core: {
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email ?? null,
          address: customerData.address ?? null,
          city: customerData.city,
          state: customerData.state ?? null,
          zip: customerData.zip,
          leadSourceSlug: leadSourceSlug ?? 'manual',
        },
        leadMeta,
        note: notes ?? null,
        meeting,
      })

      if (!result.success) {
        if (result.error.type === 'not-found') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Lead source "${leadSourceSlug ?? 'manual'}" not found. Contact an administrator.` })
        }
        console.error('[createFromIntake] ingest failed:', result.error)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Customer could not be saved (or the meeting could not be scheduled). Add it manually from the customer profile.' })
      }

      return { customerId: result.data.customer.id, meetingId: result.data.meetingId }
    }),
})
