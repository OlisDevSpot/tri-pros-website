import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { PiiStep, StepProps } from '@/shared/domains/funnels/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { buildLeadInput } from '@/shared/domains/funnels/lib/build-lead-input'
import { piiSchema } from '@/shared/domains/funnels/schemas/pii.schema'
import { useTRPC } from '@/trpc/helpers'

export function PiiFormStepView({ content, answers, ctx, setValue, advance, back, isFirst }: StepProps<PiiStep>) {
  const trpc = useTRPC()
  const submit = useMutation(trpc.customersRouter.business.createFromIntake.mutationOptions({
    onError: err => toast.error(err.message),
  }))

  const prefillCity = (() => {
    const loc = answers.location
    return loc && typeof loc === 'object' && !Array.isArray(loc) && 'city' in loc ? String(loc.city ?? '') : ''
  })()

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    defaultValues: { name: '', phone: '', email: '', city: prefillCity, consent: false as unknown as true, _honeypot: '' },
  })

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
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{content.fields.name ?? 'Full name'}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{content.fields.email ?? 'Email'}</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{content.fields.city ?? 'City'}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
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
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...form.register('_honeypot')} />
        </fieldset>
        <Button type="submit" size="lg" disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
        {!isFirst ? <Button type="button" variant="ghost" onClick={back}>← Back</Button> : null}
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
    fields: { name: 'Full name', phone: 'Phone', email: 'Email', city: 'City' },
  },
}
