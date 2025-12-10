'use client'

import type { ScheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { defaultValues, scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { useTRPC } from '@/trpc/helpers'

export default function ScheduleConsultationForm() {
  const trpc = useTRPC()
  const scheduleConsultation = useMutation(trpc.landingRouter.scheduleConsultation.mutationOptions())
  const form = useForm<ScheduleConsultationFormSchema>({
    resolver: zodResolver(scheduleConsultationFormSchema),
    defaultValues,
  })

  function onSubmit(data: ScheduleConsultationFormSchema) {
    scheduleConsultation.mutate(data, {
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
          Request Your Consultation
        </h2>
        <p className="text-muted-foreground mb-8">
          Tell us about your project and we&apos;ll schedule a personalized
          consultation to discuss your vision, timeline, and budget.
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

          {/* Project Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="projectType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type *</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(newVal) => {
                        field.onChange(newVal)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Project Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom-home">Custom Home Construction</SelectItem>
                        <SelectItem value="renovation">Luxury Renovation</SelectItem>
                        <SelectItem value="commercial">Commercial Construction</SelectItem>
                        <SelectItem value="design-build">Design-Build Services</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="timeline"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Timeline</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(newVal) => {
                        field.onChange(newVal)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">As Soon As Possible</SelectItem>
                        <SelectItem value="3-months">Within 3 Months</SelectItem>
                        <SelectItem value="6-months">Within 6 Months</SelectItem>
                        <SelectItem value="1-year">Within 1 Year</SelectItem>
                        <SelectItem value="planning">Just Planning</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Property Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="propertyType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type *</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(newVal) => {
                        field.onChange(newVal)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Property Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-family">Single Family Home</SelectItem>
                        <SelectItem value="multi-family">Multi-Family</SelectItem>
                        <SelectItem value="commercial">Commercial Building</SelectItem>
                        <SelectItem value="land">Vacant Land</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            name="location"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="City, State" {...field} />
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
