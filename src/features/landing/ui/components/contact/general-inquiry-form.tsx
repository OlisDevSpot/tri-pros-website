'use client'

import type { GeneralInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'

import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { defaultValues, generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { useTRPC } from '@/trpc/helpers'

export default function GeneralInquiryForm() {
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@gmail.com" {...field} />
                  </FormControl>
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
                <FormControl>
                  <Input placeholder="818-555-4444" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            name="projectDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="City, State" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button>Submit</Button>

          <p className="text-sm text-muted-foreground text-center">
            By submitting this form, you agree to be contacted by Tri Pros
            Remodeling. We respect your privacy and will never share your
            information.
          </p>
        </form>
      </motion.div>
    </Form>
  )
}
