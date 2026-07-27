import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import z from 'zod'

import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { leadsService } from '@/shared/services/leads.service'
import { notificationService } from '@/shared/services/notification.service'
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

const draftRatelimit = new Ratelimit({
  // A session can advance ~15 steps; 60/h leaves comfortable headroom.
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'funnel:draft',
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
      // Track-1 decoupling: the pre-PII draft-lead id, threaded from
      // sessionStorage by the PII step so this submit can link it post-hoc.
      draftId: z.string().uuid().optional(),
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

      // Track-1 decoupling: link the pre-PII draft to the new customer and
      // stamp the Meta Lead event_id (the Meta↔first-party join key).
      if (input.draftId) {
        await customerIntakeService.linkDraftLead(SYSTEM_CONTEXT, {
          customerId,
          draftLeadId: input.draftId,
          metaLeadEventId: input.eventId ?? null,
        })
      }

      // New-lead alert (push + email). Fire-and-forget: never blocks the lead submit.
      void notificationService
        .notifyNewLead({ customerId, source: `${input.leadSourceSlug} funnel` })
        .catch(err => console.warn('[funnels.ingestLead] notifyNewLead failed:', err))

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

  // Anonymous draft-lead capture (design spec 2026-07-26 §3). Fire-and-forget
  // from the funnel client on each step advance; creates the draft on first
  // answer. NO PII accepted here — PII enters only via submitLead. The pii
  // step's answers key is defensively stripped server-side.
  trackDraftStep: baseProcedure
    .input(z.object({
      draftId: z.string().uuid().nullable(),
      funnelSlug: z.string().min(1).max(100),
      trade: z.string().max(100).nullable(),
      stepId: z.string().min(1).max(100),
      stepIndex: z.number().int().min(0).max(100),
      answers: z.record(z.string(), z.unknown()),
      utm: z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        campaign: z.string().nullable(),
        content: z.string().nullable(),
        term: z.string().nullable(),
        fbclid: z.string().nullable(),
        gclid: z.string().nullable(),
      }).nullable(),
      fbp: z.string().max(200).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await draftRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      const { pii: _pii, ...answers } = input.answers
      const ua = (ctx as { req?: Request }).req?.headers.get('user-agent') ?? null
      return leadsService.captureDraftStep({
        draftId: input.draftId,
        funnelSlug: input.funnelSlug,
        trade: input.trade,
        answers,
        entry: { stepId: input.stepId, stepIndex: input.stepIndex, enteredAt: new Date().toISOString() },
        utm: input.utm,
        fbp: input.fbp,
        clientIp: ip === 'anonymous' ? null : ip,
        clientUserAgent: ua,
      })
    }),
})
