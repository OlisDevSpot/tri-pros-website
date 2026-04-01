/* eslint-disable node/prefer-global/process */
'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import type { IntakeMode } from '@/shared/types/enums'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getIntakeFormDefaults, intakeFormSchema } from '@/features/intake/schemas/intake-form-schema'
import { ClosedByField } from '@/features/intake/ui/components/closed-by-field'
import { IntakeTradeScopePicker } from '@/features/intake/ui/components/intake-trade-scope-picker'
import { MeetingDateField } from '@/features/intake/ui/components/meeting-date-field'
import { Mp3UploadField } from '@/features/intake/ui/components/mp3-upload-field'
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
import { Button } from '@/shared/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface IntakeFormViewProps {
  mode: IntakeMode
  formConfig: LeadSourceFormConfig
  leadSourceSlug?: string
  onModeChange?: (mode: IntakeMode) => void
}

export function IntakeFormView({ mode, formConfig, leadSourceSlug, onModeChange }: IntakeFormViewProps) {
  const trpc = useTRPC()

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: getIntakeFormDefaults(mode),
  })

  // Update mode field without clearing other values
  useEffect(() => {
    form.setValue('mode', mode)
  }, [mode, form])

  const submit = useMutation(
    trpc.customersRouter.createFromIntake.mutationOptions({
      onSuccess: () => {
        form.reset({ ...getIntakeFormDefaults(mode), _honeypot: 'submitted' })
      },
      onError: err => toast.error(err.message),
    }),
  )

  const isSubmitted = form.watch('_honeypot') === 'submitted'
  const isMeetingMode = mode === 'customer_and_meeting'

  function onSubmit(data: IntakeFormData) {
    if (data._honeypot && data._honeypot !== 'submitted') {
      return
    }

    const leadMetaJSON = data.mode === 'customer_and_meeting'
      ? {
          mp3RecordingKey: data.mp3Key || undefined,
          closedBy: data.closedBy || undefined,
          scheduledFor: data.scheduledFor || undefined,
          requestedTrades: data.tradeRows.filter(r => r.tradeId),
        }
      : {
          requestedTrades: data.tradeRows.filter(r => r.tradeId),
        }

    submit.mutate({
      name: data.name,
      phone: data.phone,
      city: data.city,
      zip: data.zip,
      email: data.email || undefined,
      address: data.address || undefined,
      state: data.state || undefined,
      notes: data.notes || undefined,
      mode: data.mode,
      leadSource: (leadSourceSlug ?? 'other') as Parameters<typeof submit.mutate>[0]['leadSource'],
      leadMetaJSON,
    })
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-2xl font-semibold">Contact Added</p>
        <p className="text-muted-foreground">The lead has been successfully submitted.</p>
        <Button
          variant="outline"
          onClick={() => form.reset(getIntakeFormDefaults(mode))}
        >
          Submit Another
        </Button>
      </div>
    )
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Honeypot — hidden from real users */}
          <input
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -top-[9999px] left-0 opacity-0"
            {...form.register('_honeypot')}
          />

          {/* Mode toggle — super-admin only */}
          {onModeChange && (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Switch
                id="intake-mode-toggle"
                checked={isMeetingMode}
                onCheckedChange={(checked) => {
                  onModeChange(checked ? 'customer_and_meeting' : 'customer_only')
                }}
              />
              <Label htmlFor="intake-mode-toggle" className="text-sm font-medium">
                {isMeetingMode ? 'Customer + Meeting' : 'Customer Only'}
              </Label>
            </div>
          )}

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {'Full Name '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Input {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {'Phone '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Input type="tel" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email (conditional) */}
          {formConfig.showEmail && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email
                    {formConfig.requireEmail && <span className="ml-1 text-destructive">*</span>}
                  </FormLabel>
                  <Input type="email" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={() => (
              <FormItem>
                <FormLabel>
                  {'Address '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <AddressAutocomplete
                  showMap
                  onSelect={(fields) => {
                    form.setValue('address', fields.address)
                    form.setValue('city', fields.city)
                    form.setValue('state', fields.state)
                    form.setValue('zip', fields.zip)
                  }}
                  onClear={() => {
                    form.setValue('address', '')
                    form.setValue('city', '')
                    form.setValue('state', '')
                    form.setValue('zip', '')
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Trade/Scope Picker */}
          <IntakeTradeScopePicker />

          {/* === Meeting-mode fields === */}
          {isMeetingMode && (
            <>
              {/* MP3 upload (conditional) */}
              {formConfig.showMp3Upload && (
                <FormField
                  control={form.control}
                  name="mp3Key"
                  render={() => (
                    <FormItem>
                      <FormLabel>Call Recording (optional)</FormLabel>
                      <Mp3UploadField
                        customerName={form.watch('name')}
                        onUploaded={key => form.setValue('mp3Key', key)}
                        onClear={() => form.setValue('mp3Key', '')}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Meeting date (conditional) */}
              {formConfig.showMeetingScheduler && (
                <MeetingDateField required={formConfig.requireMeetingScheduler ?? false} />
              )}

              {/* Closed By (conditional) */}
              {formConfig.closedByOptions && formConfig.closedByOptions.length > 0 && (
                <ClosedByField options={formConfig.closedByOptions} />
              )}
            </>
          )}

          {/* Notes (required) */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {'Notes '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Textarea
                  rows={3}
                  placeholder="Any context about this lead…"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" disabled={submit.isPending} className="w-full py-6">
            {submit.isPending ? 'Submitting…' : 'Submit Lead'}
          </Button>
        </form>
      </Form>
    </APIProvider>
  )
}
