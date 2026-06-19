import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import z from 'zod'

import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'

import { baseProcedure, createTRPCRouter } from '../init'
import { clientIp } from '../lib/client-ip'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const submitRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'funnel:submit',
})

const phoneLookupRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'funnel:phone-lookup',
})

const enrichRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'funnel:enrich',
})

// Global paid-lookup ceiling — backstop against IP rotation across many real
// IPs. Fail-open on exceed so legit leads are never dropped while cost is capped.
const lookupCeiling = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '1 h'),
  prefix: 'funnel:lookup-ceiling',
  ephemeralCache: new Map(),
})

const e164 = z.string().regex(/^\+1\d{10}$/, 'Expected a US E.164 number')

const LOOKUP_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('phone lookup timed out')), ms)
    }),
  ])
}

export const funnelsRouter = createTRPCRouter({
  // Public UX check — the PII step calls this (debounced) to surface the
  // verdict before submit. Returns the raw lookup; the gate is applied client
  // and (authoritatively) server-side in submitLead.
  phoneLookup: baseProcedure
    .input(z.object({ phone: e164 }))
    .query(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await phoneLookupRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      const ceiling = await lookupCeiling.limit('global')
      if (!ceiling.success) {
        // Global paid-lookup cap hit (abuse backstop) — skip the paid call and
        // return the indeterminate result; the client gate treats it as pass.
        return { valid: true, lineType: null, carrierName: null, errorCode: -1 }
      }

      try {
        return await withTimeout(twilioClient.lookupPhoneNumber(input.phone), LOOKUP_TIMEOUT_MS)
      }
      catch (err) {
        if (err instanceof RestException || err instanceof Error) {
          // Treat as indeterminate — the client gate will fail open.
          return { valid: true, lineType: null, carrierName: null, errorCode: -1 }
        }
        throw err
      }
    }),

  // Server-authoritative submit: hard gate (fail-open on outage) → ingest.
  submitLead: baseProcedure
    .input(z.object({
      phone: e164,
      name: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().length(2).optional(),
      zip: z.string().min(1).max(10),
      leadSourceSlug: z.string().min(1).max(100),
      leadMetaJSON: leadMetaSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await submitRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      // Authoritative lookup; a transport error, timeout, or global ceiling hit
      // fails OPEN (never drop a lead). ceiling not ok → lookup stays null →
      // evaluatePhoneGate(null) → fail-open 'unverified' → lead still created.
      let lookup = null
      const ceiling = await lookupCeiling.limit('global')
      if (ceiling.success) {
        try {
          lookup = await withTimeout(twilioClient.lookupPhoneNumber(input.phone), LOOKUP_TIMEOUT_MS)
        }
        catch {
          lookup = null
        }
      }
      const verdict = evaluatePhoneGate(lookup)
      if (!verdict.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That phone number doesn\'t look valid — please double-check it.' })
      }

      const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
        core: {
          name: input.name,
          phone: input.phone,
          email: null,
          address: null,
          city: input.city,
          state: input.state ?? 'CA', // Funnel is SoCal-only; CA is the safe default
          zip: input.zip,
          leadSourceSlug: input.leadSourceSlug,
        },
        leadMeta: {
          ...input.leadMetaJSON,
          phoneVerification: {
            status: verdict.status,
            lineType: verdict.lineType,
            carrierName: verdict.carrierName,
          },
        },
      })
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save your details. Please try again.' })
      }
      return { customerId: result.data.customer.id }
    }),

  // Guarded post-lead enrichment (funnel leads only). The leadId UUID is the
  // capability; IP rate-limited; the service refuses non-funnel customers and
  // only patches source.enrichment. Best-effort — the client never blocks on it.
  enrichFunnelLead: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      enrichment: z.object({
        homeType: z.string().nullable().optional(),
        age: z.string().nullable().optional(),
        scope: z.string().nullable().optional(),
        timeline: z.string().nullable().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await enrichRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      const result = await customerIntakeService.enrichFunnelLead(SYSTEM_CONTEXT, input)
      if (!result.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not save your details.' })
      }
      return { ok: true as const }
    }),
})
