'use client'

import type { GeneralInquiryFormSchema } from '@/shared/entities/landing/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'

import { APIProvider } from '@vis.gl/react-google-maps'
import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { generalInquiryDefaultValues as defaultValues, generalInquiryFormSchema } from '@/shared/entities/landing/schemas'
import { useTRPC } from '@/trpc/helpers'
import { InquirySuccessCard } from './inquiry-success-card'

export function GeneralInquiryForm() {
  const trpc = useTRPC()
  const generalInquiry = useMutation(trpc.landingRouter.generalInquiry.mutationOptions())
  const [submitted, setSubmitted] = useState<GeneralInquiryFormSchema | null>(null)
  const form = useForm<GeneralInquiryFormSchema>({
    resolver: zodResolver(generalInquiryFormSchema),
    defaultValues,
  })
  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(data: GeneralInquiryFormSchema) {
    try {
      await generalInquiry.mutateAsync(data)
      setSubmitted(data)
    }
    catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Something went wrong sending your inquiry. Please try again or call (818) 470-7656.',
      )
    }
  }

  if (submitted) {
    const firstName = submitted.name.trim().split(/\s+/)[0] || submitted.name
    const recapItems = [
      submitted.address?.fullAddress && { label: 'Address', value: submitted.address.fullAddress },
      submitted.inquiryDescription && { label: 'Inquiry', value: submitted.inquiryDescription },
    ].filter((item): item is { label: string, value: string } => Boolean(item))

    return (
      <AnimatePresence mode="wait">
        <InquirySuccessCard
          key="success"
          firstName={firstName}
          email={submitted.email}
          smsConsent={submitted.smsConsent}
          callConsent={submitted.callConsent}
          recapItems={recapItems}
        />
      </AnimatePresence>
    )
  }

  return (
    // eslint-disable-next-line node/prefer-global/process
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Form {...form}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className=" text-2xl lg:text-3xl font-bold text-foreground mb-6">
            General Inquiry
          </h2>
          <p className="text-muted-foreground mb-8">
            We love hearing from our community. Let's see how we can help you today.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-card text-left">
            {/* fieldset with className="contents" disables every form control during submit
                without changing layout — native double-submit protection. */}
            <fieldset
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="contents disabled:opacity-95"
            >
              {/* Personal Information */}
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <Input placeholder="John Doe" {...field} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="email"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <Input placeholder="john.doe@gmail.com" {...field} />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  name="phone"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <Input placeholder="818-555-4444" {...field} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={() => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <AddressAutocomplete
                        onSelect={({ address, city, state, zip, fullAddress, location }) => {
                          form.setValue('address.street', address)
                          form.setValue('address.city', city)
                          form.setValue('address.state', state)
                          form.setValue('address.zipCode', zip)
                          form.setValue('address.fullAddress', fullAddress)
                          form.setValue('address.location', location ?? undefined)
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="inquiryDescription"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inquiry Description *</FormLabel>
                      <Textarea placeholder="My project includes..." {...field} />
                    </FormItem>
                  )}
                />
              </div>

              {/* SMS + call consent — BOTH OPTIONAL, must remain separate per TCR.
                Disclosure text must match the registered carrier campaign verbatim. */}
              <div className="space-y-4 border-t border-border/40 pt-5">
                <FormField
                  control={form.control}
                  name="smsConsent"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            id="general-inquiry-sms-consent"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5 size-4.5"
                          />
                        </FormControl>
                        <div className="flex-1 space-y-1.5">
                          <FormLabel
                            htmlFor="general-inquiry-sms-consent"
                            className="block cursor-pointer text-sm font-normal leading-relaxed text-foreground/90"
                          >
                            By checking, you are allowing to receive transactional/informational
                            SMS communications regarding scheduling, appointment confirmations and
                            appointment reminders, etc., from
                            {' '}
                            <span className="font-medium text-foreground">Tri Pros Remodeling, Inc.</span>
                          </FormLabel>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Message frequency may vary. Message and data rates may apply.
                            Reply HELP for help or STOP to opt-out.
                          </p>
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="callConsent"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            id="general-inquiry-call-consent"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5 size-4.5"
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor="general-inquiry-call-consent"
                          className="block flex-1 cursor-pointer text-sm font-normal leading-relaxed text-foreground/90"
                        >
                          By checking, you are allowing call communications from
                          {' '}
                          <span className="font-medium text-foreground">Tri Pros Remodeling, Inc.</span>
                          {' '}
                          regarding your account and inquiry.
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Sending…
                      </>
                    )
                  : (
                      'Submit'
                    )}
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                By submitting, you agree to our
                {' '}
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                {' '}
                and
                {' '}
                <Link
                  href="/terms"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  Terms of Service
                </Link>
                . We never share your mobile information with third parties.
              </p>
            </fieldset>
          </form>
        </motion.div>
      </Form>
    </APIProvider>
  )
}
