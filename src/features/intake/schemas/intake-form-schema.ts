import z from 'zod'

export const tradeRowSchema = z.object({
  tradeId: z.string().min(1, 'Trade is required'),
  scopeIds: z.array(z.string()),
})

export type TradeRow = z.infer<typeof tradeRowSchema>

// Shared base fields — always present in both modes
const baseFields = {
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'Valid ZIP code is required'),
  address: z.string().min(1, 'Address is required'),
  state: z.string().length(2, 'Valid state is required').optional().or(z.literal('')),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),
  notes: z.string().min(1, 'Notes are required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  _honeypot: z.string().max(0, 'Bot detected').optional(),
}

// Customer + Meeting mode — includes scheduling and recording fields
const customerAndMeetingSchema = z.object({
  ...baseFields,
  mode: z.literal('customer_and_meeting'),
  scheduledFor: z.string({ error: 'A meeting must have a scheduled date' }).min(1, 'A meeting must have a scheduled date'),
  closedBy: z.string().optional(),
  mp3Key: z.string().optional(),
})

// Customer-only mode — no meeting-related fields
const customerOnlySchema = z.object({
  ...baseFields,
  mode: z.literal('customer_only'),
})

export const intakeFormSchema = z.discriminatedUnion('mode', [
  customerAndMeetingSchema,
  customerOnlySchema,
])

export type IntakeFormData = z.infer<typeof intakeFormSchema>

export function getIntakeFormDefaults(mode: 'customer_only' | 'customer_and_meeting'): IntakeFormData {
  const base = {
    name: '',
    phone: '',
    city: '',
    zip: '',
    tradeRows: [{ tradeId: '', scopeIds: [] }],
    email: '',
    address: '',
    state: '',
    notes: '',
    _honeypot: '',
  }

  if (mode === 'customer_and_meeting') {
    return { ...base, mode, scheduledFor: '', closedBy: '', mp3Key: '' }
  }

  return { ...base, mode }
}
