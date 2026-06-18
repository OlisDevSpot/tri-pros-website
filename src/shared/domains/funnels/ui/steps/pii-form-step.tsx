import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { PiiStep, StepProps } from '@/shared/domains/funnels/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { buildLeadInput } from '@/shared/domains/funnels/lib/build-lead-input'
import { piiSchema } from '@/shared/domains/funnels/schemas/pii.schema'
import { useTRPC } from '@/trpc/helpers'

export function PiiFormStepView({ content, answers, ctx, setValue, advance }: StepProps<PiiStep>) {
  const trpc = useTRPC()
  const reduceMotion = useReducedMotion()
  const submit = useMutation(trpc.customersRouter.business.createFromIntake.mutationOptions({
    onError: err => toast.error(err.message),
  }))

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', consent: false as unknown as true, _honeypot: '' },
  })

  const [firstName, lastName] = form.watch(['firstName', 'lastName'])
  const namesFilled = Boolean(firstName?.trim()) && Boolean(lastName?.trim())

  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    const created = await submit.mutateAsync(buildLeadInput({ ctx, pii: data, answers }))
    setValue({ leadId: created.customerId })
    advance()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{content.fields.phone ?? 'Phone'}</FormLabel>
                          <FormControl><Input type="tel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-muted-foreground text-xs font-normal leading-snug">{content.consent}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )
              : null}
          </AnimatePresence>
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...form.register('_honeypot')} />
        </fieldset>
        <Button type="submit" size="lg" disabled={!namesFilled || submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
      </form>
    </Form>
  )
}

/** Importable prebuilt step (Seam A). Spread + override `content` per funnel. */
export const PII_STEP: PiiStep = {
  id: 'pii',
  kind: 'pii-form',
  content: {
    title: 'Where should we send your Showcase details?',
    cta: 'See if I qualify',
    consent: 'By submitting, I agree Tri Pros Remodeling may contact me by call, text, and email about my project. Consent isn\'t a condition of purchase. Msg/data rates may apply. See our Privacy Policy.',
    fields: { firstName: 'First name', lastName: 'Last name', phone: 'Phone' },
  },
}
