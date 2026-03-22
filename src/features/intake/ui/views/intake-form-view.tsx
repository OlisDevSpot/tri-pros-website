/* eslint-disable node/prefer-global/process */
'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import type { LeadSource, LeadType } from '@/shared/types/enums'
import { useMutation } from '@tanstack/react-query'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddressAutocompleteField } from '@/features/intake/ui/components/address-autocomplete-field'
import { MeetingSchedulerField } from '@/features/intake/ui/components/meeting-scheduler-field'
import { Mp3UploadField } from '@/features/intake/ui/components/mp3-upload-field'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface IntakeFormViewProps {
  leadSourceSlug: LeadSource
  formConfig: LeadSourceFormConfig
  leadSourceName: string
}

export function IntakeFormView({ leadSourceSlug, formConfig, leadSourceName }: IntakeFormViewProps) {
  const trpc = useTRPC()
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [closedById, setClosedById] = useState('')
  const [mp3Key, setMp3Key] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const submit = useMutation(
    trpc.customersRouter.createFromIntake.mutationOptions({
      onSuccess: () => setSubmitted(true),
      onError: err => toast.error(err.message),
    }),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (honeypot) {
      return
    }

    if (!name || !phone || !city || !zip) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formConfig.requireMeetingScheduler && (!scheduledFor || !closedById)) {
      toast.error('Appointment date and agent are required')
      return
    }

    submit.mutate({
      name,
      phone,
      email: email || undefined,
      address: address || undefined,
      city,
      state: state || undefined,
      zip,
      notes: notes || undefined,
      leadSource: leadSourceSlug as LeadSource,
      leadType: formConfig.leadType as LeadType,
      leadMetaJSON: mp3Key ? { mp3RecordingKey: mp3Key } : undefined,
      scheduledFor: scheduledFor || undefined,
      closedById: closedById || undefined,
    })
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-2xl font-semibold">Contact Added</p>
        <p className="text-muted-foreground">The lead has been successfully submitted.</p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">
          {'New Lead — '}
          {leadSourceName}
        </h1>

        {/* Honeypot — hidden from real users */}
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="absolute -top-2499.75 left-0 opacity-0"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
        />

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            {'Full Name '}
            <span className="text-destructive">*</span>
          </Label>
          <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">
            {'Phone '}
            <span className="text-destructive">*</span>
          </Label>
          <Input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        {/* Email (conditional) */}
        {formConfig.showEmail && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">
              Email
              {formConfig.requireEmail && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Input
              id="email"
              type="email"
              required={formConfig.requireEmail}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        {/* Address */}
        <div className="flex flex-col gap-1.5">
          <Label>
            {'Address '}
            <span className="text-destructive">*</span>
          </Label>
          <AddressAutocompleteField
            onChange={(fields) => {
              setAddress(fields.address)
              setCity(fields.city)
              setState(fields.state)
              setZip(fields.zip)
            }}
            onClear={() => {
              setAddress('')
              setCity('')
              setState('')
              setZip('')
            }}
          />
        </div>

        {/* MP3 upload (conditional) */}
        {formConfig.showMp3Upload && (
          <div className="flex flex-col gap-1.5">
            <Label>Call Recording (optional)</Label>
            <Mp3UploadField customerName={name} onUploaded={setMp3Key} onClear={() => setMp3Key('')} />
          </div>
        )}

        {/* Meeting scheduler (conditional) */}
        {formConfig.showMeetingScheduler && (
          <MeetingSchedulerField
            scheduledFor={scheduledFor}
            closedById={closedById}
            onDateChange={setScheduledFor}
            onAgentChange={setClosedById}
            required={formConfig.requireMeetingScheduler}
          />
        )}

        {/* Notes (conditional) */}
        {formConfig.showNotes && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Any context about this lead…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        )}

        <Button type="submit" size="lg" disabled={submit.isPending} className="w-full py-6">
          {submit.isPending ? 'Submitting…' : 'Submit Lead'}
        </Button>
      </form>
    </APIProvider>
  )
}
