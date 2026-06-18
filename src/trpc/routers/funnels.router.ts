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

const e164 = z.string().regex(/^\+1\d{10}$/, 'Expected a US E.164 number')

export const funnelsRouter = createTRPCRouter({
  // Public UX check — the PII step calls this (debounced) to surface the
  // verdict before submit. Returns the raw lookup; the gate is applied client
  // and (authoritatively) server-side in submitLead.
  phoneLookup: baseProcedure
    .input(z.object({ phone: e164 }))
    .query(async ({ input, ctx }) => {
      const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await phoneLookupRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      try {
        return await twilioClient.lookupPhoneNumber(input.phone)
      }
      catch (err) {
        if (err instanceof RestException) {
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
      const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await submitRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      // Authoritative lookup; a transport error fails OPEN (never drop a lead).
      let lookup = null
      try {
        lookup = await twilioClient.lookupPhoneNumber(input.phone)
      }
      catch {
        lookup = null
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
})
