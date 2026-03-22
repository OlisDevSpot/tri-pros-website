import z from 'zod'

export const tradeRowSchema = z.object({
  tradeId: z.string().min(1, 'Trade is required'),
  scopeIds: z.array(z.string()),
})

export type TradeRow = z.infer<typeof tradeRowSchema>

export const intakeFormSchema = z.object({
  // Required
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'ZIP is required'),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),

  // Optional (toggled by formConfig)
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  state: z.string().length(2).optional(),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  closedBy: z.string().optional(),
  mp3Key: z.string().optional(),

  // Bot protection
  _honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type IntakeFormData = z.infer<typeof intakeFormSchema>

export const intakeFormDefaultValues: IntakeFormData = {
  name: '',
  phone: '',
  city: '',
  zip: '',
  tradeRows: [{ tradeId: '', scopeIds: [] }],
  email: '',
  address: '',
  state: '',
  notes: '',
  scheduledFor: '',
  closedBy: '',
  mp3Key: '',
  _honeypot: '',
}
