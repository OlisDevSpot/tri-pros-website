'use client'

import type { ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { zodResolver } from '@hookform/resolvers/zod'

import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { ROOTS } from '@/shared/config/roots'
import { contactInfo } from '@/shared/constants/company'
import { services } from '@/shared/constants/company/services'
import { scheduleConsultationDefaultValues as defaultValues, scheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { formatProjectType } from '@/shared/services/providers/resend/lib/format-project-type'
import { useTRPC } from '@/trpc/helpers'
import { InquirySuccessCard } from './inquiry-success-card'

export function ScheduleConsultationForm() {
  const trpc = useTRPC()
  const scheduleConsultation = useMutation(trpc.landingRouter.scheduleConsultation.mutationOptions())
  const [submitted, setSubmitted] = useState<ScheduleConsultationFormSchema | null>(null)
  const form = useForm<ScheduleConsultationFormSchema>({
    resolver: zodResolver(scheduleConsultationFormSchema),
    defaultValues,
  })
  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(data: ScheduleConsultationFormSchema) {
    try {
      await scheduleConsultation.mutateAsync(data)
      setSubmitted(data)
    }
    catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Something went wrong sending your inquiry. Please try again or call ${contactInfo.find(info => info.accessor === 'phone')!.value}.`,
      )
    }
  }

  if (submitted) {
    const firstName = submitted.name.trim().split(/\s+/)[0] || submitted.name
    const recapItems = [
      { label: 'Project type', value: formatProjectType(submitted.projectType) },
      submitted.timeline && { label: 'Timeline', value: submitted.timeline },
      submitted.propertyType && { label: 'Property type', value: submitted.propertyType },
      submitted.location && { label: 'Location', value: submitted.location },
      submitted.projectDescription && { label: 'Description', value: submitted.projectDescription },
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
    <Form {...form}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="min-h-fit"
      >
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-6">
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-card text-left">
          {/* fieldset with className="contents" disables every form control during submit
              without changing layout — native double-submit protection. */}
          <fieldset
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="contents disabled:opacity-95"
          >
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
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Project Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map(service => (
                            <SelectItem key={service.slug} value={service.slug}>
                              {service.title}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">Other / Not Sure</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
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
                    <Textarea placeholder="My project includes..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

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
                          id="schedule-consultation-sms-consent"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5 size-4.5"
                        />
                      </FormControl>
                      <div className="flex-1 space-y-1.5">
                        <FormLabel
                          htmlFor="schedule-consultation-sms-consent"
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
                          id="schedule-consultation-call-consent"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5 size-4.5"
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor="schedule-consultation-call-consent"
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
                href={ROOTS.landing.privacy()}
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
              {' '}
              and
              {' '}
              <Link
                href={ROOTS.landing.terms()}
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
  )
}
