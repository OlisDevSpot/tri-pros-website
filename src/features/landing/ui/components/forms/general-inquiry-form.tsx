'use client'

import type { GeneralInquiryFormSchema } from '@/shared/entities/landing/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'

import { APIProvider } from '@vis.gl/react-google-maps'
import { motion } from 'motion/react'
import Link from 'next/link'
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

export function GeneralInquiryForm() {
  const trpc = useTRPC()
  const generalInquiry = useMutation(trpc.landingRouter.generalInquiry.mutationOptions())
  const form = useForm<GeneralInquiryFormSchema>({
    resolver: zodResolver(generalInquiryFormSchema),
    defaultValues,
  })

  function onSubmit(data: GeneralInquiryFormSchema) {
    generalInquiry.mutate(data, {
      onSuccess: () => {
        toast.success('Consultation scheduled! We will get back to you soon.')
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
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

            {/* SMS consent disclosure must match the registered Twilio A2P 10DLC campaign verbatim. */}
            <FormField
              control={form.control}
              name="smsConsent"
              render={({ field }) => (
                <FormItem className="space-y-2 border-t border-border/40 pt-5">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        id="general-inquiry-sms-consent"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 size-4.5"
                        aria-required="true"
                      />
                    </FormControl>
                    <div className="flex-1 space-y-1.5">
                      <FormLabel
                        htmlFor="general-inquiry-sms-consent"
                        className="block cursor-pointer text-sm font-normal leading-relaxed text-foreground/90"
                      >
                        Yes, I agree to receive calls and text messages from
                        {' '}
                        <span className="font-medium text-foreground">Tri Pros Remodeling</span>
                        {' '}
                        at the phone number above about my inquiry, including via
                        automated technology.
                      </FormLabel>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Message frequency varies. Message and data rates may apply.
                        Reply STOP to opt out, HELP for help. Consent is not a
                        condition of any purchase.
                      </p>
                    </div>
                  </div>
                  <FormMessage className="ml-7.5" />
                </FormItem>
              )}
            />

            <Button disabled={generalInquiry.isPending}>Submit</Button>

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
          </form>
        </motion.div>
      </Form>
    </APIProvider>
  )
}
