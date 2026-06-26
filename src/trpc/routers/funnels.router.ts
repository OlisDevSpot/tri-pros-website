import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import z from 'zod'

import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { deriveFbc } from '@/shared/services/providers/meta/lib/derive-fbc'
import { validatePhoneLine } from '@/shared/services/providers/twilio/lib/validate-phone-line'
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'

import { baseProcedure, createTRPCRouter } from '../init'
import { clientIp } from '../lib/client-ip'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

// Keyed on `${ip}:${phone}`, NOT raw IP — mobile carriers pool many subscribers
// behind a handful of CGNAT egress IPs, so a per-IP ceiling would collectively
// throttle legitimate distinct leads under ad volume. The composite key gives
// each phone number its own bucket (bounding same-number retries) while letting
// distinct mobile users share an egress IP freely. Bot abuse rotating phones is
// gated upstream by Twilio mobile validation + the honeypot.
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
  // Progressive capture fires once per answered enrichment dimension; a funnel
  // can declare ~6. 20/h leaves comfortable headroom over a single session.
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'funnel:enrich',
})

const addressRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'funnel:address',
})

const trackRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'funnel:track',
})

const e164 = z.string().regex(/^\+1\d{10}$/, 'Expected a US E.164 number')

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
      return validatePhoneLine(input.phone, 'mobile-only')
    }),

  // Server-authoritative submit: hard gate (fail-open on outage) → ingest.
  submitLead: baseProcedure
    .input(z.object({
      phone: e164,
      name: z.string().min(1).max(200),
      // First/last kept distinct (not split from `name`) so Meta `fn`/`ln`
      // match keys are clean — a concatenated name can't be split losslessly.
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      city: z.string().min(1).max(100),
      state: z.string().length(2).optional(),
      zip: z.string().min(1).max(10),
      leadSourceSlug: z.string().min(1).max(100),
      leadMetaJSON: leadMetaSchema,
      eventId: z.string().optional(),
      // The PUBLIC browser URL (subdomain + query) at submit time — NOT the
      // internal /funnels/... rewrite path. Improves CAPI match quality + dedup.
      // `.catch(undefined)` is load-bearing: this is a cosmetic CAPI field, so a
      // malformed or oversized URL must self-heal to undefined, NEVER reject the
      // lead-submit mutation (which would also suppress the post-submit pixel).
      eventSourceUrl: z.string().url().max(2048).optional().catch(undefined),
      pixel: z.object({
        contentCategory: z.string(),
        contentName: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await submitRatelimit.limit(`${ip}:${input.phone}`)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }

      // Authoritative mobile-only gate. Fail-open inside validatePhoneLine — a
      // Twilio outage / ceiling / timeout never drops a lead.
      const verdict = await validatePhoneLine(input.phone, 'mobile-only')
      if (!verdict.ok) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: verdict.blockedReason === 'non-mobile'
            ? 'Please use a mobile number only.'
            : 'That phone number doesn\'t look valid — please double-check it.',
        })
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
            status: verdict.status === 'unverified-line' ? 'unverified' : 'verified',
            lineType: verdict.lineType,
            carrierName: verdict.carrierName,
          },
        },
      })
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save your details. Please try again.' })
      }
      const customerId = result.data.customer.id

      // Server CAPI twin of the browser `Lead` pixel — same event_id → Meta
      // dedupes. Cosmetic criticality: a dropped enqueue only weakens optimization.
      if (input.eventId) {
        const ip = clientIp((ctx as { req?: Request }).req)
        const ua = (ctx as { req?: Request }).req?.headers.get('user-agent') ?? null
        const funnelSource = input.leadMetaJSON.source?.kind === 'funnel'
          ? input.leadMetaJSON.source
          : undefined
        const nowMs = Date.now()
        void metaCapiEventJob.dispatch({
          event: 'Lead',
          args: {
            eventId: input.eventId,
            eventTime: Math.floor(nowMs / 1000),
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            city: input.city,
            state: input.state ?? 'CA', // Funnel is SoCal-only; CA is the safe default
            zip: input.zip,
            externalId: customerId,
            fbp: funnelSource?.meta?.fbp ?? null,
            // Reconstruct fbc from the persisted fbclid when the pixel never set
            // the _fbc cookie (iOS ITP / ad blockers) — preserves click attribution.
            fbc: deriveFbc({
              fbc: funnelSource?.meta?.fbc,
              fbclid: funnelSource?.utm.fbclid,
              nowMs,
            }),
            // `clientIp()` returns the literal 'anonymous' when no trusted edge
            // header is present — never send that to Meta as a real IP.
            clientIp: ip === 'anonymous' ? null : ip,
            clientUserAgent: ua,
            eventSourceUrl: input.eventSourceUrl ?? null,
            contentCategory: input.pixel?.contentCategory ?? null,
            contentName: input.pixel?.contentName ?? null,
          },
        })
      }

      return { customerId }
    }),

  // Guarded post-lead enrichment (funnel leads only). The leadId UUID is the
  // capability; IP rate-limited; the service refuses non-funnel customers and
  // only patches source.enrichment. Best-effort — the client never blocks on it.
  enrichFunnelLead: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      enrichment: z.record(
        z.string(),
        z.object({ label: z.string(), value: z.string(), order: z.number().int() }),
      ),
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

  // Guarded post-lead address patch (funnel leads only). Mirrors enrichFunnelLead:
  // leadId UUID is the capability; IP rate-limited; the service refuses non-funnel
  // customers and only patches address fields. Best-effort — client never blocks.
  setFunnelLeadAddress: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      address: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().length(2).optional(),
      zip: z.string().min(1).max(10),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await addressRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      const result = await customerIntakeService.setFunnelLeadAddress(SYSTEM_CONTEXT, {
        ...input,
        state: input.state ?? 'CA', // Funnel is SoCal-only; CA is the safe default
      })
      if (!result.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not save your details.' })
      }
      return { ok: true as const }
    }),

  // Generic post-lead server-twin seam for dual-fire browser events that fire
  // AFTER the lead exists (e.g. Schedule). Guarded by the leadId UUID; the
  // browser passes the same eventId it used for its pixel so Meta dedupes.
  // Dormant in phase 1 — no funnel emits 'Schedule' yet (no datetime step).
  trackFunnelEvent: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      event: z.enum(['Schedule']),
      eventId: z.string(),
      pixel: z.object({ contentCategory: z.string(), contentName: z.string() }).optional(),
    }))
    .mutation(async ({ ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await trackRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      // Phase 1: the meta-capi-event job only handles 'Lead'. This endpoint is
      // the wiring seam; the 'Schedule' job variant + measurement.service method
      // land alongside the first datetime-bearing funnel. Acknowledge for now.
      return { ok: true as const }
    }),
})
