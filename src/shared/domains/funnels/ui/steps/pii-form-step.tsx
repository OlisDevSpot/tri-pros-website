import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { PiiStep, StepProps } from '@/shared/domains/funnels/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js/min'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_SUBMIT_DISCLAIMER } from '@/shared/domains/funnels/constants/footer-copy'
import { FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { useDebouncedAsyncValidator } from '@/shared/domains/funnels/hooks/use-debounced-async-validator'
import { buildLeadInput } from '@/shared/domains/funnels/lib/build-lead-input'
import { firePixel, mintEventId, setAdvancedMatching } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
import { firesLeadOptimization } from '@/shared/domains/funnels/lib/tracking/lead-qualification'
import { piiSchema } from '@/shared/domains/funnels/schemas/pii.schema'
import { mainSiteUrl } from '@/shared/lib/main-site-url'
import { useTRPC } from '@/trpc/helpers'

export function PiiFormStepView({ content, answers, ctx, setValue, advance }: StepProps<PiiStep>) {
  const trpc = useTRPC()
  const reduceMotion = useReducedMotion()
  const queryClient = useQueryClient()
  const submit = useMutation(trpc.funnelsRouter.submitLead.mutationOptions({
    onError: err => toast.error(err.message),
  }))
  const lookupPhone = trpc.funnelsRouter.phoneLookup

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', _honeypot: '' },
  })

  const [firstName, lastName] = form.watch(['firstName', 'lastName'])
  const namesFilled = Boolean(firstName?.trim()) && Boolean(lastName?.trim())

  const validatePhone = useDebouncedAsyncValidator<string>(async (raw, signal) => {
    if (!isValidPhoneNumber(raw, 'US')) {
      return 'Please enter a valid US phone number'
    }
    const parsed = parsePhoneNumber(raw, 'US')
    const e164 = parsed?.number
    if (!e164) {
      return 'Please enter a valid US phone number'
    }
    const verdict = await queryClient.fetchQuery({
      ...lookupPhone.queryOptions({ phone: e164 }),
      staleTime: 5 * 60 * 1000,
    })
    if (signal.aborted) {
      return true
    }
    if (verdict.ok) {
      return true
    }
    return verdict.blockedReason === 'non-mobile'
      ? 'Please use a mobile number only.'
      : 'That phone number doesn\'t look valid — please double-check it.'
  })

  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    const lead = buildLeadInput({ ctx, pii: data, answers })
    const parsed = parsePhoneNumber(data.phone, 'US')
    const e164 = parsed?.number
    if (!e164) {
      toast.error('Please enter a valid US phone number')
      return
    }
    // Renters (ownership='rent') are ingested but excluded from Meta's Lead
    // optimization: a missing eventId makes submitLead's CAPI twin no-op, and we
    // skip the browser pixel below. Funnels without an ownership step always fire.
    // see lib/tracking/lead-qualification.ts + ../../DOCS.md
    const optimize = firesLeadOptimization(answers)
    const eventId = optimize ? mintEventId() : undefined
    const created = await submit.mutateAsync({
      phone: e164,
      name: lead.name,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      leadSourceSlug: lead.leadSourceSlug,
      leadMetaJSON: lead.leadMetaJSON,
      eventId,
      // Public browser URL (subdomain + attribution query) — the server threads
      // this to the CAPI twin as event_source_url for match quality + dedup.
      eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      pixel: {
        contentCategory: ctx.pixel.contentCategory,
        contentName: ctx.slug,
      },
    })
    if (optimize) {
      // Set Advanced Matching from the collected PII (plaintext — the pixel hashes
      // it) so the browser Lead carries the same match keys as the CAPI twin.
      setAdvancedMatching({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: e164,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
      })
      // Fire the browser Lead pixel only AFTER the server accepts + persists the
      // lead, sharing the same event_id as the server CAPI twin (dispatched inside
      // submitLead) so Meta dedupes the pair. Firing before submit would count a
      // Lead even when the server rejects (non-mobile / rate-limit / ingest error),
      // and the user's retry would mint a fresh event_id → a duplicate Lead.
      firePixel('Lead', {
        eventId,
        contentCategory: ctx.pixel.contentCategory,
        contentName: ctx.slug,
      })
    }
    setValue({ leadId: created.customerId })
    advance()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={`mx-auto flex w-full flex-col gap-5 ${FUNNEL_QUESTION_MAX_W}`}>
        <div className="text-center">
          <h2 className="text-2xl font-semibold">{content.title}</h2>
          {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
        </div>
        <fieldset disabled={form.formState.isSubmitting} className="contents">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{content.fields.firstName ?? 'First name'}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{content.fields.lastName ?? 'Last name'}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <AnimatePresence>
            {namesFilled
              ? (
                  <motion.div
                    key="reveal"
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex flex-col gap-5 overflow-hidden"
                  >
                    <FormField
                      control={form.control}
                      name="phone"
                      rules={{ validate: validatePhone }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{content.fields.phone ?? 'Phone'}</FormLabel>
                          <FormControl><Input type="tel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Short consent line in the old checkbox's place (revealed with
                        the phone field). Submission = agreement; Terms/Privacy link to
                        the apex (funnels are on subdomains, so a relative path 404s).
                        The full TCPA disclosure lives in the footer legal block, which
                        renders on every step including this one. */}
                    <p className="text-muted-foreground text-left text-xs leading-snug">
                      {FUNNEL_SUBMIT_DISCLAIMER}
                      {' '}
                      <a href={mainSiteUrl(ROOTS.landing.terms())} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Terms of Service</a>
                      {' and '}
                      <a href={mainSiteUrl(ROOTS.landing.privacy())} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy Policy</a>
                      .
                    </p>
                  </motion.div>
                )
              : null}
          </AnimatePresence>
          <input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" {...form.register('_honeypot')} />
        </fieldset>
        {/* Gate only on names (the progressive-disclosure trigger). handleSubmit awaits
            the async phone validate + zod and blocks invalid submits with field errors;
            the server submitLead gate is authoritative. formState.isValid is unreliable
            with mode:'onBlur' + async validators, so it must not disable the button. */}
        <Button type="submit" size="lg" disabled={!namesFilled || submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
      </form>
    </Form>
  )
}
