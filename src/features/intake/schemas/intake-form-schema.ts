import z from 'zod'

export const tradeRowSchema = z.object({
  tradeId: z.string().min(1, 'Trade is required'),
  scopeIds: z.array(z.string()),
})

export type TradeRow = z.infer<typeof tradeRowSchema>

// Shared base fields — always present in both modes
const baseFields = {
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'ZIP is required'),
  address: z.string().optional(),
  state: z.string().length(2).optional(),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),
  notes: z.string().min(1, 'Notes are required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  _honeypot: z.string().max(0, 'Bot detected').optional(),
}

// Customer + Meeting mode — includes scheduling and recording fields
const customerAndMeetingSchema = z.object({
  ...baseFields,
  mode: z.literal('customer_and_meeting'),
  scheduledFor: z.string().optional(),
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
