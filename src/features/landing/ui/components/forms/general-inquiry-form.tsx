'use client'

import type { GeneralInquiryFormSchema } from '@/shared/entities/landing/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'

import { APIProvider } from '@vis.gl/react-google-maps'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
import { Button } from '@/shared/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-card">
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
                        form.setValue('address.location', location)
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

            <Button className="" disabled={generalInquiry.isPending}>Submit</Button>

            <p className="text-sm text-muted-foreground text-center">
              By submitting this form, you agree to be contacted by Tri Pros
              Remodeling. We respect your privacy and will never share your
              information.
            </p>
          </form>
        </motion.div>
      </Form>
    </APIProvider>
  )
}
